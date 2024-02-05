const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionsBitField,
  } = require("discord.js");
  const Captcha = require("../../models/captcha.js");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("captcha")
      .setDescription("Setup the captcha verification system.")
      .addSubcommand((command) =>
        command
          .setName("setup")
          .setDescription("Setup the captcha verification system")
          .addRoleOption((option) =>
            option
              .setName("role")
              .setDescription("The role you want to be given on verification")
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName("disable")
          .setDescription("Disable the captcha verification system")
      )
      .setDefaultMemberPermissions(PermissionsBitField.Administrator)
      .setDMPermission(false),
    run: async ({ client, interaction }) => {
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      )
        return await interaction.reply({
          content: "You must have Admin to set a welcome channel",
        });
  
      const Data = await Captcha.findOne({ guildId: interaction.guild.id });
  
      const { options } = interaction;
      const sub = options.getSubcommand();
  
      switch (sub) {
        case "setup":
          if (Data)
            return await interaction.reply({
              content: "The captcha system is already setup here!",
              ephemeral: true,
            });
  
          const role = options.getRole("role");
          await Captcha.create({
            guildId: interaction.guild.id,
            role: role.id,
          });
          const embed = new EmbedBuilder()
            .setColor(0x223f98)
            .setDescription(
              ":white_check_mark: The captcha system has been setup!"
            );
  
          await interaction.reply({ embeds: [embed] });
          break;
        case "disable":
          if (!Data)
            return await interaction.reply({
              content: "There is no captcha verification system setup here!",
              ephemeral: true,
            });
  
          await Captcha.deleteMany({ guildId: interaction.guild.id });
  
          const embed2 = new EmbedBuilder()
            .setColor(0x223f98)
            .setDescription(
              ":white_check_mark:  The captcha system has been disabled!"
            );
          await interaction.reply({ embeds: [embed2] });
  
          break;
      }
    },
  };
  