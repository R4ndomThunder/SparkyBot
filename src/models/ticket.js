const { Schema, model } = require("mongoose");

const Ticket = new Schema({
  guildId: { type: String, required: true },
  channel: { type: String, required: true },
  ticket: { type: String, required: true },
  transcript: { type: String, required: true },
  new: { type: Boolean, required: false },
});

module.exports = model("Ticket", Ticket);
