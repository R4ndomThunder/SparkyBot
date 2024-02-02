const ReactionRoles = require("../../models/reactionRoles.js");

module.exports = async (reaction, user, client) => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (e) {
      console.error(`Something went wrong when fetching the message: ${e}`);
    }
  }

  if (!reaction.message.guildId) {
    return;
  }
  if (user.bot) {
    return;
  }

  let cId = `<:${reaction.emoji.name}:${reaction.emoji.id}>`;
  if (!reaction.emoji.id) cId = reaction.emoji.name;

  const data = await ReactionRoles.findOne({
    guildId: reaction.message.guildId,
    messageId: reaction.message.id,
    emoji: cId,
  });
  if (!data) {
    return;
  }

  const guild = await client.guilds.cache.get(reaction.message.guildId);
  const member = await guild.members.cache.get(user.id);

  try {
    await member.roles.remove(data.roleId);
  } catch (e) {
    console.log(e);
    return;
  }
};
