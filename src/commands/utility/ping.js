const { SlashCommandBuilder, MessageFlags } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check the bot's latency."),
  async execute(interaction) {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply({
      content: `Pong! 🏓 WebSocket: \`${interaction.client.ws.ping}ms\` | Roundtrip: \`${latency}ms\``,
      flags: MessageFlags.Ephemeral,
    });
  },
};
