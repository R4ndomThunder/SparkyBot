const { Schema, model } = require("mongoose");

const autopublish = new Schema({
    guildId: { type: String, required: true },
    channels: Array
});

module.exports = model("autopublish", autopublish);
