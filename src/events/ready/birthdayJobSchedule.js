const { ActivityType } = require("discord.js");
const Users = require("../../models/user.js");
const GuildConfig = require("../../models/guildConfig.js");
const cron = require("cron");

module.exports = async (client) => {
  let schedulehappybirthday = new cron.CronJob("00 00 10 * * *", async () => {
    const today = new Date();

    let usersToWish = await Users.find({
      birthDay: today.getDate(),
      birthMonth: today.getMonth(),
    });

    usersToWish.forEach(async (user) => {
      const guild = await client.guilds.fetch(user.guildId);
      const config = await GuildConfig.findOne({ guildId: guild.id });
      if (config && config.birthdayChannel && config.birthdayMessage) {
        const channel = await guild.channels.fetch(config.birthdayChannel);
        await channel.send(
          config.birthdayMessage
            .replace("{user}", `<@${user.userId}>`)
            .replace("{age}", `${
                new Date().getFullYear() - user.birthYear}`)
        );
      }
    });
  });

  schedulehappybirthday.start();
};
