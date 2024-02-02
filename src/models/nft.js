const { Schema, model } = require("mongoose");

const NFT = new Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    eventType: { type: String, required: true },
    collectionName: { type: String, required: true },
    floorPrice: Number
});

module.exports = model("NFT", NFT);
