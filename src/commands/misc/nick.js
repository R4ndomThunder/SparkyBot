const { SlashCommandBuilder, PermissionsBitField } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nick')
        .setDescription('Change the nickname of a user')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('User you want to change the nickname')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('new-nick')
                .setDescription('The new nickname to assign to')
                .setRequired(true)
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const { options } = interaction;

        await interaction.deferReply({ ephemeral: true })

        const target = options.getUser('target');
        const nick = options.getString('new-nick');

        if (!nick) await interaction.reply({ content: 'User not found', ephemeral: true })

        let user = await interaction.guild.members.fetch(target);
        await user.setNickname(nick)

        await interaction.editReply({ content: 'Nick changed', ephemeral: true })
    }
}