const { ChannelType } = require("discord.js");
const autopublish = require("../../models/autopubblish.js");

module.exports = async (message, client) => {

    if (message.partial) {
        try {
            await message.fetch();
        } catch (e) {
            console.error(`Something went wrong when fetching the message: ${e}`);
        }
    }

    if (message.channel.type !== ChannelType.GuildAnnouncement) return;

    if (message.author.bot) return;
    if (message.content.startsWith('.')) return;

    const data = await autopublish.findOne({ guildId: message.guild.id })

    if (!data) return;
    if (!data.channels.includes(message.channel.id)) return;

    try {
        message.crosspost();
    }
    catch (e) {
        console.error(e)
    }
};
