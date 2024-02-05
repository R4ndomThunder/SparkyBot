const {
    EmbedBuilder,
  } = require("discord.js");
  
  const { Captcha } = require("captcha-canvas");
  const capSchema = require("../../models/captcha.js");
  
  module.exports = async (member) => {
    const Data = await capSchema.findOne({ guildId: member.guild.id });
    if (!Data) return;
  
    const captcha = new Captcha();
    captcha.async = true;
    captcha.addDecoy();
    captcha.drawTrace();
    captcha.drawCaptcha();
  
    let cmsg = await member.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0x223f98)
          .setTitle("Captcha Verification")
          .setImage("attachment://captcha.png"),
      ],
      files: [
        {
          attachment: await captcha.png,
          name: "captcha.png",
        },
      ],
    });
  
    await cmsg.channel
      .awaitMessages({
        filter: (m) => m.author.id == member.user.id,
        max: 1,
        time: 1000 * 60,
        errors: ["time"],
      })
      .then(async (value) => {
        let isValid = value.first().content == captcha.text;
        if (isValid) {
          await member.roles.add(Data.role).catch((e) => {console.log(e);});
          member.send({ content: "You are now verified.", ephemeral: true });
        } else {
          member.send(
            "You  are kicked from **" +
              member.guild.name +
              "** server because you did not complete verification"
          );
          member.kick().catch((e) => {});
        }
      })
      .catch((e) => {
        member.send(
          "You  are kicked from **" +
            member.guild.name +
            "** server because you did not complete verification"
        );
        member.kick().catch((e) => {});
      });
  };
  