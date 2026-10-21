const jtcDb = require("../db/jtc");
const socialDb = require("../db/social");

module.exports = {
  name: "guildDelete",
  execute(guild) {
    // Bot removed from the guild: clean up its configuration and registry.
    jtcDb.deleteConfig(guild.id);
    jtcDb.removeTempChannelsByGuild(guild.id);
    console.log(`[jtc] cleaned up data for guild ${guild.id}`);

    const removed = socialDb.removeFeedsByGuild(guild.id);
    if (removed) console.log(`[social] removed ${removed} feed(s) for guild ${guild.id}`);
  },
};
