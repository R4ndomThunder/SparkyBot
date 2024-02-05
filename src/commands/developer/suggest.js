const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  EmbedBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("suggest")
    .setDescription("Suggest a feature to the developer."),
  options: {},
  run: async ({ interaction, client }) => {
    try {
      const modal = new ModalBuilder()
        .setTitle("Suggest a feature")
        .setCustomId("suggestModal");

      const description = new TextInputBuilder()
        .setCustomId("description")
        .setRequired(true)
        .setPlaceholder(
          "Be sure to be as detailed as possible so the devs can make it as you want"
        )
        .setLabel("Describe the feature that you want to see")
        .setStyle(TextInputStyle.Paragraph);

      const one = new ActionRowBuilder().addComponents(description);

      modal.addComponents(one);

      await interaction.showModal(modal);

      //Wait for submission
      const filter = (interaction) => interaction.customId === "suggestModal";

      interaction
        .awaitModalSubmit({ filter, time: 30_000 })
        .then(async (modalInteraction) => {
          const description =
            modalInteraction.fields.getTextInputValue("description");

            const id = interaction.user.id;
            const member = interaction.member;        
            const server = interaction.guild.name || "No server provided";        
            const channel = await client.channels.cache.get(process.env.SUGGEST_LOG_CHANNEL_ID);

            const embed = new EmbedBuilder()
            .setColor("DarkGold")
            .setTitle("🤓 Feature Suggested")
            .addFields({ name: "From", value: "> <@" + member + ">" })
            .addFields({ name: "Server ID", value: "> " + server })
            .addFields({ name: "Description", value: "> " + description })
            .setTimestamp()
            .setFooter({ text: "Suggestion system" });
      
          await channel.send({ embeds: [embed] }).catch((err) => {
            console.log("Error on suggestion report: " + err);
          });

          modalInteraction.reply({
            content: "Your suggestion has been submitted to the developer",
            ephemeral: true,
          });
        })
        .catch((err) => {
            console.error(err)
        });
    } catch (err) {
      console.error(err);
    }
  },
};
