const {
  ApplicationCommandType,
  PermissionsBitField,
  ContextMenuCommandBuilder,
} = require("discord.js");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("Clone Message")
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .setDMPermission(false),
  options: {
    deleted: false,
  },
  run: async (interaction) => {},
};
