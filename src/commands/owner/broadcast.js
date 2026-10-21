const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");

const CHANNEL_PAUSE = 800; // ms between posts in channels
const DM_PAUSE = 1500; // DMs are rate-limited much more aggressively

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** True if the user owns the application (user owner or team member). */
async function isAppOwner(client, userId) {
  let owner = client.application?.owner;
  if (!owner) {
    try {
      owner = (await client.application.fetch()).owner;
    } catch {
      return false;
    }
  }
  if (!owner) return false;
  // Team-owned apps: accept any team member.
  if (owner.members) return owner.ownerId === userId || owner.members.has(userId);
  return owner.id === userId;
}

/** Post into the guild's Community Updates channel. Returns true on success. */
async function postToCommunityChannel(client, guild, text) {
  const channelId = guild.publicUpdatesChannelId;
  if (!channelId) return false;
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel?.isTextBased()) return false;
    const me =
      guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
    const perms = me ? channel.permissionsFor(me) : null;
    if (
      !perms?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])
    ) {
      return false;
    }
    await channel.send(text);
    console.log(`[broadcast] canale OK ${guild.name} (${guild.id}) #${channel.name}`);
    return true;
  } catch (err) {
    console.error(`[broadcast] canale fallito ${guild.name} (${guild.id}):`, err.message);
    return false;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("broadcast")
    .setDescription(
      "Invia un messaggio a tutti i server dove il bot è presente."
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName("testo")
        .setDescription("Testo del messaggio (Markdown, max 2000 caratteri)")
        .setRequired(true)
        .setMaxLength(2000)
    )
    .addStringOption((opt) =>
      opt
        .setName("modalita")
        .setDescription("Dove inviare il messaggio (default: canale)")
        .addChoices(
          { name: "Canale Aggiornamenti Community (+DM fallback)", value: "canale" },
          { name: "DM agli owner", value: "dm" }
        )
    )
    .addBooleanOption((opt) =>
      opt
        .setName("anteprima")
        .setDescription("Invia solo a te come prova, senza toccare i server")
    ),

  async execute(interaction) {
    if (!(await isAppOwner(interaction.client, interaction.user.id))) {
      return void (await interaction.reply({
        content: "❌ Comando riservato al proprietario del bot.",
        flags: MessageFlags.Ephemeral,
      }));
    }

    const testo = interaction.options.getString("testo", true);
    const anteprima = interaction.options.getBoolean("anteprima") ?? false;
    const modalita = interaction.options.getString("modalita") ?? "canale";

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Preview: DM only to yourself, no real recipients.
    if (anteprima) {
      try {
        await interaction.user.send(testo);
        await interaction.editReply(
          "👁️ Anteprima inviata in DM. Nessun server è stato toccato."
        );
      } catch {
        await interaction.editReply(
          "❌ Impossibile inviarti il DM (DM chiusi?). Abilita i messaggi diretti e riprova."
        );
      }
      return;
    }

    const client = interaction.client;
    const results = { channel: 0, dm: 0, failed: 0 };
    const dmSent = new Set(); // owners who already received a DM
    const guilds = [...client.guilds.cache.values()];
    console.log(
      `[broadcast] inizio: ${guilds.length} server, modalità ${modalita}, ${testo.length} char`
    );

    for (const guild of guilds) {
      let postedInChannel = false;

      if (modalita === "canale") {
        postedInChannel = await postToCommunityChannel(client, guild, testo);
        if (postedInChannel) {
          results.channel++;
          await sleep(CHANNEL_PAUSE);
        }
      }

      // Primary path in "dm" mode, fallback when the channel is missing/denied.
      if (!postedInChannel) {
        try {
          const owner = await guild.fetchOwner();
          if (!owner) throw new Error("owner non trovato");
          if (dmSent.has(owner.id)) continue; // same owner across servers: one DM only
          dmSent.add(owner.id);
          await owner.send(testo);
          results.dm++;
          console.log(`[broadcast] dm OK ${guild.name} (${guild.id}) -> ${owner.id}`);
          await sleep(DM_PAUSE);
        } catch (err) {
          results.failed++;
          console.error(
            `[broadcast] dm fallito ${guild.name} (${guild.id}):`,
            err.message
          );
        }
      }
    }

    console.log(
      `[broadcast] fine: canali=${results.channel} dm=${results.dm} falliti=${results.failed}`
    );
    await interaction.editReply(
      `📤 **Broadcast completato**\n` +
        `Canale Aggiornamenti Community: **${results.channel}**\n` +
        `DM agli owner: **${results.dm}**\n` +
        `Falliti (DM chiusi/rifiutati): **${results.failed}**`
    );
  },
};
