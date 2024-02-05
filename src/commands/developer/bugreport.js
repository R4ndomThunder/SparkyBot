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
    .setName("bug")
    .setDescription("Report a bug to the developer."),
  options: {},
  run: async ({ interaction, client }) => {
    try {
      const modal = new ModalBuilder()
        .setTitle("Bug report")
        .setCustomId("bugreport");

      const command = new TextInputBuilder()
        .setCustomId("command")
        .setRequired(true)
        .setPlaceholder("Please only state the command name")
        .setLabel("Which command has a bug?")
        .setStyle(TextInputStyle.Short);

      const description = new TextInputBuilder()
        .setCustomId("description")
        .setRequired(true)
        .setPlaceholder(
          "Be sure to be as detailed as possible so the devs can take action"
        )
        .setLabel("Describe the bug you're facing")
        .setStyle(TextInputStyle.Paragraph);

      const one = new ActionRowBuilder().addComponents(command);
      const two = new ActionRowBuilder().addComponents(description);

      modal.addComponents(one, two);

      await interaction.showModal(modal);

      //Wait for submission
      const filter = (interaction) => interaction.customId === "bugreport";

      interaction
        .awaitModalSubmit({ filter, time: 30_000 })
        .then(async (modalInteraction) => {
          const command = modalInteraction.fields.getTextInputValue("command");
          const description =
            modalInteraction.fields.getTextInputValue("description");

            const id = interaction.user.id;
            const member = interaction.member;        
            const server = interaction.guild.name || "No server provided";        
            const channel = await client.channels.cache.get(process.env.BUGREPORT_LOG_CHANNEL_ID);

            const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("⚠️ Bug report ⚠️")
            .addFields({ name: "User ID", value: "> " + id})
            .addFields({ name: "Member", value: "> <@" + member + ">" })
            .addFields({ name: "Server ID", value: "> " + server })
            .addFields({ name: "Command Reported", value: "> " + command })
            .addFields({ name: "Reported Description", value: "> " + description })
            .setTimestamp()
            .setFooter({ text: "Report bug system" });
      
          await channel.send({ embeds: [embed] }).catch((err) => {
            console.log("Error on bug report: " + err);
          });

          modalInteraction.reply({
            content: "Your report has been submitted",
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
