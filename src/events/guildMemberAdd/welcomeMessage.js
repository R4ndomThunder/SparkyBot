const { Client, EmbedBuilder } = require("discord.js");
const Welcome = require("../../models/welcome.js");

module.exports = async (member) => {
  const data = await Welcome.findOne({ guildId: member.guild.id });

  if (data) {
    const channel = member.guild.channels.cache.get(data.channelId);
    channel.send(
      String(data.message).replace("{user}", "<@" + member.id + ">")
    );
  }
};
