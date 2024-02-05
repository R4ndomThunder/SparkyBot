require("dotenv").config();
const mongoose = require("mongoose");
const {
  Client,
  IntentsBitField,
  Partials,
  GatewayIntentBits,
} = require("discord.js");

const { CommandKit } = require("commandkit");
const emitterFile = require("./src/eventHandler.js");
const emitter = emitterFile.emitter;

const path = require("path");

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.DirectMessageReactions,
    IntentsBitField.Flags.DirectMessageTyping,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.Reaction,
    Partials.VoiceState,
    Partials.GuildMember,
    Partials.ThreadMember,
    Partials.User,
    Partials.GuildScheduledEvent,
  ],
});

const process = require("node:process");

process.on("unhandledRejection", (reason, promise) => {
  console.error(
    `Unhandled Rejection at:`,
    reason,
    "\nRejection reason:",
    promise
  );
});

process.on("uncaughtException", (err) => {
  console.error(`uncaughtException at: ${err}`);
});

process.on("uncaughtExceptionMonitor", (err, origin) => {
  console.error(`uncaughtExceptionMonitor at: ${err}\n${origin}`);
});

(async () => {
  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(process.env.MONGO_CONNECTION);
    console.log("Connected to database.");

    new CommandKit({
      client,
      commandsPath: path.join(__dirname, "src/commands"),
      eventsPath: path.join(__dirname, "src/events"),
      validationsPath: path.join(__dirname, "src/validations"),
      devGuildIds: [process.env.DEV_GUILD_ID],
      devUserIds: [process.env.DEV_CLIENT_ID],
      skipBuiltInValidations: true,
    });
  } catch (err) {
    console.log(`Error on init: ${err}`);
  }

  client.login(process.env.TOKEN);
})();
