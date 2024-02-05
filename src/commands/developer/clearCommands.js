const {
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear-commands")
    .setDescription("Remove commands!")
    .addSubcommand((s) =>
      s.setName("global").setDescription("Remove all global commands")
    )
    .addSubcommand((s) =>
      s.setName("guild").setDescription("Remove all guild commands")
    ),
  options: { devOnly: true },
  run: async ({ interaction, client }) => {
    await interaction.deferReply();

    const rest = new REST().setToken(process.env.TOKEN);

    const sub = interaction.options.getSubcommand();

    switch (sub) {
      case "global":
        rest
        .put(Routes.applicationCommands("1149480539175268423"), { body: [] })
        .then(() => console.log("Successfully deleted all application commands."))
        .catch(console.error);
        break;
      case "guild":
        client.guilds.cache.forEach(guild => {
          rest.put(Routes.applicationGuildCommands("1149480539175268423", guild.id), { body: [] })
          .then(() => console.log('Successfully deleted all guild commands.'))
          .catch(console.error);         
        });
        break;
    }
    

    const embed = new EmbedBuilder()
      .setColor(0x223f98)
      .setTitle(`✅ **All commands has been cleared**`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
