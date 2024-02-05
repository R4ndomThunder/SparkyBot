const { Schema, model } = require("mongoose");

const User = new Schema({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  balance: { type: Number },
  lastDaily: { type: Date },
  birthDay: { type: Number },
  birthMonth: { type: Number },
  birthYear: { type: Number },
});

module.exports = model("Users", User);
