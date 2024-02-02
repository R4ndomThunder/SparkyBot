const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder, ChannelType

} = require("discord.js");

const Users = require("../../models/user.js");
const GuildConfig = require("../../models/guildConfig.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("birthday")
    .setDescription("birthday party!")
    .addSubcommand((command) =>
      command
        .setName(`set`)
        .setDescription(`Set your birth date`)
        .addStringOption((option) =>
          option
            .setName("date")
            .setDescription("Your date of birth (yyyy-MM-dd)")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command.setName(`clear`).setDescription(`Clear your birth date`)
    )
    .setDMPermission(false),
  options: {
    deleted: false,
    devOnly: true,
  },
  run: async ({ interaction, client }) => {
    await interaction.deferReply();

    const { options } = interaction;

    const sub = options.getSubcommand();
    switch (sub) {
      case "set":
        const date = options.getString("date");

        let user = await Users.findOne({
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });

        if (!user) {
          user = await Users.create({
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          });
        }

        const parsedDate = new Date(date);
        user.birthDay = parsedDate.getDate();
        user.birthMonth = parsedDate.getMonth();
        user.birthYear = parsedDate.getFullYear();

        await user.save();

        let thisYearDate = new Date();
        thisYearDate.setMonth(parsedDate.getMonth());
        thisYearDate.setDate(parsedDate.getDate());

        if (thisYearDate < new Date()) {
          thisYearDate.setFullYear(thisYearDate.getFullYear() + 1);
        }

        const embed = new EmbedBuilder()
          .setTitle("Birthday set")
          .setColor("Aqua")
          .setDescription(
            `I'll wish <@${interaction.user.id}>'s **${thisYearDate.getFullYear() - parsedDate.getFullYear()
            }th** birthday, on **${thisYearDate.toLocaleDateString()}** 🎂`
          )
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        break;
      case "clear":
        let user2 = await Users.findOne({
          guildId: interaction.guild.id,
          userId: interaction.user.id,
        });

        if (!user2) {
          const embed2 = new EmbedBuilder()
            .setTitle("Birthday clear")
            .setColor("Red")
            .setDescription(`You haven't set your birthday yet`)
            .setTimestamp();

          return await interaction.editReply({ embeds: [embed2] });
        }

        user2.birthDay = undefined;
        user2.birthMonth = undefined;
        user2.birthYear = undefined;

        await user2.save();

        const embed2 = new EmbedBuilder()
          .setTitle("Birthday clear")
          .setColor("Aqua")
          .setDescription(`You birthday has been cleared`)
          .setTimestamp();

        return await interaction.editReply({ embeds: [embed2] });

        break;
    }
  },
};
