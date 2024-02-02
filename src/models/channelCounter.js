const { Schema, model } = require("mongoose");

const ChannelCounter = new Schema({
    guildId: { type: String, required: true },
    counters: [Object]
});

module.exports = model("ChannelCounter", ChannelCounter);
