const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const superagent = require("superagent");
const onlyEmoji = require("emoji-aware").onlyEmoji;

module.exports = {
  data: new SlashCommandBuilder()
    .setName("emojimixer")
    .setDescription("Combine two emoji")
    .addStringOption((option) =>
      option
        .setName("emojis")
        .setDescription("The emojis to combine")
        .setRequired(true)
    ),
  run: async ({ client, interaction }) => {
    await interaction.deferReply();

    const { options } = interaction;
    const eString = options.getString("emojis");
    const input = onlyEmoji(eString);
    const response = `⚠️ One or both of these emojis (${eString}) are not supported. Keep in mind that gestures and custom server emojis are not supported.`;
    const output = await superagent
      .get("https://tenor.googleapis.com/v2/featured")
      .query({
        key: process.env.TENOR_TOKEN,
        contentfilter: "high",
        media_filter: "png_transparent",
        component: "proactive",
        collection: "emoji_kitchen_v5",
        q: input.join("_"),
      })
      .catch((err) => {});

    if (!output) return await interaction.editReply({ content: response });
    else if (!output.body.results[0])
      return await interaction.editReply({ content: response });
    else if (eString.startsWith("<") || eString.endsWith(">"))
      return await interaction.editReply({ content: response });

    const embed = new EmbedBuilder()
      .setColor(0x223f98)
      .setImage(output.body.results[0].url);

    await interaction.editReply({ embeds: [embed] });
  },
}; 
