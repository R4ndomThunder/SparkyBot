const Welcome = require("../../models/welcome.js");
const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("This sets a welcome message.")
    .addSubcommand((command) =>
      command
        .setName("set")
        .setDescription("Setup welcome message")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "The channel where the welcome message will be sent"
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("message")
            .setDescription("The welcome message, use {user} to tag the user")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command.setName("delete").setDescription("Disable welcome message")
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
            .setColor(0x223f98)
            .setDescription(
              `:white_check_mark: Your welcome channel has been set to ${channel}`
            );

          let welcome = await Welcome.findOne({
            guildId: interaction.guild.id,
          });

          if (welcome) {
            welcome.message = message;
            welcome.channelId = channel.id;
          } else {
            welcome = new Welcome({
              guildId: interaction.guild.id,
              channelId: channel.id,
              message: message,
            });
          }
          await welcome.save();

          await interaction.reply({ embeds: [embed] });
          break;
        case "delete":
          const embed2 = new EmbedBuilder()
            .setColor(0x223f98)
            .setDescription(
              `:white_check_mark: Your welcome message has been removed`
            );

          await Welcome.deleteOne({ guildId: interaction.guild.id });

          await interaction.reply({ embeds: [embed2] });
          break;
      }
    } catch (err) {
      console.error(err);
    }
  },
};
