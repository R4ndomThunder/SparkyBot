
const { Schema, model } = require("mongoose");

const welcome = new Schema({
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
});

module.exports = model("WelcomeMessages", welcome);
