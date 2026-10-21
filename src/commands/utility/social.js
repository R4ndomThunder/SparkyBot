const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder,
  InteractionContextType,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const socialDb = require("../../db/social");
const { getProvider, listProviders, probeFeed, checkFeed } = require("../../social");
const { sendItem } = require("../../social/post");

const reply = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

// Itch.io API keys arrive through a modal (a slash option would be visible to
// the whole channel): userId → pending "/social add" context.
const pendingApiKeys = new Map();
const PENDING_TTL_MS = 5 * 60_000;

const fmtMarker = (id) => (!id ? "vuoto" : id.length > 60 ? `${id.slice(0, 59)}…` : id);

const fmtTime = (epoch) =>
  epoch
    ? new Date(epoch * 1000).toLocaleString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "mai";

const feedChoiceLabel = (feed) => {
  const label = feed.source_label || feed.source;
  const state = feed.enabled ? "" : " (in pausa)";
  return `${feed.platform} · ${label}${state}`.slice(0, 100);
};

const addFeedOption = (opt) =>
  opt.setName("feed").setDescription("Il feed da gestire").setRequired(true).setAutocomplete(true);

const buildData = () => {
  const builder = new SlashCommandBuilder()
    .setName("social")
    .setDescription("Gestisce i feed social (Twitch, YouTube, Bluesky, Itch.io) nei canali.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Aggiunge un feed: nuovi video/post/live finiscono nel canale.")
        .addStringOption((opt) =>
          opt
            .setName("piattaforma")
            .setDescription("Social da cui leggere")
            .setRequired(true)
            .addChoices(...listProviders().map((p) => ({ name: p.label, value: p.key })))
        )
        .addStringOption((opt) =>
          opt
            .setName("sorgente")
            .setDescription("Canale/utente (es. `@handle`, URL); Itch.io: `me` = tua API key")
            .setRequired(true)
            .setMaxLength(200)
        )
        .addChannelOption((opt) =>
          opt
            .setName("canale")
            .setDescription("Canale Discord dove pubblicare")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        )
        .addRoleOption((opt) =>
          opt.setName("ruolo").setDescription("Ruolo da menzionare a ogni nuovo elemento")
        )
        .addStringOption((opt) =>
          opt
            .setName("messaggio")
            .setDescription("Testo personalizzato pubblicato con ogni nuovo elemento")
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) => sub.setName("remove").setDescription("Rimuove un feed.").addStringOption(addFeedOption))
    .addSubcommand((sub) => sub.setName("pause").setDescription("Mette in pausa un feed.").addStringOption(addFeedOption))
    .addSubcommand((sub) => sub.setName("resume").setDescription("Riattiva un feed in pausa.").addStringOption(addFeedOption))
    .addSubcommand((sub) =>
      sub
        .setName("messaggio")
        .setDescription("Imposta o rimuove il testo personalizzato di un feed.")
        .addStringOption(addFeedOption)
        .addStringOption((opt) =>
          opt
            .setName("testo")
            .setDescription("Testo da pubblicare (omittilo per rimuoverlo)")
            .setMaxLength(500)
        )
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Elenca i feed di questo server."))
    .addSubcommand((sub) => sub.setName("test").setDescription("Controlla un feed senza pubblicare nulla.").addStringOption(addFeedOption))
    .addSubcommand((sub) => sub.setName("status").setDescription("Stato dei controlli e ultimi errori."));
  return builder;
};

/** Fetch the feed referenced by the `feed` option (same guild only). */
function getSelectedFeed(interaction) {
  const id = Number(interaction.options.getString("feed"));
  const feed = Number.isFinite(id) ? socialDb.getFeed(id) : null;
  if (!feed || feed.guild_id !== interaction.guild.id) {
    return { error: "❌ Feed non trovato in questo server." };
  }
  return { feed };
}

/**
 * Shared tail of `/social add`: resolve the source, baseline, store, reply.
 * `apiKey` (optional) is the Itch.io per-feed key collected via modal.
 */
