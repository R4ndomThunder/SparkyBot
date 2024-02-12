const { SlashCommandBuilder } = require("discord.js");
const { AutoPoster } = require("topgg-autoposter");
const { axios } = require("axios");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("topgg")
    .setDescription("Post stats to topgg"),
  options: {
    devOnly: true,
  },
  run: async ({client, interaction}) => 
  {
    await interaction.deferReply({ephemeral: true})

    const ap = AutoPoster(process.env.TOPGG_TOKEN, client)

    ap.on('posted', () => {
        interaction.editReply({content: 'Posted stats to top.gg!'})
    })

    ap.on('error', () => {
        interaction.editReply({content: 'Your post failed because of an error.'})
    })
  }
};
