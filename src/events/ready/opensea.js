const WebSocket = require('ws')
const { EmbedBuilder } = require('discord.js')
const { OpenSeaStreamClient, EventType } = require('@opensea/stream-js')
const NFT = require('../../models/nft.js')
const emitter = require('../../eventHandler.js').emitter;

const openSeaClient = new OpenSeaStreamClient(
    {
        token: process.env.OPENSEA_TOKEN,
        connectOptions: {
            transport: WebSocket
        }
    }
)

module.exports = async (client, c) => {
    await SetupNFT(client, c)

    emitter.on('NFTUpdate', async () => {
        openSeaClient.disconnect()
        try {
            await SetupNFT(client, c)
        }
        catch (e) { console.error(e) }
    })
};

async function SetupNFT(client, c) {
    const data = await NFT.find()
    if (data) {
        data.forEach(async (nftData) => {
            if (nftData.eventType === 'offers') {
                console.log('Offer setup for collection: ', nftData.collectionName)
                openSeaClient.onEvents(nftData.collectionName, [EventType.ITEM_RECEIVED_BID, EventType.ITEM_RECEIVED_OFFER], async (event) => {
                    const data = event.payload

                    const guild = await c.guilds.fetch(nftData.guildId)
                    const channel = await guild.channels.fetch(nftData.channelId)

                    // console.log(data)

                    try {
                        const embed = new EmbedBuilder()
                            .setTitle(data.item.metadata.name ?? data.collection.slug)
                            .setURL(data.item.permalink)
                            .setAuthor({ name: event.event_type == EventType.ITEM_RECEIVED_BID ? 'New bid' : 'New offer' })
                            .addFields({ name: 'Crypto', value: `**${parseFloat(data.payment_token.eth_price).toFixed(5)} ${data.payment_token.symbol}**`, inline: true }, { name: 'Flat', value: `**${parseFloat(data.payment_token.usd_price).toFixed(2)} USD**`, inline: true })
                            .setImage(data.item.metadata.animation_url ?? data.item.metadata.image_url)
                            .setColor('Random')
                            .setTimestamp()

                        await channel.send({ embeds: [embed] })

                    } catch (err) { console.error(err) }
                });
            }

            if (nftData.eventType === 'sales') {
                console.log('Sales setup for collection: ', nftData.collectionName)

                openSeaClient.onItemSold(nftData.collectionName, async (event) => {
                    const data = event.payload

                    const guild = await c.guilds.fetch(nftData.guildId)
                    const channel = await guild.channels.fetch(nftData.channelId)

                    try {
                        const embed = new EmbedBuilder()
                            .setTitle(data.item.metadata.name ?? data.collection.slug)
                            .setURL(data.item.permalink)
                            .setAuthor({ name: 'Item sold' })
                            .addFields({ name: 'Crypto', value: `**${parseFloat(data.payment_token.eth_price).toFixed(5)} ${data.payment_token.symbol}**`, inline: true }, { name: 'Flat', value: `**${parseFloat(data.payment_token.usd_price).toFixed(2)} USD**`, inline: true })
                            .setImage(data.item.metadata.animation_url ?? data.item.metadata.image_url)
                            .setColor('Random')
                            .setTimestamp()

                        await channel.send({ embeds: [embed] })

                    } catch (err) { console.error(err) }
                });
            }

            if (nftData.eventType === 'listing') {
                console.log('Listing setup for collection: ', nftData.collectionName)
                openSeaClient.onItemListed(nftData.collectionName, async (event) => {

                    const data = event.payload

                    const guild = await c.guilds.fetch(nftData.guildId)
                    const channel = await guild.channels.fetch(nftData.channelId)

                    try {
                        const embed = new EmbedBuilder()
                            .setTitle(data.item.metadata.name ?? data.collection.slug)
                            .setURL(data.item.permalink)
                            .setAuthor({ name: 'New item listed' })
                            .addFields({ name: 'Crypto', value: `**${parseFloat(data.payment_token.eth_price).toFixed(5)} ${data.payment_token.symbol}**`, inline: true }, { name: 'Flat', value: `**${parseFloat(data.payment_token.usd_price).toFixed(2)} USD**`, inline: true })
                            .setImage(data.item.metadata.animation_url ?? data.item.metadata.image_url)
                            .setColor('Random')
                            .setTimestamp()

                        await channel.send({ embeds: [embed] })

                    } catch (err) { console.error(err) }

                });
            }

        })
    }
}