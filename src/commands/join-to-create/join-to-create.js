const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

const JTC = require("../../models/JTC.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("jtc")
    .setDescription("Setup or disable your join to create voice channel")
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("Sets up your join to create voice channel")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription("The channel you want to be your join to create vc")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildVoice)
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("The category for the new VCs to be created in")
            .setRequired(true)
            .addChannelTypes(ChannelType.GuildCategory)
        )
        .addIntegerOption((option) =>
          option
            .setName("voice-limit")
            .setDescription("Set the default limit for the voice channels")
            .setMinValue(2)
            .setMaxValue(10)
        )
    )

    .addSubcommand((command) =>
      command.setName("disable").setDescription("Disable join to create system")
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDMPermission(false),
  run: async ({interaction, client}) => {

    const data = await JTC.findOne({ guildId: interaction.guild.id });

    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "setup":
        try {
          if (data)
            return await interaction.reply({
              content: `You already have a setup jtc system! Do /jtc disable to remove it`,
              ephemeral: true,
            });
          else {
            const channel = interaction.options.getChannel("channel");
            const category = interaction.options.getChannel("category");
            const limit = interaction.options.getInteger("voice-limit") || 3;

            await JTC.create({
              guildId: interaction.guild.id,
              channelId: channel.id,
              categoryId: category.id,
              voiceLimit: limit,
            });

            const embed = new EmbedBuilder()
              .setColor("Green")
              .setDescription(
                `🔊 The join to create system has been setup in ${channel}`
              );

            await interaction.reply({ embeds: [embed] });
          }
        } catch (error) {
          console.error(error);
        }
        break;
      case "disable":
        try {
          if (!data)
            return await interaction.reply({
              content: `You do not have the join to create system setup yet!`,
              ephemeral: true,
            });
          else {
            const embed2 = new EmbedBuilder()
              .setColor("Blue")
              .setDescription(
                "🔊 The join to create system has been **disabled**"
              );

            await JTC.deleteMany({ guildId: interaction.guild.id });

            await interaction.reply({ embeds: [embed2] });
          }
        } catch (err) {
          console.error(err);
        }

        break;
    }
  },
};
