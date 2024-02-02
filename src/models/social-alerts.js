const { Schema, model } = require("mongoose");

const AlertsSocial = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    social: { type: String, required: true },
    accountId: { type: String, required: true }
});

module.exports = model("AlertsSocial", AlertsSocial);
