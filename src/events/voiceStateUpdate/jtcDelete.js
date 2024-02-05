const { EmbedBuilder } = require("discord.js");
const JTC = require("../../models/JTC.js");
const JTCChannel = require("../../models/JTCChannel.js");

module.exports = async (oldState, newState) => {
  try {
    if (oldState.member.guild === null) return;
  } catch (err) {
    return console.error(err);
  }

  const leaveChannelData = await JTCChannel.findOne({
    guildId: oldState.member.guild.id,
    userId: oldState.member.id,
  });

  if (leaveChannelData) {
    const voiceChannel = await oldState.member.guild.channels.cache.get(
      leaveChannelData.channelId
    );

    try {
      await voiceChannel.delete();
    } catch (err) {
      return console.error(err);
    }

    await JTCChannel.deleteMany({
      guildId: oldState.guild.id,
      userId: oldState.member.id,
    });
    try {
      const embed = new EmbedBuilder()
        .setColor(0x223f98)
        .setTimestamp()
        .setAuthor({ name: `🔊 Join to Create System` })
        .setFooter({ text: `🔊 Channel Deleted` })
        .setTitle(`> Channel Deleted`)
        .addFields({
          name: `Channel Deleted`,
          value: `Your voice channel has been \n deleted in **${newState.member.guild.name}**`,
        });

      await newState.member.send({ embeds: [embed] });
    } catch (err) {
      return console.error(err);
    }
  }
};