async function runAdd(
  interaction,
  { provider, platform, input, channel, role, customMessage, apiKey = null }
) {
  const { guild } = interaction;

  let resolved;
  try {
    resolved = apiKey ? await provider.resolveKey(apiKey) : await provider.resolve(input);
  } catch (err) {
    return void (await interaction.editReply(`❌ ${err.message}`));
  }

  const existing = socialDb.getFeedByKey(guild.id, platform, resolved.source, channel.id);
  if (existing) {
    return void (await interaction.editReply(
      `⚠️ Questo feed esiste già in <#${channel.id}> (id \`${existing.id}\`). ` +
        `Usa \`/social remove\` se vuoi ricominciare.`
    ));
  }

  // Baseline: remember the newest item without dumping history.
  let baseline = { items: [], currentId: null };
  let baselineError = null;
  try {
    baseline = await provider.check(resolved.source, null, { api_key: apiKey });
  } catch (err) {
    baselineError = err;
  }

  const feed = socialDb.addFeed({
    guildId: guild.id,
    channelId: channel.id,
    platform,
    source: resolved.source,
    sourceLabel: resolved.label,
    mentionRoleId: role?.id ?? null,
    customMessage: customMessage || null,
    apiKey,
    lastItemId: baseline.currentId,
  });

  // Twitch posts the current live on first run: it is genuinely new.
  let posted = 0;
  for (const item of baseline.items) {
    try {
      const sent = await sendItem(interaction.client, feed, item, provider);
      posted += 1;
      // Remember the live notification so it can be edited when the stream ends.
      if (provider.key === "twitch" && sent) socialDb.setLiveMessage(feed.id, sent.id);
    } catch (err) {
      console.error(`[social] baseline post failed for feed ${feed.id}`, err);
    }
  }

  const lines = [
    `✅ Feed **${provider.label}** aggiunto in <#${channel.id}>.`,
    `**Sorgente:** ${resolved.label} (\`${resolved.source}\`)`,
  ];
  if (apiKey) lines.push("🔐 API key salvata (solo per questo feed, mai mostrata).");
  if (role) lines.push(`**Ruolo menzionato:** <@&${role.id}>`);
  if (customMessage) lines.push(`**Messaggio:** ${customMessage}`);
  if (posted) lines.push(`🔴 In live in questo momento: notifica inviata.`);
  else if (baselineError) {
    lines.push(
      `⚠️ Baseline non riuscita (${baselineError.message}); il primo controllo in automatico farà da riferimento.`
    );
  } else {
    lines.push(
      `Riferimento salvato: \`${fmtMarker(baseline.currentId)}\` — nessun post storico pubblicato.`
    );
  }
  lines.push(`Controllo ogni ~${provider.interval}s.`);
  return void (await interaction.editReply(lines.join("\n")));
}

