const { Client, EmbedBuilder } = require("discord.js");
const Leave = require("../../models/leave.js");

module.exports = async (member) => {
  const data = await Leave.findOne({ guildId: member.guild.id });

  if (data) {
    const channel = member.guild.channels.cache.get(data.channelId);
    channel.send(
      String(data.message).replace("{user}", "<@" + member.id + ">")
    );
  }
};
