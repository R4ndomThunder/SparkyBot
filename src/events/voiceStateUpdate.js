const { ChannelType } = require("discord.js");
const jtcDb = require("../db/jtc");
const { createTempChannel, deleteIfEmpty } = require("../utils/jtc");

// Guards against creating two channels for the same user in quick succession.
const pending = new Set();
// Debounce timers for empty-channel cleanup, keyed by channel id.
const cleanupTimers = new Map();

async function handleHubJoin(oldState, newState) {
  const guild = newState.guild;
  const member = newState.member;
  if (!member || member.user?.bot) return;

  const config = jtcDb
    .configsByHubChannel(newState.channelId)
    .find((c) => c.guild_id === guild.id && c.enabled);

  if (!config) return;
  if (newState.channel?.type !== ChannelType.GuildVoice) return;

  const lockKey = `${guild.id}:${member.id}`;
  if (pending.has(lockKey)) return;
  pending.add(lockKey);

  try {
    const channel = await createTempChannel(guild, config, member);
    await member.voice.setChannel(channel, "Join-to-Create").catch(() => {});
    console.log(`[jtc] created ${channel.name} (${channel.id}) for ${member.user.tag}`);
  } catch (err) {
    console.error("[jtc] create failed:", err?.message || err);
  } finally {
    pending.delete(lockKey);
  }
}

function scheduleCleanup(channelId, guild) {
  const existing = cleanupTimers.get(channelId);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    cleanupTimers.delete(channelId);
    try {
      const deleted = await deleteIfEmpty(channelId, guild);
      if (deleted) console.log(`[jtc] deleted empty channel ${channelId}`);
    } catch (err) {
      console.error("[jtc] cleanup failed:", err?.message || err);
    }
  }, 1500);

  if (typeof timer.unref === "function") timer.unref();
  cleanupTimers.set(channelId, timer);
}

module.exports = {
  name: "voiceStateUpdate",
  async execute(oldState, newState) {
    const guild = newState.guild ?? oldState.guild;
    if (!guild) return;

    // Someone joined/left a channel
    if (newState.channelId !== oldState.channelId) {
      if (newState.channelId) {
        await handleHubJoin(oldState, newState);
      }
      if (oldState.channelId) {
        scheduleCleanup(oldState.channelId, guild);
      }
    }
  },
};
