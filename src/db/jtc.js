const db = require("./index");

const DEFAULT_TEMPLATE = "{user}'s channel";

const stmts = {
  getConfig: db.prepare("SELECT * FROM jtc_config WHERE guild_id = ?"),
  upsertConfig: db.prepare(`
    INSERT INTO jtc_config (guild_id, hub_channel_id, category_id, name_template, user_limit, enabled)
    VALUES (@guild_id, @hub_channel_id, @category_id, @name_template, @user_limit, @enabled)
    ON CONFLICT(guild_id) DO UPDATE SET
      hub_channel_id = excluded.hub_channel_id,
      category_id    = excluded.category_id,
      name_template  = excluded.name_template,
      user_limit     = excluded.user_limit,
      enabled        = excluded.enabled,
      updated_at     = unixepoch()
  `),
  patchConfig: {
    hub: db.prepare("UPDATE jtc_config SET hub_channel_id = ?, updated_at = unixepoch() WHERE guild_id = ?"),
    category: db.prepare("UPDATE jtc_config SET category_id = ?, updated_at = unixepoch() WHERE guild_id = ?"),
    name: db.prepare("UPDATE jtc_config SET name_template = ?, updated_at = unixepoch() WHERE guild_id = ?"),
    limit: db.prepare("UPDATE jtc_config SET user_limit = ?, updated_at = unixepoch() WHERE guild_id = ?"),
    enabled: db.prepare("UPDATE jtc_config SET enabled = ?, updated_at = unixepoch() WHERE guild_id = ?"),
  },
  deleteConfig: db.prepare("DELETE FROM jtc_config WHERE guild_id = ?"),
  configsByHub: db.prepare("SELECT * FROM jtc_config WHERE hub_channel_id = ?"),

  addChannel: db.prepare(`
    INSERT INTO jtc_channels (channel_id, guild_id, owner_id)
    VALUES (?, ?, ?)
    ON CONFLICT(channel_id) DO UPDATE SET owner_id = excluded.owner_id
  `),
  removeChannel: db.prepare("DELETE FROM jtc_channels WHERE channel_id = ?"),
  getChannel: db.prepare("SELECT * FROM jtc_channels WHERE channel_id = ?"),
  channelsByGuild: db.prepare("SELECT * FROM jtc_channels WHERE guild_id = ?"),
  removeChannelsByGuild: db.prepare("DELETE FROM jtc_channels WHERE guild_id = ?"),
};

/** @returns {object|null} the JTC config for a guild. */
function getConfig(guildId) {
  return stmts.getConfig.get(guildId) || null;
}

/** Create or fully replace the config for a guild. */
function setConfig({
  guildId,
  hubChannelId,
  categoryId = null,
  nameTemplate = DEFAULT_TEMPLATE,
  userLimit = 0,
  enabled = true,
}) {
  stmts.upsertConfig.run({
    guild_id: guildId,
    hub_channel_id: hubChannelId,
    category_id: categoryId,
    name_template: nameTemplate,
    user_limit: userLimit,
    enabled: enabled ? 1 : 0,
  });
  return getConfig(guildId);
}

/** Update a single field of an existing config. */
function patchConfig(guildId, field, value) {
  const stmt = stmts.patchConfig[field];
  if (!stmt) throw new Error(`Unknown jtc config field: ${field}`);
  stmt.run(value, guildId);
  return getConfig(guildId);
}

function deleteConfig(guildId) {
  return stmts.deleteConfig.run(guildId).changes > 0;
}

function configsByHubChannel(hubChannelId) {
  return stmts.configsByHub.all(hubChannelId);
}

function addTempChannel(channelId, guildId, ownerId) {
  stmts.addChannel.run(channelId, guildId, ownerId);
}

function removeTempChannel(channelId) {
  return stmts.removeChannel.run(channelId).changes > 0;
}

function getTempChannel(channelId) {
  return stmts.getChannel.get(channelId) || null;
}

function isTempChannel(channelId) {
  return Boolean(getTempChannel(channelId));
}

function removeTempChannelsByGuild(guildId) {
  return stmts.removeChannelsByGuild.run(guildId).changes;
}

function listTempChannels(guildId) {
  return stmts.channelsByGuild.all(guildId);
}

module.exports = {
  DEFAULT_TEMPLATE,
  getConfig,
  setConfig,
  patchConfig,
  deleteConfig,
  configsByHubChannel,
  addTempChannel,
  removeTempChannel,
  getTempChannel,
  isTempChannel,
  removeTempChannelsByGuild,
  listTempChannels,
};
