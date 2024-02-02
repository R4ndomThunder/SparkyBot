const { Schema, model } = require("mongoose");

const Guild = new Schema({
  guildId: { type: String, required: true },
  birthdayChannel: { type: String },
  birthdayMessage: { type: String },
});

module.exports = model("Guilds", Guild);
