const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const ReactionRoles = require("../../models/reactionRoles.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("reaction-roles")
    .setDescription("Manage a reaction role message")
    .addSubcommand((command) =>
      command
        .setName("set")
        .setDescription("Setup a reaction role")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The message that you want setup")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji that you want to set")
            .setRequired(true)
        )
        .addRoleOption((option) =>
          option
            .setName("role")
            .setDescription("The role that you want to give")
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("remove")
        .setDescription("Remove a reaction role from message")
        .addStringOption((option) =>
          option
            .setName("message-id")
            .setDescription("The  message that you want to edit")
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("emoji")
            .setDescription("The emoji that you want to remove")
            .setRequired(true)
        )
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  options: {
    deleted: false,
  },
  run: async ({ interaction, client }) => {
    const { options, guild, channel } = interaction;

    const sub = options.getSubcommand();

    const msgId = options.getString("message-id");
    const msg = await channel.messages
      .fetch(msgId)
      .catch((err) => console.error(err));
    const emoji = options.getString("emoji");

    const data = await ReactionRoles.findOne({
      guildId: guild.id,
      messageId: msgId,
      emoji: emoji,
    });
    try {
      switch (sub) {
        case "set":
          if (data) {
            return await interaction.reply({
              content: "You are already using this emoji for this message",
              ephemeral: true,
            });
          } else {
            const role = options.getRole("role");
            await ReactionRoles.create({
              guildId: guild.id,
              messageId: msgId,
              emoji: emoji,
              roleId: role.id,
            });
            const embed = new EmbedBuilder()
              .setColor(0x223f98)
              .setTitle("Reaction role setup")
              .setDescription("Your role has been set")
              .addFields(
                { name: "Emoji", value: `${emoji}` },
                { name: "Role", value: `<@&${role.id}>` }
              )
              .setTimestamp();

            await msg.react(emoji).catch((err) => {
              console.error(err);
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
          }
          break;
        case "remove":
          if (!data)
            return await interaction.reply({
              content: "No role assigned to this emoji",
              ephemeral: true,
            });
          else {
            const role = data.roleId;

            const embed = new EmbedBuilder()
              .setColor(0x223f98)
              .setTitle("Reaction role setup")
              .setDescription("Your role has been removed")
              .addFields(
                { name: "Emoji", value: `${emoji}` },
                { name: "Role", value: `<@&${role}>` }
              )
              .setTimestamp();

            await ReactionRoles.deleteMany({
              guildId: guild.id,
              messageId: msgId,
              emoji: emoji,
            });

            await interaction.reply({ embeds: [embed], ephemeral: true });
          }

          break;
      }
    } catch (err) {
      console.error(err);
    }
  },
};
