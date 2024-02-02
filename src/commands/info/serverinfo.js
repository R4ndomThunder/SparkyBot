
const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Get server info/stats.')
        .setDMPermission(false),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const { guild } = interaction

        const date = new Date(interaction.guild.createdTimestamp)

        const owner = await guild.fetchOwner();
        const roles = await guild.roles.fetch();
        const channels = await guild.channels.fetch();
        let rolesList = []

        await roles.sort((a, b) => b.position - a.position).forEach(role => { rolesList.push(role.name) })

        const embed = new EmbedBuilder() 
            .setAuthor({
                name: guild.name,
                iconURL: guild.iconURL(),
                url: guild.url
            })
            .setThumbnail(`${guild.iconURL()}`)
            .addFields(
                { name: 'Owner', value: `${owner.displayName}`, inline: true },
                { name: 'Members', value: `${guild.memberCount}`, inline: true },
                { name: 'Roles', value: `${roles.size}`, inline: true }
            )
            .addFields(
                { name: 'Category Channels', value: `${channels.filter(c => c.type == ChannelType.GuildCategory).size}`, inline: true },
                { name: 'Text Channels', value: `${channels.filter(c => c.type == ChannelType.GuildText).size}`, inline: true },
                { name: 'Voice Channels', value: `${channels.filter(c => c.type == ChannelType.GuildVoice).size}`, inline: true }
            )
            .addFields(
                { name: 'Role List', value: `${rolesList.join(", ")}` }
            )
            .addFields(
                { name: 'Boost Count', value: `${guild.premiumSubscriptionCount} Boosts (Tier ${guild.premiumTier})` }
            )
            .setFooter({ text: `ID: ${guild.id} | Server Created` })
            .setTimestamp(guild.createdTimestamp)

        interaction.reply({ embeds: [embed] })
    }
}