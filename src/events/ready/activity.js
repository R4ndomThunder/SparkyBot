const { ActivityType } = require("discord.js");
const cron = require("cron");

module.exports = async (client) => {
  setActivity(client);

  let scheduleActivity = new cron.CronJob("5 * * * *", async () => {
    setActivity(client);
  });
  scheduleActivity.start();

  console.log(client.user.tag + " is ready!");
};

async function setActivity(client) {
  await client.user.setPresence({
    status: "online",
    activities: [
      {
        type: ActivityType.Custom,
        name: "customname",
        state:
          "🤖 Simplifying the management of " +
          client.guilds.cache.size +
          " servers",
      },
    ],
  });
}
