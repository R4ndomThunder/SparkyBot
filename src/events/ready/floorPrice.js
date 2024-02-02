const { EmbedBuilder } = require('discord.js')
const NFT = require('../../models/nft.js')
const cron = require("cron");
const axios = require('axios')

module.exports = async (client, c) => {
    let scheduleFloorPriceChecker = new cron.CronJob("*/2 * * * *", async () => {
        const nfts = await NFT.find({ eventType: 'floor' })

        console.log('Checking floor price...')

        nfts.forEach(async (data, i) => {
            setTimeout(async () => {
                const req = {
                    method: 'GET',
                    url: `https://api.opensea.io/api/v1/collection/${data.collectionName}`,
                    headers: {
                        'X-API-KEY': process.env.OPENSEA_TOKEN,
                        'Accept': 'application/json'
                    }
                }

                const response = await axios.request(req).catch(err => { console.error(err) });
                // console.log(response.data)
                if (response) {
                    const floorPrice = response.data.collection.stats.floor_price
                    if (data.floorPrice != floorPrice || !data.floorPrice) {
                        await NFT.updateOne({ collectionName: data.collectionName, eventType: data.eventType }, { floorPrice: floorPrice })
                        if (data.floorPrice) {
                            const embed = new EmbedBuilder()
                                .setAuthor({ name: 'New floor price' })
                                .setTitle(response.data.collection.name)
                                .setThumbnail(response.data.collection.image_url)
                                .setURL(`https://opensea.io/collection/${data.collectionName}`)
                                .setImage(response.data.collection.large_image_url)
                                .setColor('Random')
                                .addFields(
                                    // { name: 'Collection', value: data.collectionName, inline: true },
                                    { name: 'Floor price', value: `${floorPrice}`, inline: true },
                                    { name: 'Is decreased?', value: (data.floorPrice > floorPrice ? ':white_check_mark:' : '<:redcross:1155136517048647810>'), inline: true })
                                .setTimestamp()

                            const guild = await c.guilds.fetch(data.guildId)
                            const channel = await guild.channels.fetch(data.channelId)

                            await channel.send({ content: `||@here||`, embeds: [embed] })
                        }
                    }
                }
            }, i * 1500)
        })

    })


    scheduleFloorPriceChecker.start()
}