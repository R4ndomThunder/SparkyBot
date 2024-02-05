const { ChannelType, EmbedBuilder } = require("discord.js");
const JTC = require("../../models/JTC.js");
const JTCChannel = require("../../models/JTCChannel.js");

module.exports = async (oldState, newState) => {
  try {
    if (newState.member.guild === null) return;
  } catch (err) {
    return console.error(err);
  }

  const joinData = await JTC.findOne({ guildId: newState.guild.id });
  const joinChannelData = await JTCChannel.findOne({
    guildId: newState.guild.id,
    userId: newState.member.id,
  });

  const voiceChannel = newState.channel;

  if (!joinData) return;
  if (!voiceChannel) return;

  if (voiceChannel.id === joinData.channelId) {
    if (joinChannelData) {
      try {
        return await newState.member.send({
          content: `You already have a voice channel open right now`,
          ephemeral: true,
        });
      } catch (err) {
        return console.error(err);
      }
    } else {
      try {
        const channel = await newState.member.guild.channels.create({
          type: ChannelType.GuildVoice,
          name: `${newState.member.user.displayName}-room`,
          userLimit: joinData.voiceLimit,
          parent: joinData.categoryId,
        });

        try {
          await newState.member.voice.setChannel(channel.id);
        } catch (err) {
          return console.log(err);
        }

        setTimeout(() => {
          JTCChannel.create({
            guildId: newState.member.guild.id,
            channelId: channel.id,
            userId: newState.member.id,
          });
        }, 500);
      } catch (err) {
        try {
          await newState.member.send({
            content: `I could not create your channel, maybe some missing permission`,
          });
        } catch (err) {
          return console.error(err);
        }
      }

      try {
        const embed = new EmbedBuilder()
          .setColor(0x223f98)
          .setTimestamp()
          .setAuthor({ name: `🔊 Join to Create System` })
          .setFooter({ text: `🔊 Channel Created` })
          .setTitle(`> Channel Created`)
          .addFields({
            name: `Channel Created`,
            value: `Your voice channel has been \n created in **${newState.member.guild.name}**`,
          });

        await newState.member.send({ embeds: [embed] });
      } catch (err) {
        return console.error(err);
      }
    }
  }
};
