const { ActivityType } = require("discord.js");

module.exports = {
  name: "clientReady",
  once: true,
  execute(client) {
    console.log(`[ready] Logged in as ${client.user.tag} (${client.user.id})`);
    client.user.setActivity({
      name: `/ping`,
      type: ActivityType.Watching,
    });
  },
};
