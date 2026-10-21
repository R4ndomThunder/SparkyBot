require("dotenv").config();

const { REST, Routes } = require("discord.js");

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID;

const args = new Set(process.argv.slice(2));
const clearGlobal = args.has("--global") || args.size === 0;
const clearGuilds = args.has("--guilds") || args.size === 0;
const onlyGuild = process.argv.slice(2).find((a) => a.startsWith("--guild="));

async function clearGlobalCommands() {
  const existing = await rest.get(Routes.applicationCommands(clientId));
  if (!existing.length) {
    console.log("[clear] global: nothing to delete");
    return 0;
  }
  await rest.put(Routes.applicationCommands(clientId), { body: [] });
  console.log(`[clear] global: deleted ${existing.length} command(s)`);
  return existing.length;
}

async function clearGuildCommands() {
  const targets = onlyGuild
    ? [onlyGuild.split("=")[1]]
    : (await rest.get(Routes.userGuilds())).map((g) => g.id);

  let total = 0;
  for (const guildId of targets) {
    const existing = await rest
      .get(Routes.applicationGuildCommands(clientId, guildId))
      .catch(() => []);
    if (!existing.length) continue;
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
    total += existing.length;
    console.log(`[clear] guild ${guildId}: deleted ${existing.length} command(s)`);
  }
  if (!total) console.log("[clear] guilds: nothing to delete");
  return total;
}

(async () => {
  try {
    const me = await rest.get(Routes.user());
    console.log(`Clearing commands for ${me.username} (${me.id})\n`);

    let deleted = 0;
    if (clearGlobal) deleted += await clearGlobalCommands();
    if (clearGuilds) deleted += await clearGuildCommands();

    console.log(`\nDone. ${deleted} command(s) removed.`);
    if (deleted) console.log("Run `npm run deploy` to register the current commands.");
    process.exit(0);
  } catch (err) {
    console.error(err?.rawError ? JSON.stringify(err.rawError) : err);
    process.exit(1);
  }
})();
