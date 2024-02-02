const { Schema, model } = require("mongoose");

const captchaSchema = new Schema({
    guildId: { type: String, required: true },
    role: { type: String, required: true },
    captcha: String,
});

module.exports = model("captcha", captchaSchema);
