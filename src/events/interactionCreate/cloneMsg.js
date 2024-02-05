const clone = require("discord-cloner");

module.exports = async (interaction, client) => {
  if (!interaction.isMessageContextMenuCommand()) return;

  if (interaction.commandName == "Clone Message") {
    if (interaction.member.id != "248175154566266880")
      if (
        !interaction.member.permissions.has(
          PermissionsBitField.Flags.Administrator
        )
      )
        return await interaction.channel.send({
          content: "This is an admin only command.",
          ephemeral: true,
        });

    const message = await interaction.channel.messages.fetch(
      interaction.targetId
    );
    const channel = interaction.channel;
    try {
      await clone.cloneMsg({ message: message, channel: channel, spoof: true });
    } catch (err) {
      return await interaction.channel.send({
        content:
          "There was an **error** while cloning your message: " + err.message,
        ephemeral: true,
      });
    }

    await interaction.channel.send({
      content: "**Successfully** cloned your message",
      ephemeral: true,
    });
  }
};
