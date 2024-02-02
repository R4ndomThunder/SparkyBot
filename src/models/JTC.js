const { Schema, model } = require("mongoose");

const JoinToCreate = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  categoryId: { type: String, required: true },
  voiceLimit: { type: Number, required: true },
});

module.exports = model("JoinToCreate", JoinToCreate);
