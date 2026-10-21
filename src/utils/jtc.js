const {
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} = require("discord.js");
const jtc = require("../db/jtc");

const NAME_MAX = 100;

/** Substitute supported placeholders in a name template. */
function formatChannelName(template, member, memberCount = 1) {
  const name = (template || jtc.DEFAULT_TEMPLATE)
    .replaceAll("{user}", member.user.username)
    .replaceAll("{display}", member.displayName || member.user.username)
    .replaceAll("{tag}", member.user.tag)
    .replaceAll("{count}", String(memberCount))
    .trim();

  return (name || member.user.username).slice(0, NAME_MAX);
}

const OWNER_PERMS = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.MoveMembers,
  PermissionFlagsBits.MuteMembers,
  PermissionFlagsBits.DeafenMembers,
  PermissionFlagsBits.Speak,
];

/**
 * Create the temporary voice channel for `member` and move them into it.
 * @returns {Promise<import("discord.js").VoiceChannel>}
 */
async function createTempChannel(guild, config, member) {
  const parent = config.category_id
    ? guild.channels.cache.get(config.category_id)
    : null;

  const channel = await guild.channels.create({
    name: formatChannelName(config.name_template, member),
    type: ChannelType.GuildVoice,
    parent: parent && parent.type === ChannelType.GuildCategory ? parent.id : undefined,
    userLimit: config.user_limit > 0 ? config.user_limit : undefined,
    reason: `Join-to-Create for ${member.user.tag}`,
    permissionOverwrites: [
      {
        id: member.id,
        type: OverwriteType.Member,
        allow: OWNER_PERMS,
      },
    ],
  });

  jtc.addTempChannel(channel.id, guild.id, member.id);
  return channel;
}

/**
 * Delete a temporary channel if it is empty and still registered.
 * Safe to call repeatedly (e.g. from a short debounce).
 */
async function deleteIfEmpty(channelId, guild) {
  if (!jtc.isTempChannel(channelId)) return false;

  const channel =
    guild.channels.cache.get(channelId) ??
    (await guild.channels.fetch(channelId).catch(() => null));

  if (!channel) {
    jtc.removeTempChannel(channelId);
    return false;
  }

  if (channel.members?.size > 0) return false;

  jtc.removeTempChannel(channelId);
  await channel.delete("Join-to-Create: channel is empty").catch(() => {});
  return true;
}

/** Names used in the `/jtc` command replies. */
const PLACEHOLDERS =
  "`{user}` username · `{display}` display name · `{tag}` username#discriminator · `{count}` member count";

module.exports = {
  formatChannelName,
  createTempChannel,
  deleteIfEmpty,
  PLACEHOLDERS,
};
