const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const GuildConfig = require("../../models/guildConfig.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`birthday-config`)
    .setDescription(`Setup your birthday announce.`)
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription("The channel where you want to wish the birthday")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription(
          "The message you want to send. Use {user} as placeholder for the username and {age} for the user age"
        )
        .setRequired(true))
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDMPermission(false),
  options: {
    deleted: false,
  },
  run: async ({ interaction, client }) => {
    await interaction.deferReply();

    const { options } = interaction;
    const sub = options.getSubcommand(options);

    switch (sub) {
      case "config":
        let guild = await GuildConfig.findOne({
          guildId: interaction.guild.id,
        });

        if (!guild)
          guild = await GuildConfig.create({
            guildId: interaction.guild.id,
          });

        const channel = await options.getChannel("channel");
        guild.birthdayChannel = channel.id;

        const message = await options.getString("message");
        guild.birthdayMessage = message;

        await guild.save();

        const embed3 = new EmbedBuilder()
          .setColor(0x223f98)
          .setTitle(`Birthday configuration`)
          .setDescription(`Birthday announcement channel`)
          .addFields({ name: "Channel", value: `> ${channel.name}` })
          .addFields({
            name: "Message example",
            value: `> ${message
              .replace("{user}", `<@${interaction.user.id}>`)
              .replace("{age}", "25")}`,
          })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed3] });
        break;
    }
  },
};
