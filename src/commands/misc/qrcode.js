const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

const axios = require("axios");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("qrcode")
    .setDescription("Create a QR Code")

    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("Url of the QR Code")
        .setRequired(true)
    ),

  run: async ({ client, interaction }) => {
    await interaction.deferReply({ ephemeral: true });

    const { options } = interaction;
    const url = options.getString("url");

    const input = {
        method: 'GET',
        url: 'https://codzz-qr-cods.p.rapidapi.com/getQrcode',
        params:{
            type:'url',
            value: url
        },
        headers: {
            'X-RapidAPI-Key': 'b6518a8106msh09d0f5e3e7c16c6p1127dajsn51be901ab68c',
            'X-RapidAPI-Host': 'codzz-qr-cods.p.rapidapi.com'
        }
    }

    try {
      const output = await axios.request(input);
      const embed = new EmbedBuilder()
        .setColor(0x223f98)
        .setImage(output.data.url);

      await interaction.editReply({ embeds: [embed] });
    } catch (e) {
      console.log(e);
      await interaction.editReply("URL not valid, try  with a different one");
    }
  },
};
