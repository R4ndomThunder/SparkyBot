const { Schema, model } = require("mongoose");

const Leave = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
});

module.exports = model("LeaveMessages", Leave);
