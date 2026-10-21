# SparkyBot

A multipurpose Discord bot built with **discord.js v14**.
All data is stored locally in SQLite (`better-sqlite3`).

## Requirements

- Node.js 22+
- A Discord application/bot token

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your `.env` from the template and fill in the values:

   ```bash
   cp .env.example .env
   ```

   | Variable        | Description                                            |
   | --------------- | ------------------------------------------------------ |
   | `DISCORD_TOKEN` | Bot token from the Discord Developer Portal            |
   | `CLIENT_ID`     | Application ID                                          |
   | `GUILD_ID`      | Test server ID. Leave empty to deploy commands globally |
   | `TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` | Optional. Only needed for Twitch `/social` feeds ([create an app](https://dev.twitch.tv/console/apps)) |

3. Register slash commands:

   ```bash
   npm run deploy
   ```

4. Start the bot:

   ```bash
   npm start        # or: npm run dev  (nodemon)
   ```

### Removing old commands

`npm run deploy` only replaces the commands in the scope it writes to (guild or
global), so leftovers from a previous version can stay visible. Wipe them with:

```bash
npm run clear                  # global + every guild the bot is in
npm run clear -- --global      # global commands only
npm run clear -- --guilds      # guild commands only, all guilds
npm run clear -- --guild=<id>  # a single guild
```

Then run `npm run deploy` again to register the current commands.

## Project structure

```
index.js                  # entry point: loads commands + events, logs in
src/
  commands/<category>/    # one file per slash command (data + execute)
  events/*.js             # one file per event
  db/index.js             # SQLite database + schema
  db/jtc.js               # data access for join-to-create
  db/social.js            # data access for social feeds
  db/games.js             # minigames stats (wins, records)
  db/economy.js           # wallets + credit ledger
  social/                 # feed poller: scheduler + embeds + providers
    providers/            # twitch, youtube, bluesky, itchio clients
  games/                  # pure game logic (rps, tris, slots, blackjack…)
    state.js              # in-memory match state with TTL
  utils/                  # shared logic (translation, http, jtc helpers)
  deploy-commands.js      # registers slash commands with Discord
  clear-commands.js       # removes registered commands (global / per guild)
data/                     # SQLite database files (gitignored)
```

## Commands

### Traduci messaggio (context menu)

Right-click a message → **Apps → Traduci messaggio**. The message is translated
into your own Discord language (ephemeral, only you see it).

How it works:

1. The source language is detected locally with [`tinyld`](https://www.npmjs.com/package/tinyld) (no network call).
2. If it already matches your locale, nothing is translated.
3. Translation is requested from a keyless provider, trying in order:
   - [MyMemory](https://mymemory.translated.net/doc/spec.php) with the detected source language
   - Google Translate (auto-detect), used as a fallback
   - MyMemory, chunked by sentence for long messages

Set `TRANSLATE_EMAIL` in `.env` to raise MyMemory's daily quota.

### ping (slash)

Reports gateway latency and roundtrip time.

### broadcast (slash, owner)

Invia un messaggio (max 2000 caratteri, Markdown) a tutti i server dove il bot
è presente. Riservato al proprietario dell'applicazione Discord.

| Opzione | Descrizione |
| --- | --- |
| `testo` | Testo del messaggio (richiesto) |
| `modalita:canale` (default) | Prova il canale **Aggiornamenti Community** del server; se il server non ce l'ha o il bot non può scriverci, fa fallback col DM all'owner del server |
| `modalita:dm` | Solo DM agli owner (deduplicati se owner di più server) |
| `anteprima:true` | Invia il messaggio solo in DM a chi esegue il comando, senza toccare i server |

Riepilogo effimero alla fine: canali raggiunti, DM inviati, falliti (DM chiusi).
Log in console con prefisso `[broadcast]`.

### jtc — canali vocali temporanei (slash, staff)

Join-to-Create: entrando nel canale **hub** viene creato un canale vocale
temporaneo, e il canale viene eliminato automaticamente quando si svuota.

Solo per chi ha il permesso **Gestisci server**.

| Sottocomando | Descrizione |
| --- | --- |
| `/jtc setup hub:<vocale> [category] [name] [limit]` | Configura il canale hub e i default |
| `/jtc name template:<testo>` | Cambia il template del nome |
| `/jtc limit value:<0-99>` | Limite utenti per canale (0 = illimitato) |
| `/jtc category [category]` | Imposta/rimuovi la categoria di destinazione |
| `/jtc enable` / `/jtc disable` | Attiva/disattiva la funzione |
| `/jtc status` | Mostra la configurazione attuale |
| `/jtc remove` | Rimuove la configurazione del server |

Placeholder del template: `{user}` · `{display}` · `{tag}` · `{count}`

**Permessi richiesti al bot:** `Manage Channels` (creare/eliminare i canali) e
`Move Members` (spostare l'utente nel nuovo canale).

### social — feed social nei canali (slash, staff)

Il bot controlla periodicamente gli account che segui e pubblica i nuovi
elementi nel canale scelto. Il primo controllo fa da riferimento: **non
pubblica lo storico**, solo ciò che arriva dopo.

| Sottocomando | Descrizione |
| --- | --- |
| `/social add piattaforma source canale [ruolo] [messaggio]` | Aggiunge un feed (YouTube/Bluesky/Twitch/Itch.io) |
| `/social remove feed` | Rimuove un feed (autocomplete) |
| `/social pause` / `resume` | Mette in pausa / riattiva un feed |
| `/social messaggio feed [testo]` | Testo personalizzato da pubblicare con ogni nuovo elemento (senza `testo` lo rimuove) |
| `/social list` | Elenca i feed del server |
| `/social test feed` | Controlla il feed senza pubblicare nulla |
| `/social status` | Ultimi controlli, prossimo e errori |

| Piattaforma | Sorgente accettata | Cosa pubblica | Intervallo |
| --- | --- | --- | --- |
| `youtube` | URL, `@handle` o id `UC…` | nuovo video | ~180s |
| `bluesky` | handle (`name.bsky.social`), DID o URL profilo | nuovo post | ~60s |
| `twitch` | `twitch.tv/nome` o login | **live iniziata** + notifica aggiornata a fine live | ~60s |
| `itchio` | `me` (propria API key) oppure URL/username di un profilo pubblico | nuovo gioco pubblicato | ~300s |

- **Twitch** richiede `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` in `.env`
  (gratuiti); YouTube e Bluesky non richiedono credenziali.
- **Itch.io** funziona in due modalità:
  - `sorgente:me` → apre una finestra (modal) dove incollare la **tua** API key
    ([itch.io/api-keys](https://itch.io/api-keys), gratuita): il feed seguirà i giochi
    che pubblichi sul tuo account. La key resta salvata solo nel database locale
    (colonna `api_key`) e non viene mai mostrata. Per cambiarla: `remove` + re-add.
  - `sorgente: URL/username di un profilo` (es. `kenney.itch.io` o `kenney`) →
    segue i giochi **pubblicati** di un creatore qualsiasi, senza credenziali
    (lettura della pagina pubblica del profilo).
- Il ruolo (`[ruolo]`) viene menzionato (ping) a ogni nuovo elemento.
- Quando una live Twitch finisce, la notifica viene **aggiornata in automatico**: colore grigio,
  titolo "…: live conclusa" e durata della diretta nel footer.
- Il `messaggio` personalizzato (max 500 caratteri) accompagna ogni notifica sopra l'embed, con
  `allowedMentions` che blocca ogni ping casuale (compreso `@everyone`); cambia/rimuovilo con `/social messaggio`.
- Gli errori hanno backoff esponenziale e sono visibili in `/social status`.
- `interval` è indicativo: il poller gira ogni 30s e controlla i feed scaduti.

### giochi — minigiochi (slash, tutti)

Giochi puri, zero dipendenze: partite in-memory con scadenza di 2 minuti.
I risultati finiscono nelle statistiche del server (`/giochi classifica`).

| Sottocomando | Descrizione |
| --- | --- |
| `/giochi rps [avversario] [scommessa]` | Sasso-carta-forbici: contro il bot o in sfida |
| `/giochi tris [avversario] [scommessa]` | Tris contro il bot imbattibile (minimax) o un amico |
| `/giochi slots [scommessa]` | Slot: 7️⃣7️⃣7️⃣ = ×10 di profitto, tris = ×4, coppia = rimborso |
| `/giochi corsa` | Il 🎯 appare dopo 2–7s a caso: primo click vince (registra ms) |
| `/giochi blackjack [scommessa]` | Ventuno vs dealer (stand su 17, blackjack 3:2, split su coppia) |
| `/giochi classifica [gioco]` | Top 10 per gioco, oppure vittorie totali |

- **Sfide vs utente**: l'avversario accetta con ✅, poi entrambi giocano sul messaggio pubblico.
- **Scommessa** (solo in sfida rps/tris): entrambi pagano all'accettazione; il vincitore
  incassa il pot (2×), pareggi/scadenze rimborsano sempre. Vs bot e corsa sono gratuiti.
- Bottoni e stati vivono in `src/games/state.js` (TTL + refund automatico via `onExpire`).

### economia — crediti del server (slash, tutti)

Saldo **per server** (500 🪙 alla prima interazione), mai negativo, ogni movimento
registrato in un ledger SQLite.

| Sottocomando | Descrizione |
| --- | --- |
| `/economia saldo [utente]` | Bilancio + disponibilità daily/lavoro |
| `/economia daily` | +150 🪙 ogni 24h |
| `/economia lavora` | +20–80 🪙 ogni ora |
| `/economia paga importo utente` | Trasferimento tra utenti |
| `/economia movimenti` | Ultimi 10 movimenti del conto |
| `/economia classifica` | I 10 più ricchi del server |

- I crediti si guadagnano con daily, lavoro e vittiorie ai giochi; si perdono con le
  scommesse (le slot hanno un "margine della casa" ~40% come sink anti-inflazione).
- Escrow delle scommesse: nessun credito può perdersi per partite scadute o errori.

### Adding a command

Create `src/commands/<category>/name.js`:

```js
const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder().setName("hello").setDescription("Say hi"),
  async execute(interaction) {
    await interaction.reply("Hello!");
  },
};
```

Then run `npm run deploy` to register it.

## Database

SQLite file at `data/sparky.db` (WAL mode). Schema lives in `src/db/index.js` and is
extended as features are added: `guild_config`, `jtc_config`, `jtc_channels`,
`social_feeds`, `game_stats`, `wallets`, `economy_log`.
