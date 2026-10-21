require("dotenv").config();

const { Client, GatewayIntentBits, Partials, Collection } = require("discord.js");
const db = require("./src/db");

const isDev = process.env.NODE_ENV !== "production";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User, Partials.VoiceState],
});

client.commands = new Collection();
client.db = db;
client.isDev = isDev;

// Registry for buttons/select menus: customId prefix -> owning command module.
client.componentHandlers = new Collection();

process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});

(async () => {
  // Load commands
  const fs = require("fs");
  const path = require("path");
  const cmdDirs = fs.readdirSync(path.join(__dirname, "src/commands"));
  for (const dir of cmdDirs) {
    const files = fs
      .readdirSync(path.join(__dirname, "src/commands", dir))
      .filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const cmd = require(path.join(__dirname, "src/commands", dir, file));
      if (cmd?.data?.name) {
        client.commands.set(cmd.data.name, cmd);
        console.log(`[commands] loaded ${cmd.data.name}`);
      }
      if (Array.isArray(cmd?.components)) {
        for (const prefix of cmd.components) client.componentHandlers.set(prefix, cmd);
      }
    }
  }

  // Load events
  const eventFiles = fs
    .readdirSync(path.join(__dirname, "src/events"))
    .filter((f) => f.endsWith(".js"));
  for (const file of eventFiles) {
    const event = require(path.join(__dirname, "src/events", file));
    if (event?.name) {
      if (event.once) client.once(event.name, event.execute);
      else client.on(event.name, event.execute);
      console.log(`[events] loaded ${event.name}`);
    }
  }

  await client.login(process.env.DISCORD_TOKEN);

  // Background poller for social feeds (Twitch / YouTube / Bluesky).
  require("./src/social").startScheduler(client);
})();
