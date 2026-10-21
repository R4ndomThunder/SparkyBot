const { MessageFlags } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction) {
    // Autocomplete powers `/social remove|pause|resume|test` feed selection.
    if (interaction.isAutocomplete()) {
      const command = interaction.client.commands.get(interaction.commandName);
      try {
        if (command?.autocomplete) await command.autocomplete(interaction);
        else await interaction.respond([]);
      } catch (err) {
        console.error(`[interaction] autocomplete error in ${interaction.commandName}`, err);
        await interaction.respond([]).catch(() => {});
      }
      return;
    }

    // Buttons/select menus route to the command owning the customId prefix.
    // Modals use the same registry (e.g. the Itch.io API key form).
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
      const handlers = interaction.client.componentHandlers;
      if (!handlers) return;
      for (const [prefix, command] of handlers) {
        if (!interaction.customId.startsWith(prefix)) continue;
        const isModal = interaction.isModalSubmit();
        if (isModal && typeof command.onModal !== "function") continue;
        try {
          if (isModal) await command.onModal(interaction);
          else await command.onComponent(interaction);
        } catch (err) {
          console.error(`[interaction] component error in ${interaction.customId}`, err);
          const payload = {
            content: isModal
              ? "Qualcosa è andato storto."
              : "Qualcosa è andato storto con questa partita.",
            flags: MessageFlags.Ephemeral,
          };
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp(payload).catch(() => {});
          } else {
            await interaction.reply(payload).catch(() => {});
          }
        }
        return;
      }
      return;
    }

    // Covers both slash commands and context menu (user/message) commands.
    if (!interaction.isCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
      console.warn(`[interaction] unknown command ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`[interaction] error in ${interaction.commandName}`, err);
      const payload = {
        content: "Something went wrong.",
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    }
  },
};
