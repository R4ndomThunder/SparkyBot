const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Report an user')       
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers),
    options:
    {
        deleted: true
    },
    run: async ({ interaction, client }) => {
       
    }
}