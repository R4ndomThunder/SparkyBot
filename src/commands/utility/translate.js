const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
} = require("discord.js");
const { translate } = require("../../utils/translate");

const MAX_LENGTH = 1900;

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Traduci messaggio")
    .setType(ApplicationCommandType.Message),
  async execute(interaction) {
    const message = interaction.targetMessage;
    const source = (message.content || "").trim();

    if (!source) {
      return interaction.reply({
        content: "Questo messaggio non contiene testo da tradurre.",
        flags: MessageFlags.Ephemeral,
      });
    }

    // Discord locale -> ISO 639-1 (e.g. "it" / "en-US" -> "en")
    const target = (interaction.locale || "en")
      .split(/[-_]/)[0]
      .toLowerCase();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const { text, detected } = await translate(source, target);

      if (detected && detected.toLowerCase() === target) {
        return await interaction.editReply(
          `Il messaggio è già nella tua lingua (\`${target}\`).`
        );
      }

      const header = detected
        ? `**Tradotto da \`${detected}\` → \`${target}\`:**`
        : `**Traduzione in \`${target}\`:**`;
      const body =
        text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH)}…` : text;

      await interaction.editReply(`${header}\n${body}`);
    } catch (err) {
      console.error("[translate]", err?.message || err);
      await interaction.editReply("Non sono riuscito a tradurre questo messaggio.");
    }
  },
};
