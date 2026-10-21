const db = require("./index");

const stmts = {
  insert: db.prepare(`
    INSERT INTO social_feeds (guild_id, channel_id, platform, source, source_label, mention_role_id, custom_message, api_key, last_item_id, enabled, next_check)
    VALUES (@guild_id, @channel_id, @platform, @source, @source_label, @mention_role_id, @custom_message, @api_key, @last_item_id, 1, 0)
    ON CONFLICT(guild_id, platform, source, channel_id) DO UPDATE SET
      source_label    = excluded.source_label,
      mention_role_id = excluded.mention_role_id,
      custom_message  = excluded.custom_message,
      api_key         = excluded.api_key,
      updated_at      = unixepoch()
  `),
  byId: db.prepare("SELECT * FROM social_feeds WHERE id = ?"),
  byGuild: db.prepare("SELECT * FROM social_feeds WHERE guild_id = ? ORDER BY platform, source"),
  byKey: db.prepare(
    "SELECT * FROM social_feeds WHERE guild_id = ? AND platform = ? AND source = ? AND channel_id = ?"
  ),
  remove: db.prepare("DELETE FROM social_feeds WHERE id = ?"),
  removeByChannel: db.prepare("DELETE FROM social_feeds WHERE channel_id = ?"),
  removeByGuild: db.prepare("DELETE FROM social_feeds WHERE guild_id = ?"),
  all: db.prepare("SELECT * FROM social_feeds WHERE enabled = 1 ORDER BY next_check ASC"),
  setEnabled: db.prepare(
    "UPDATE social_feeds SET enabled = ?, updated_at = unixepoch() WHERE id = ?"
  ),
  setMention: db.prepare(
    "UPDATE social_feeds SET mention_role_id = ?, updated_at = unixepoch() WHERE id = ?"
  ),
  setMessage: db.prepare(
    "UPDATE social_feeds SET custom_message = ?, updated_at = unixepoch() WHERE id = ?"
  ),
  setLiveMessage: db.prepare(
    "UPDATE social_feeds SET live_message_id = ?, updated_at = unixepoch() WHERE id = ?"
  ),
  markSuccess: db.prepare(`
    UPDATE social_feeds SET
      last_item_id = @last_item_id,
      last_checked = @last_checked,
      next_check   = @next_check,
      failures     = 0,
      last_error   = NULL,
      updated_at   = unixepoch()
    WHERE id = @id
  `),
  markFailure: db.prepare(`
    UPDATE social_feeds SET
      last_checked = @last_checked,
      next_check   = @next_check,
      failures     = @failures,
      last_error   = @error,
      updated_at   = unixepoch()
    WHERE id = @id
  `),
};

/** Insert (or refresh) a feed; returns the stored row. */
function addFeed({
  guildId,
  channelId,
  platform,
  source,
  sourceLabel = null,
  mentionRoleId = null,
  customMessage = null,
  apiKey = null,
  lastItemId = null,
}) {
  stmts.insert.run({
    guild_id: guildId,
    channel_id: channelId,
    platform,
    source,
    source_label: sourceLabel,
    mention_role_id: mentionRoleId,
    custom_message: customMessage,
    api_key: apiKey,
    last_item_id: lastItemId,
  });
  return getFeedByKey(guildId, platform, source, channelId);
}

function getFeed(id) {
  return stmts.byId.get(id) || null;
}

function getFeedByKey(guildId, platform, source, channelId) {
  return stmts.byKey.get(guildId, platform, source, channelId) || null;
}

function listFeeds(guildId) {
  return stmts.byGuild.all(guildId);
}

function removeFeed(id) {
  return stmts.remove.run(id).changes > 0;
}

function removeFeedsByChannel(channelId) {
  return stmts.removeByChannel.run(channelId).changes;
}

function removeFeedsByGuild(guildId) {
  return stmts.removeByGuild.run(guildId).changes;
}

/** Feeds to poll, soonest first. */
function dueFeeds() {
  return stmts.all.all();
}

function setEnabled(id, enabled) {
  stmts.setEnabled.run(enabled ? 1 : 0, id);
  // Re-enabled feeds are due immediately.
  if (enabled) setNextCheck(id, 0);
  return getFeed(id);
}

function setNextCheck(id, epochSeconds) {
  db.prepare("UPDATE social_feeds SET next_check = ? WHERE id = ?").run(epochSeconds, id);
}

function setMentionRole(id, roleId) {
  stmts.setMention.run(roleId, id);
  return getFeed(id);
}

/** Set (or clear, with null) the custom message posted with each item. */
function setMessage(id, message) {
  stmts.setMessage.run(message, id);
  return getFeed(id);
}

/** Persist a successful poll. */
function markSuccess(id, lastItemId, nextCheck) {
  stmts.markSuccess.run({
    id,
    last_item_id: lastItemId,
    last_checked: Math.floor(Date.now() / 1000),
    next_check: nextCheck,
  });
  return getFeed(id);
}

/** Persist a failed poll with exponential backoff. */
function markFailure(id, error) {
  const current = getFeed(id);
  const failures = (current?.failures || 0) + 1;
  const backoff = Math.min(failures, 6);
  const nextCheck = Math.floor(Date.now() / 1000) + backoff * 30;
  stmts.markFailure.run({
    id,
    last_checked: Math.floor(Date.now() / 1000),
    next_check: nextCheck,
    failures,
    error: String(error?.message || error).slice(0, 500),
  });
  return getFeed(id);
}

/** Remember (or clear with null) the message of the current Twitch live. */
function setLiveMessage(id, messageId) {
  stmts.setLiveMessage.run(messageId, id);
  return getFeed(id);
}

module.exports = {
  addFeed,
  getFeed,
  getFeedByKey,
  listFeeds,
  removeFeed,
  removeFeedsByChannel,
  removeFeedsByGuild,
  dueFeeds,
  setEnabled,
  setNextCheck,
  setMentionRole,
  setMessage,
  setLiveMessage,
  markSuccess,
  markFailure,
};
