const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ChannelType } = require("discord.js");
const NFT = require('../../models/nft.js');
const EventEmitter = require('events')

const emitter = require('../../eventHandler.js').emitter;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nft')
        .setDescription('Manage NFT alerts')
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(command =>
            command
                .setName('setup')
                .setDescription('Setup NFT alerts')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel where publish NFT updates')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('event')
                        .setDescription('The type of event that you want to disable')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Buying and selling', value: 'sales' },
                            { name: 'Someone make an offer', value: 'offers' },
                            { name: 'Listing', value: 'listing' },
                            { name: 'Floor price', value: 'floor' },
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('collection')
                        .setDescription('The Id of the nft collection to follow')
                        .setRequired(true)
                )
        )
        .addSubcommand(command =>
            command
                .setName('disable')
                .setDescription('Disable NFT alerts')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Channel where publish NFT updates')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('event')
                        .setDescription('The type of event that you want to disable')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Buying and selling', value: 'sales' },
                            { name: 'Someone make an offer', value: 'offers' },
                            { name: 'Listing', value: 'listing' },
                            { name: 'Floor price', value: 'floor' },
                        )
                )
                .addStringOption(option =>
                    option
                        .setName('collection')
                        .setDescription('The Id of the nft collection')
                        .setRequired(true)
                )
        ),
    options:
    {
        deleted: true,
        devOnly: true
    },
    run: async ({ interaction, client }) => {
        const { options } = interaction
        const sub = options.getSubcommand()

        const collection = options.getString('collection')
        const event = options.getString('event')
        const channel = options.getChannel('channel')

        switch (sub) {
            case 'setup': {
                let data = await NFT.findOne({ guildId: interaction.guild.id, eventType: event, collectionName: collection, channelId: channel.id })
                if (!data) {
                    data = await NFT.create({ guildId: interaction.guild.id, eventType: event, collectionName: collection, channelId: channel.id })

                    const embed = new EmbedBuilder()
                        .setTitle(':white_check_mark: Collection added successfully')
                        .setColor('Green')
                        .addFields({ name: 'Collection', value: collection, inline: true }, { name: 'Event', value: event, inline: true }, { name: 'Channel', value: channel.name, inline: true })
                        .setTimestamp()

                    await interaction.reply({ embeds: [embed], ephemeral: true })

                    await data.save();
                }
                else {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ Error on adding collection')
                        .setDescription('`This collection is already listening on this channel`')
                        .setColor('Red')
                        .addFields({ name: 'Collection', value: collection, inline: true }, { name: 'Event', value: event, inline: true }, { name: 'Channel', value: channel.name, inline: true })
                        .setTimestamp()

                    await interaction.reply({ embeds: [embed], ephemeral: true })
                }
            }
                break;
            case 'disable':
                {
                    let data = await NFT.findOne({ guildId: interaction.guild.id, eventType: event, collectionName: collection, channelId: channel.id })
                    if (!data) {

                    } else {
                        await NFT.deleteOne({ guildId: interaction.guild.id, eventType: event, collectionName: collection, channelId: channel.id })

                        const embed = new EmbedBuilder()
                            .setTitle(':white_check_mark: Collection removed successfully')
                            .setColor('Green')
                            .addFields({ name: 'Collection', value: collection, inline: true }, { name: 'Event', value: event, inline: true }, { name: 'Channel', value: channel.name, inline: true })
                            .setTimestamp()

                        await interaction.reply({ embeds: [embed], ephemeral: true })
                    }
                }
                break;
        }
        
        emitter.emit('NFTUpdate')
    }
}