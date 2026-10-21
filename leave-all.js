/**
 * One-off: make the bot leave every guild except the dev guild (GUILD_ID).
 * Run once with `node leave-all.js`, then delete this file.
 */
require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");

const KEEP_GUILD = process.env.GUILD_ID || "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  console.log(`[leave-all] connesso come ${client.user.tag}`);
  const guilds = [...client.guilds.cache.values()];
  console.log(
    `[leave-all] presente in ${guilds.length} server; dev guild da tenere: ${KEEP_GUILD || "(nessuna impostata)"}`
  );
  let left = 0;
  let kept = 0;
  let failed = 0;
  for (const guild of guilds) {
    if (KEEP_GUILD && guild.id === KEEP_GUILD) {
      console.log(`[leave-all] SALTO (dev guild): ${guild.name} (${guild.id})`);
      kept++;
      continue;
    }
    try {
      await guild.leave();
      console.log(`[leave-all] uscito da ${guild.name} (${guild.id})`);
      left++;
      await sleep(700);
    } catch (err) {
      console.error(`[leave-all] ERRORE ${guild.name} (${guild.id}): ${err.message}`);
      failed++;
    }
  }
  console.log(`[leave-all] fine: usciti=${left} saltati=${kept} errori=${failed}`);
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("[leave-all] login fallita:", err.message);
  process.exit(1);
});
