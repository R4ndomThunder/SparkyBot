const { Schema, model } = require("mongoose");

let reaction = new Schema({
  guildId: { type: String, required: true },
  messageId: String,
  emoji: String,
  roleId: String,
});

module.exports = model("ReactionRoles", reaction);
