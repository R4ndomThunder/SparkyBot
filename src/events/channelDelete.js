const jtcDb = require("../db/jtc");
const socialDb = require("../db/social");

module.exports = {
  name: "channelDelete",
  execute(channel) {
    // A temporary channel disappeared: drop it from the registry.
    if (jtcDb.removeTempChannel(channel.id)) {
      console.log(`[jtc] channel ${channel.id} removed from registry`);
    }
    // A feed target channel disappeared: drop its feeds too.
    const removed = socialDb.removeFeedsByChannel(channel.id);
    if (removed) {
      console.log(`[social] removed ${removed} feed(s) of deleted channel ${channel.id}`);
    }
  },
};
