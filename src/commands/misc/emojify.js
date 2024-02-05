const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("emojify")
    .setDescription("Change text to emojis")
    .addStringOption((option) =>
      option
        .setName("text")
        .setDescription("The text to convert")
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(2000)
    )
    .addStringOption((option) =>
      option
        .setName("hidden")
        .setDescription("Hide this message?")
        .setChoices(
          { name: "Hidden", value: "true" },
          { name: "Not Hidden", value: "false" }
        )
        .setRequired(false)
    ),
  run: async ({ client, interaction }) => {
    const { options } = interaction;
    const text = options.getString("text");
    var hidden = options.getString("hidden") == "true" || false;

    var emojiText = text
      .toLowerCase()
      .split("")
      .map((letter) => {
        const regex = /^[A-Za-z]+$/;
        if (letter == " ") return " ";

        if (regex.test(letter)) return `:regional_indicator_${letter}:`;
        else return letter;
      })
      .join("");

    if (emojiText.length >= 2000)
      emojiText = "I cant emojify this text-- it is to long!";

    await interaction.reply({ content: emojiText, ephemeral: hidden });
  },
};
