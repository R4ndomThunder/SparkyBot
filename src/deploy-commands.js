require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

const commands = [];
const base = path.join(__dirname, "commands");
for (const dir of fs.readdirSync(base)) {
  const dirPath = path.join(base, dir);
  if (!fs.statSync(dirPath).isDirectory()) continue;
  for (const file of fs.readdirSync(dirPath).filter((f) => f.endsWith(".js"))) {
    const cmd = require(path.join(dirPath, file));
    if (cmd?.data) commands.push(cmd.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Deploying ${commands.length} command(s)...`);
    const route = process.env.GUILD_ID
      ? Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID)
      : Routes.applicationCommands(process.env.CLIENT_ID);

    const data = await rest.put(route, { body: commands });
    console.log(`Deployed ${data.length} command(s)${process.env.GUILD_ID ? " to dev guild" : " globally"}.`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
