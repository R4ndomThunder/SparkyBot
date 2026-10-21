const { EmbedBuilder } = require("discord.js");

const truncate = (text, max) => {
  const t = String(text || "");
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

/** Resolve a channel id to a sendable text channel (cache first, then fetch). */
async function resolveChannel(client, channelId) {
  const cached = client.channels.cache.get(channelId);
  if (cached) return cached;
  try {
    return await client.channels.fetch(channelId);
  } catch {
    return null;
  }
}

function buildEmbed(provider, item) {
  const embed = new EmbedBuilder()
    .setColor(provider.color)
    .setURL(item.url || null)
    .setFooter({ text: provider.label })
    .setTimestamp(item.timestamp ? new Date(item.timestamp) : null);

  if (item.title) embed.setTitle(truncate(item.title, 256));
  if (item.description) embed.setDescription(truncate(item.description, 4096));
  if (item.author) embed.setAuthor({ name: truncate(item.author, 256) });
  if (item.image) embed.setImage(item.image);
  if (Array.isArray(item.fields) && item.fields.length) {
    embed.addFields(
      item.fields
        .filter((f) => f && f.name && f.value)
        .map((f) => ({ name: truncate(f.name, 256), value: truncate(f.value, 1024), inline: Boolean(f.inline) }))
    );
  }
  return embed;
}

/**
 * Send one feed item into the configured channel.
 * Content = optional role ping + optional custom message from the feed config.
 * `allowedMentions` keeps everything else (even @everyone in custom text) silent.
 */
async function sendItem(client, feed, item, provider) {
  const channel = await resolveChannel(client, feed.channel_id);
  if (!channel) throw new Error(`canale ${feed.channel_id} inaccessibile`);
  if (typeof channel.send !== "function") {
    throw new Error(`canale ${feed.channel_id} non è un canale testuale`);
  }

  const payload = {
    embeds: [buildEmbed(provider, item)],
    allowedMentions: { parse: [] },
  };

  const parts = [];
  if (feed.mention_role_id) parts.push(`<@&${feed.mention_role_id}>`);
  if (feed.custom_message) parts.push(String(feed.custom_message));
  if (parts.length) payload.content = parts.join("\n").slice(0, 2000);
  if (feed.mention_role_id) {
    payload.allowedMentions = { parse: [], roles: [feed.mention_role_id] };
  }

  return channel.send(payload);
}

/**
 * Edit the Twitch live notification after the stream ends:
 * grey color, ": live conclusa" title, footer with duration.
 * Returns true when the message was edited.
 */
async function endLiveMessage(client, feed) {
  if (!feed.live_message_id) return false;
  const channel = await resolveChannel(client, feed.channel_id);
  if (!channel || typeof channel.messages?.fetch !== "function") return false;

  let message;
  try {
    message = await channel.messages.fetch(feed.live_message_id);
  } catch {
    return false; // message deleted or unreachable — nothing to update
  }
  if (!message) return false;

  const source = message.embeds?.[0];
  const embed = source ? EmbedBuilder.from(source.data ?? source) : new EmbedBuilder();

  const started = embed.data.timestamp ? Date.parse(embed.data.timestamp) : NaN;
  const minutes = Number.isNaN(started)
    ? null
    : Math.max(1, Math.round((Date.now() - started) / 60000));
  const title = embed.data.title || "Live";
  embed.setTitle(
    / è in live$/.test(title) ? `${title.replace(/ è in live$/, "")}: live conclusa` : `${title} · conclusa`
  );
  embed.setColor(0x95a5a6);
  embed.setFooter({
    text: minutes
      ? `Twitch · Live conclusa · durata ${fmtDuration(minutes)}`
      : "Twitch · Live conclusa",
  });

  await message.edit({ embeds: [embed] });
  return true;
}

function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

module.exports = { buildEmbed, resolveChannel, sendItem, endLiveMessage };
