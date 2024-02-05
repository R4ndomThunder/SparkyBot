const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('slowmode')
        .setDescription('Toggle slowmode for a channel.')
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('The time of the slowmode (set to 0 to disable)')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('The channel you  want to set the slowmode of')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const { options } = interaction;

        const duration = options.getInteger('duration')
        const channel = options.getChannel('channel') || interaction.channel

        const embed = new EmbedBuilder()
            .setColor(0x223f98)
            .setDescription(`:white_check_mark: ${channel} now has ${duration} seconds of **slowmode**`)

        channel.setRateLimitPerUser(duration).catch(err => {
            return
        })

        await interaction.reply({ embeds: [embed] })
    }
}