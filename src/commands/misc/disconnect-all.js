const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, GuildMemberFlagsBitField } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('disconnect-all')
        .setDescription('Disconnect all users from a voice channel')
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel you want to disconnect users from')
                .setRequired(false)
                .addChannelTypes(ChannelType.GuildVoice)
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const { options } = interaction;

        const channel = options.getChannel('channel') || interaction.member.voice.channel;

        const members = channel.members;

        members.forEach((member) => {
            member.voice.disconnect();
        });

        const embed = new EmbedBuilder()
            .setColor('Blurple')
            .setDescription(`:white_check_mark: Kicked **${members.size}** users`)

        await interaction.reply({ embeds: [embed], ephemeral: true })
    }
}