module.exports = {
  data: buildData(),
  components: ["social:"], // Itch.io API key modal

  /** Autocomplete for the `feed` option (remove/pause/resume/messaggio/test). */
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (!interaction.guild || focused.name !== "feed") {
      await interaction.respond([]).catch(() => {});
      return;
    }
    const query = String(focused.value || "").toLowerCase();
    const choices = socialDb
      .listFeeds(interaction.guild.id)
      .filter((f) => feedChoiceLabel(f).toLowerCase().includes(query))
      .slice(0, 25)
      .map((f) => ({ name: feedChoiceLabel(f), value: String(f.id) }));
    await interaction.respond(choices).catch(() => {});
  },

  /** Itch.io: finish an add started with `sorgente:me` after the key modal. */
  async onModal(interaction) {
    const ctx = pendingApiKeys.get(interaction.user.id);
    pendingApiKeys.delete(interaction.user.id);
    if (!ctx || Date.now() > ctx.expiresAt) {
      return void (await reply(
        interaction,
        "❌ Sessione scaduta: riavvia `/social add piattaforma:itchio sorgente:me`."
      ));
    }

    const apiKey = interaction.fields.getTextInputValue("key").trim();
    if (!apiKey) {
      return void (await reply(interaction, "❌ API key vuota: riprova con `/social add`."));
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const provider = getProvider(ctx.platform);
    if (!provider) return void (await interaction.editReply("❌ Piattaforma sconosciuta."));
    return void (await runAdd(interaction, { ...ctx, provider, apiKey }));
  },

  async execute(interaction) {
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "add": {
        const platform = interaction.options.getString("piattaforma", true);
        const input = interaction.options.getString("sorgente", true);
        const channel = interaction.options.getChannel("canale", true);
        const role = interaction.options.getRole("ruolo");
        const customMessage = interaction.options.getString("messaggio");

        const provider = getProvider(platform);
        if (!provider) return void (await reply(interaction, "❌ Piattaforma sconosciuta."));
        if (!provider.configured()) {
          return void (await reply(
            interaction,
            `⚠️ **${provider.label}** non è configurato: aggiungi ` +
              `\`TWITCH_CLIENT_ID\` e \`TWITCH_CLIENT_SECRET\` in \`.env\`.`
          ));
        }

        // Itch.io API-key mode: `sorgente:me` opens a modal, because a slash
        // command option would expose the key to the whole channel.
        if (provider.needsApiKey && /^me$/i.test(String(input).trim())) {
          pendingApiKeys.set(interaction.user.id, {
            platform,
            input,
            channel,
            role,
            customMessage,
            expiresAt: Date.now() + PENDING_TTL_MS,
          });
          const modal = new ModalBuilder()
            .setCustomId("social:itchio:key")
            .setTitle("Collega il tuo account itch.io")
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId("key")
                  .setLabel("API key")
                  .setPlaceholder("Incolla la key da itch.io/api-keys")
                  .setStyle(TextInputStyle.Short)
                  .setMaxLength(200)
                  .setRequired(true)
              )
            );
          return void (await interaction.showModal(modal));
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return void (await runAdd(interaction, {
          provider,
          platform,
          input,
          channel,
          role,
          customMessage,
        }));
      }

      case "remove": {
        const { feed, error } = getSelectedFeed(interaction);
        if (error) return void (await reply(interaction, error));
        socialDb.removeFeed(feed.id);
        return void (await reply(
          interaction,
          `✅ Rimosso feed \`${feed.source_label || feed.source}\` (${feed.platform}) → <#${feed.channel_id}>.`
        ));
      }

      case "pause":
      case "resume": {
        const { feed, error } = getSelectedFeed(interaction);
        if (error) return void (await reply(interaction, error));
        const enabled = sub === "resume";
        socialDb.setEnabled(feed.id, enabled);
        return void (await reply(
          interaction,
          enabled
            ? `🟢 Feed \`${feed.source_label || feed.source}\` riattivato (controllo a breve).`
            : `⏸️ Feed \`${feed.source_label || feed.source}\` in pausa.`
        ));
      }

      case "messaggio": {
        const { feed, error } = getSelectedFeed(interaction);
        if (error) return void (await reply(interaction, error));
        const text = interaction.options.getString("testo");
        const saved = socialDb.setMessage(feed.id, text || null);
        const name = `\`${feed.source_label || feed.source}\``;
        return void (await reply(
          interaction,
          saved.custom_message
            ? `💬 Messaggio personalizzato per ${name}:\n> ${saved.custom_message}`
            : `🗑️ Messaggio personalizzato rimosso da ${name}.`
        ));
      }

      case "list": {
        const feeds = socialDb.listFeeds(guild.id);
        if (!feeds.length) {
          return void (await reply(
            interaction,
            "Nessun feed configurato. Usa `/social add` per aggiungerne uno."
          ));
        }
        const lines = feeds.slice(0, 30).map((f) => {
          const emoji = f.enabled ? "🟢" : "⏸️";
          const role = f.mention_role_id ? ` · ping <@&${f.mention_role_id}>` : "";
          const msg = f.custom_message ? " · 💬" : "";
          return `${emoji} <#${f.channel_id}> · **${f.platform}** · \`${f.source}\`${role}${msg} — ${f.source_label || ""}`;
        });
        if (feeds.length > 30) lines.push(`… e altri ${feeds.length - 30} feed.`);

        const embed = new EmbedBuilder()
          .setTitle(`Feed social (${feeds.length})`)
          .setColor(0x5865f2)
          .setDescription(lines.join("\n"));
        return void (await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }));
      }

      case "test": {
        const { feed, error } = getSelectedFeed(interaction);
        if (error) return void (await reply(interaction, error));
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const provider = getProvider(feed.platform);
        if (!provider) return void (await interaction.editReply("❌ Piattaforma sconosciuta."));

        let probe;
        let pending = { items: [] };
        try {
          probe = await probeFeed(feed);
          pending = await checkFeed(feed, { post: false, persist: false });
        } catch (err) {
          return void (await interaction.editReply(`❌ Controllo fallito: ${err.message}`));
        }

        const newest = probe.items[probe.items.length - 1];
        const lines = [
          `🧪 **${provider.label}** · \`${feed.source}\` → <#${feed.channel_id}>`,
        ];

        if (feed.platform === "twitch" && !probe.currentId) {
          lines.push("Stato: ⏳ nessuna live in corso.");
        } else if (newest) {
          lines.push(`Ultimo elemento: [${newest.title}](${newest.url})`);
          if (newest.timestamp) lines.push(`Pubblicato: ${fmtTime(Date.parse(newest.timestamp) / 1000)}`);
        } else {
          lines.push("Nessun elemento trovato.");
        }

        lines.push(
          pending.items.length
            ? `📥 In coda: **${pending.items.length}** elemento/i (pubblicati al prossimo controllo).`
            : "📥 Nessun elemento in coda."
        );
        lines.push(`Marker attuale: \`${fmtMarker(feed.last_item_id)}\``);
        return void (await interaction.editReply(lines.join("\n")));
      }

      case "status": {
        const feeds = socialDb.listFeeds(guild.id);
        if (!feeds.length) {
          return void (await reply(
            interaction,
            "Nessun feed configurato. Usa `/social add` per aggiungerne uno."
          ));
        }
        const nowStamp = Math.floor(Date.now() / 1000);
        const fields = feeds.slice(0, 25).map((f) => {
          const provider = getProvider(f.platform);
          const state = f.enabled ? "🟢 attivo" : "⏸️ in pausa";
          const value = [
            `Stato: ${state}`,
            `Ultimo controllo: ${fmtTime(f.last_checked)}`,
            f.enabled
              ? `Prossimo: ${f.next_check && f.next_check > nowStamp ? `tra ${f.next_check - nowStamp}s` : "a breve"}`
              : null,
            f.failures ? `Fallimenti: ${f.failures}` : null,
            f.last_error ? `⚠️ \`${String(f.last_error).slice(0, 150)}\`` : null,
          ]
            .filter(Boolean)
            .join("\n");
          return {
            name: `${f.enabled ? "🟢" : "⏸️"} ${provider?.label || f.platform} · ${(f.source_label || f.source).slice(0, 80)}`,
            value: value.slice(0, 1024),
            inline: false,
          };
        });

        const embed = new EmbedBuilder()
          .setTitle("Stato feed social")
          .setColor(feeds.some((f) => f.last_error) ? 0xfee75c : 0x57f287)
          .addFields(fields)
          .setFooter({ text: `Intervallo: twitch 60s · bluesky 60s · youtube 180s · itchio 300s` });
        if (feeds.length > 25) embed.setDescription(`Mostrati 25 feed su ${feeds.length}.`);
        return void (await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }));
      }

      default:
        await reply(interaction, "Sottocomando sconosciuto.");
    }
  },
};
