const { ActivityType } = require("discord.js");

module.exports = async(client) => {
  await client.user.setPresence({
    status: 'online',
    activities:  [{
      type: ActivityType.Custom,
      name:"customname",
      state: process.env.ACTIVITY
    }]
  })

  console.log(client.user.tag + " is ready!");
};
