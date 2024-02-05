const {
  TextInputBuilder,
  ModalBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const Ticket = require("../../models/ticket.js");

module.exports = async (interaction) => {
  try {
    if (interaction.isButton()) return;
    if (interaction.isChatInputCommand()) return;
    if (interaction.isMessageContextMenuCommand()) return;

    const modal = new ModalBuilder()
      .setTitle("Provide us with more information")
      .setCustomId("ticketModal");

    const username = new TextInputBuilder()
      .setCustomId("username")
      .setRequired(true)
      .setLabel("Provide us with your username")
      .setPlaceholder("This is your username")
      .setStyle(TextInputStyle.Short);

    const reason = new TextInputBuilder()
      .setCustomId("reason")
      .setRequired(true)
      .setLabel("The reason for this ticket")
      .setPlaceholder("Give us a reason for opening this ticket")
      .setStyle(TextInputStyle.Paragraph);

    const secondActionRow = new ActionRowBuilder().addComponents(username);
    const thirdActionRow = new ActionRowBuilder().addComponents(reason);

    modal.addComponents(secondActionRow, thirdActionRow);

    let choices;
    if (interaction.isStringSelectMenu()) {
      choices = interaction.values;

      const result = choices.join("");
      const data = await Ticket.findOne({ guildId: interaction.guild.id });

      if (data) {
        const filter = { guildId: interaction.guild.id };
        const update = { ticket: result };

        await Ticket.updateOne(filter, update, {
          new: true,
        }).then((value) => {
          console.log(value);
        });
      }
    }

    if (!interaction.isModalSubmit()) {
      interaction.showModal(modal);
    }
  } catch (e) {
    console.error(e);
  }
};
