const { Schema, model } = require("mongoose");

const JTCChannel = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  userId: {type: String, required: true}
});

module.exports = model("JTCChannels", JTCChannel);
