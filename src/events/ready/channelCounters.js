const ChannelCounters = require("../../models/channelCounter.js");
const cron = require("cron");
require('core-js/actual')
const axios = require('axios')

const online = { name: '🟢 Online', value: 'online' }
const idle = { name: '🌙 Idle', value: 'idle' }
const dnd = { name: '🔴 Do Not Disturb', value: 'dnd' }
const offline = { name: '⚫ Offline', value: 'offline' }

module.exports = async (client, c) => {
    let scheduleChannelCountersUpdate = new cron.CronJob("*/15 * * * *", async () => {
        const guilds = await ChannelCounters.find()
        console.log("Updating channels...")

        guilds.forEach(async (guildData, i) => {
            const guild = await c.guilds.fetch(guildData.guildId)
            const nfts = guildData.counters.filter(c => c.counterType === 'total-sales' || c.counterType === 'market_cap' || c.counterType === 'num_owners' || c.counterType === 'floor')
            const standards = guildData.counters.filter(c => !(c.counterType === 'total-sales' || c.counterType === 'market_cap' || c.counterType === 'num_owners' || c.counterType === 'floor'))
            await getChannelName(guild, standards)

            const grouped = Map.groupBy(nfts, counter => {
                return counter.value
            })

            await getNFTData(guild, grouped)
        });
    });

    scheduleChannelCountersUpdate.start()
};

async function getChannelName(guild, counters) {
    counters.forEach(async (data, i) => {
        setTimeout(async () => {
            const guildMembers = await guild.members.fetch();

            await guild.channels.fetch(data.channelId).then(async (channel) => {
                if (!channel) return;

                try {
                    console.log(new Date())
                    if (data.counterType == 'allmembers') {
                        await channel.setName(`Members: ${guildMembers.size}`)
                    }

                    if (data.counterType == 'onlymembers') {
                        const count = await guildMembers.filter(member => !member.user.bot)
                        await channel.setName(`Users: ${count.size}`)
                    }

                    if (data.counterType == 'onlybots') {
                        const count = await guildMembers.filter(member => member.user.bot)
                        await channel.setName(`Bots: ${count.size}`)
                    }

                    if (data.counterType == 'role') {
                        const role = await guild.roles.fetch(data.value)

                        if (role) {
                            const members = await role.members
                            const count = members.size;
                            await channel.setName(`${role.name}: ${count}`)
                        }
                    }

                    if (data.counterType == 'status') {
                        let count = await guildMembers

                        let name = ''

                        if (data.value == online.value) {
                            name = "Online"
                            count = await guildMembers.filter(member => member.presence?.status == online.value)
                        }
                        else if (data.value == idle.value) {
                            name = "Idle"
                            count = await guildMembers.filter(member => member.presence?.status == idle.value)
                        } else if (data.value == dnd.value) {
                            name = "Do not disturb"
                            count = await guildMembers.filter(member => member.presence?.status == dnd.value)
                        } else if (data.value == offline.value) {
                            name = "Offline"
                            count = await guildMembers.filter(member => member.presence?.status == offline.value || !member.presence)
                        }

                        await channel.setName(`${name}: ${count.size}`)
                    }
                }
                catch (err) {
                    console.error(err)
                }
            })
        }, i * 1000)
    })

}

async function getNFTData(guild, collections) {

    for (let [data, collection] of collections.entries()) {
        setTimeout(async () => {
            const req = {
                method: 'GET',
                url: `https://api.opensea.io/api/v1/collection/${data}/stats`,
                headers: {
                    'X-API-KEY': process.env.OPENSEA_TOKEN,
                    'Accept': 'application/json'

                }
            }

            const response = await axios.request(req).catch(err => { console.error(err) });
            
            collection.forEach(async (cData) => {

                const channel = await guild.channels.fetch(cData.channelId);

                if (cData.counterType == 'floor') {
                    try {
                        await channel.setName(`Floor price: ${response.data.stats.floor_price}`)
                    }
                    catch (err) {
                        console.error(err)
                    }
                }

                if (cData.counterType == 'total-sales') {
                    await channel.setName(`Total Sales: ${response.data.stats.total_sales}`)
                }

                if (cData.counterType == 'market_cap') {
                    try {
                        await channel.setName(`Market Cap: ${parseFloat(response.data.stats.market_cap).toFixed(2)}`)
                    }
                    catch (err) {
                        console.error(err)
                    }
                }

                if (cData.counterType == 'num_owners') {
                    try {
                        await channel.setName(`Owners: ${response.data.stats.num_owners}`)
                    }
                    catch (err) {
                        console.error(err)
                    }
                }
            })
        }, 2000)
    }
}