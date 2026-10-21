const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
  EmbedBuilder,
  InteractionContextType,
} = require("discord.js");
const jtcDb = require("../../db/jtc");
const { PLACEHOLDERS } = require("../../utils/jtc");

const MAX_USER_LIMIT = 99;

const reply = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

const statusEmbed = (guild, config) => {
  const active = jtcDb.listTempChannels(guild.id).length;
  const hub = config.hub_channel_id ? `<#${config.hub_channel_id}>` : "—";
  const category = config.category_id ? `<#${config.category_id}>` : "*nessuna (root)*";

  return new EmbedBuilder()
    .setTitle("Join-to-Create")
    .setColor(config.enabled ? 0x57f287 : 0xed4245)
    .addFields(
      { name: "Stato", value: config.enabled ? "🟢 Attivo" : "🔴 Disattivato", inline: true },
      { name: "Canale hub", value: hub, inline: true },
      { name: "Categoria", value: category, inline: true },
      { name: "Template nome", value: `\`${config.name_template}\`` },
      { name: "Limite utenti", value: config.user_limit > 0 ? `${config.user_limit}` : "Nessuno", inline: true },
      { name: "Canali temporanei attivi", value: `${active}`, inline: true }
    )
    .setFooter({ text: `Placeholder: ${PLACEHOLDERS.replace(/`/g, "")}` });
};

const buildData = () =>
  new SlashCommandBuilder()
    .setName("jtc")
    .setDescription("Configura i canali vocali temporanei (Join-to-Create).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Imposta il canale hub che crea i canali temporanei.")
        .addChannelOption((opt) =>
          opt
            .setName("hub")
            .setDescription("Canale vocale da usare come hub")
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Categoria in cui creare i canali temporanei")
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addStringOption((opt) =>
          opt
            .setName("name")
            .setDescription('Template del nome (es. "{user}\'s channel")')
            .setMaxLength(100)
        )
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Limite di utenti per canale (0 = illimitato)")
            .setMinValue(0)
            .setMaxValue(MAX_USER_LIMIT)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("name")
        .setDescription("Cambia il template del nome dei canali temporanei.")
        .addStringOption((opt) =>
          opt.setName("template").setDescription("Nuovo template").setMaxLength(100).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("limit")
        .setDescription("Imposta il limite di utenti per canale (0 = illimitato).")
        .addIntegerOption((opt) =>
          opt
            .setName("value")
            .setDescription("Numero massimo di utenti")
            .setMinValue(0)
            .setMaxValue(MAX_USER_LIMIT)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("category")
        .setDescription("Imposta (o rimuovi) la categoria dei canali temporanei.")
        .addChannelOption((opt) =>
          opt
            .setName("category")
            .setDescription("Categoria (lascia vuoto per rimuoverla)")
            .addChannelTypes(ChannelType.GuildCategory)
        )
    )
    .addSubcommand((sub) => sub.setName("enable").setDescription("Riattiva i canali temporanei."))
    .addSubcommand((sub) => sub.setName("disable").setDescription("Disattiva i canali temporanei."))
    .addSubcommand((sub) => sub.setName("status").setDescription("Mostra la configurazione attuale."))
    .addSubcommand((sub) => sub.setName("remove").setDescription("Rimuove la configurazione di questo server."));

module.exports = {
  data: buildData(),

  async execute(interaction) {
    const { guild } = interaction;
    const sub = interaction.options.getSubcommand();
    let config = jtcDb.getConfig(guild.id);

    const requireConfig = () => {
      if (!config) {
        reply(
          interaction,
          "⚠️ Nessuna configurazione. Usa prima `/jtc setup` per scegliere il canale hub."
        );
        return false;
      }
      return true;
    };

    switch (sub) {
      case "setup": {
        const hub = interaction.options.getChannel("hub");
        const category = interaction.options.getChannel("category");
        const name = interaction.options.getString("name");
        const limit = interaction.options.getInteger("limit");

        config = jtcDb.setConfig({
          guildId: guild.id,
          hubChannelId: hub.id,
          categoryId: category?.id ?? null,
          nameTemplate: name ?? jtcDb.DEFAULT_TEMPLATE,
          userLimit: limit ?? 0,
          enabled: true,
        });

        await reply(
          interaction,
          `✅ Join-to-Create attivato.\n` +
            `**Hub:** <#${hub.id}>\n` +
            `**Categoria:** ${category ? `<#${category.id}>` : "*nessuna*"}\n` +
            `**Template:** \`${config.name_template}\`\n` +
            `**Limite:** ${config.user_limit > 0 ? config.user_limit : "nessuno"}\n\n` +
            `Entra in <#${hub.id}> per creare un canale temporaneo.`
        );
        break;
      }

      case "name": {
        if (!requireConfig()) return;
        const template = interaction.options.getString("template");
        config = jtcDb.patchConfig(guild.id, "name", template);
        await reply(interaction, `✅ Template aggiornato: \`${config.name_template}\`\n${PLACEHOLDERS}`);
        break;
      }

      case "limit": {
        if (!requireConfig()) return;
        const value = interaction.options.getInteger("value");
        config = jtcDb.patchConfig(guild.id, "limit", value);
        await reply(
          interaction,
          value === 0 ? "✅ Limite rimosso (canali illimitati)." : `✅ Limite impostato a **${value}** utenti.`
        );
        break;
      }

      case "category": {
        if (!requireConfig()) return;
        const category = interaction.options.getChannel("category");
        config = jtcDb.patchConfig(guild.id, "category", category?.id ?? null);
        await reply(
          interaction,
          category
            ? `✅ Categoria impostata su <#${category.id}>.`
            : "✅ Categoria rimossa (i canali verranno creati nella root)."
        );
        break;
      }

      case "enable":
      case "disable": {
        if (!requireConfig()) return;
        const enabled = sub === "enable";
        config = jtcDb.patchConfig(guild.id, "enabled", enabled ? 1 : 0);
        await reply(interaction, enabled ? "🟢 Join-to-Create riattivato." : "🔴 Join-to-Create disattivato.");
        break;
      }

      case "status": {
        if (!requireConfig()) return;
        await interaction.reply({ embeds: [statusEmbed(guild, config)], flags: MessageFlags.Ephemeral });
        break;
      }

      case "remove": {
        if (!requireConfig()) return;
        jtcDb.deleteConfig(guild.id);
        await reply(
          interaction,
          "✅ Configurazione rimossa. Gli eventuali canali temporanei già esistenti verranno eliminati quando si svuotano."
        );
        break;
      }

      default:
        await reply(interaction, "Sottocomando sconosciuto.");
    }
  },
};
