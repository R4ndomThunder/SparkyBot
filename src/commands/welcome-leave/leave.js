const Leave = require("../../models/leave.js");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("This sets a leave message.")
    .addSubcommand((command) =>
      command
        .setName("set")
        .setDescription("Setup leave message")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel where the leave message will be sent")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("The leave message, use {user} to tag the user")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command.setName("delete").setDescription("Disable leave message")
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  options: {},
  run: async ({ interaction, client }) => {
    try {
      const { guild, options } = interaction;

      const sub = options.getSubcommand();

      switch (sub) {
        case "set":
          const channel = interaction.options.getChannel("channel");
          const message = interaction.options.getString("message");
          const embed = new EmbedBuilder()
            .setColor("Green")
            .setDescription(
              `:white_check_mark: Your leave channel has been set to ${channel}`
            );

          let leave = await Leave.findOne({ guildId: interaction.guild.id });

          if (leave) {
            leave.message = message;
            leave.channelId = channel.id;
          } else {
            leave = new Leave({
              guildId: interaction.guild.id,
              channelId: channel.id,
              message: message,
            });
          }
          await leave.save();

          await interaction.reply({ embeds: [embed] });
          break;
        case "delete":
          const embed2 = new EmbedBuilder()
            .setColor("Green")
            .setDescription(
              `:white_check_mark: Your leave message has been removed`
            );

          await Leave.deleteOne({ guildId: interaction.guild.id });

          await interaction.reply({ embeds: [embed2] });
          break;
      }
    } catch (e) {
      console.error(e);
    }
  },
};
