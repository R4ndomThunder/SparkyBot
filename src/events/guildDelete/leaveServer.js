const { EmbedBuilder } = require("discord.js");
const channelCounter = require("../../models/channelCounter");

module.exports = async (guild, client) => {
  const channel = await client.channels.cache.get(
    process.env.LEAVE_LOG_CHANNEL_ID
  );

  const name = guild.name;
  const memberCount = guild.memberCount;
  const ownerId = guild.ownerId;

  await channelCounter.deleteMany({ guildId: guild.id });

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("Rimosso da un server")
    .addFields(
      { name: "Server Name", value: `> ${name}`, inline: true },
      { name: "Members", value: `> ${memberCount} members`, inline: true }
    )
    .addFields(
      { name: "Owner", value: `> <@${ownerId}>`, inline: true },
      {
        name: "Server Age",
        value: `> <t:${parseInt(guild.createdTimestamp / 1000)}:R>`,
        inline: true,
      }
    )
    .setTimestamp()
    .setFooter({ text: "Server leave" });

  await channel.send({ embeds: [embed] });
};
