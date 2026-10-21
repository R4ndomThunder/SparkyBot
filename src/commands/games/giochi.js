const {
  SlashCommandBuilder,
  InteractionContextType,
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const gamesDb = require("../../db/games");
const econ = require("../../db/economy");
const betEscrow = require("../../games/economy");
const { createStore } = require("../../games/state");
const rpsEngine = require("../../games/rps");
const trisEngine = require("../../games/tris");
const slotsEngine = require("../../games/slots");
const bjEngine = require("../../games/blackjack");
const raceEngine = require("../../games/race");

const MIN_BET = 10;
const MAX_BET = 10_000;
const DEFAULT_BET = 10;

const COLORS = {
  blurple: 0x5865f2,
  green: 0x57f287,
  red: 0xed4245,
  gold: 0xfee75c,
  grey: 0x95a5a6,
};

const rpsStore = createStore("rps", 120_000);
const trisStore = createStore("tris", 120_000);
const slotStore = createStore("slots", 180_000);
const bjStore = createStore("blackjack", 180_000);
const raceStore = createStore("race", 70_000);

const fmt = (n) => Number(n).toLocaleString("it-IT");
const ephemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });
const expired = (interaction) =>
  ephemeral(interaction, "⏳ La partita è scaduta. Avvia una nuova con `/giochi`.");

/** The store that owns a state (duel states record their `game`). */
const storeFor = (game) => (game === "tris" ? trisStore : rpsStore);

const record = (guildId, userId, game, result, score = null, better = "higher") => {
  try {
    return gamesDb.recordResult({ guildId, userId, game, result, score, better });
  } catch (err) {
    console.error("[games] recordResult failed", err);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Data (slash definition)
// ---------------------------------------------------------------------------

const stakeOption = (opt) =>
  opt
    .setName("scommessa")
    .setDescription("Posta in crediti (solo in sfida)")
    .setRequired(false)
    .setMinValue(MIN_BET)
    .setMaxValue(MAX_BET);

const duelOptions = (sub) =>
  sub
    .addUserOption((opt) =>
      opt.setName("avversario").setDescription("Sfida un utente (senza opzione giochi contro il bot)")
    )
    .addIntegerOption(stakeOption);

const buildData = () =>
  new SlashCommandBuilder()
    .setName("giochi")
    .setDescription("Minigiochi: sasso-carta-forbici, tris, slots, corsa e blackjack.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      duelOptions(sub.setName("rps").setDescription("Sasso, carta o forbici: contro il bot o in sfida"))
    )
    .addSubcommand((sub) =>
      duelOptions(
        sub
          .setName("tris")
          .setDescription("Tris: contro il bot imbattibile o sfida un amico")
      )
    )
    .addSubcommand((sub) =>
      sub
        .setName("slots")
        .setDescription("Slot machine: 7️⃣7️⃣7️⃣ = ×10 di profitto")
        .addIntegerOption((opt) =>
          opt
            .setName("scommessa")
            .setDescription("Posta in crediti")
            .setRequired(false)
            .setMinValue(MIN_BET)
            .setMaxValue(MAX_BET)
        )
    )
    .addSubcommand((sub) => sub.setName("corsa").setDescription("Premi il 🎯 prima di tutti"))
    .addSubcommand((sub) =>
      sub
        .setName("blackjack")
        .setDescription("Ventuno contro il dealer (blackjack pagato 3:2)")
        .addIntegerOption((opt) =>
          opt
            .setName("scommessa")
            .setDescription("Posta in crediti")
            .setRequired(false)
            .setMinValue(MIN_BET)
            .setMaxValue(MAX_BET)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("classifica")
        .setDescription("Classifica dei giocatori di questo server")
        .addStringOption((opt) =>
          opt
            .setName("gioco")
            .setDescription("Un gioco specifico (senza opzione: vittorie totali)")
            .setRequired(false)
            .addChoices(
              { name: "RPS", value: "rps" },
              { name: "Tris", value: "tris" },
              { name: "Slots", value: "slots" },
              { name: "Corsa", value: "corsa" },
              { name: "Blackjack", value: "blackjack" }
            )
        )
    );

// ---------------------------------------------------------------------------
// Shared UI helpers
// ---------------------------------------------------------------------------

const playerOf = (interaction) => ({ id: interaction.user.id, name: interaction.user.username });

const challengeEmbed = (title, challenger, opponent, stake) =>
  new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.blurple)
    .setDescription(
      `<@${challenger.id}> sfida <@${opponent.id}>!` +
        (stake > 0 ? `\n\n💰 Posta: **${fmt(stake)} 🪙** ciascuno (vince **${fmt(stake * 2)} 🪙**).` : "")
    )
    .setFooter({ text: "Accetta o rifiuta entro 2 minuti" });

const challengeRow = (id, prefix) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`${prefix}:${id}:accept`)
      .setLabel("Accetta")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${prefix}:${id}:decline`)
      .setLabel("Rifiuta")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger)
  );

// ---------------------------------------------------------------------------
// RPS
// ---------------------------------------------------------------------------

async function startRps(interaction) {
  const guildId = interaction.guild.id;
  const player = playerOf(interaction);
  const opponent = interaction.options.getUser("avversario");
  const stake = interaction.options.getInteger("scommessa") ?? 0;

  if (stake > 0 && !opponent) {
    return ephemeral(interaction, "La scommessa serve solo in sfida contro un altro utente.");
  }

  if (!opponent) {
    const state = rpsStore.create({ mode: "solo", guildId, player, status: "playing" });
    const embed = new EmbedBuilder()
      .setTitle("🪨 Sasso, carta o forbici")
      .setColor(COLORS.blurple)
      .setDescription("Fai la tua mossa! Contrasta il bot.");
    return interaction.reply({
      embeds: [embed],
      components: [moveRow(state.id)],
      flags: MessageFlags.Ephemeral,
    });
  }

  if (opponent.id === player.id) return ephemeral(interaction, "Non puoi sfidare te stesso.");
  if (opponent.bot) return ephemeral(interaction, "Non puoi sfidare un bot.");
  if (stake > 0 && !betEscrow.canAfford(guildId, player.id, stake)) {
    return ephemeral(
      interaction,
      `Ti servono **${fmt(stake)} 🪙** per la posta (saldo: ${fmt(econ.getOrCreate(guildId, player.id).balance)} 🪙).`
    );
  }

  const state = rpsStore.create({
    mode: "duel",
    game: "rps",
    guildId,
    status: "pending",
    challenger: player,
    opponent: { id: opponent.id, name: opponent.username },
    stake,
    escrowed: false,
    moves: {},
    onExpire: (entry) => {
      if (entry.escrowed && !entry.settled) {
        betEscrow.refund(entry.guildId, [entry.challenger.id, entry.opponent.id], entry.stake, "rimborso: sfida scaduta");
      }
    },
  });

  return interaction.reply({
    embeds: [challengeEmbed("⚔️ Sfida RPS", player, { id: opponent.id }, stake)],
    components: [challengeRow(state.id, "rps")],
  });
}

const moveRow = (id) =>
  new ActionRowBuilder().addComponents(
    ...Object.entries(rpsEngine.MOVES).map(([key, move]) =>
      new ButtonBuilder()
        .setCustomId(`rps:${id}:${key}`)
        .setLabel(move.name)
        .setEmoji(move.emoji)
        .setStyle(ButtonStyle.Secondary)
    )
  );

async function onRps(interaction, id, action) {
  const state = rpsStore.get(id);
  if (!state) return expired(interaction);

  if (action === "accept" || action === "decline") {
    return respondToChallenge(interaction, state, action, "rps");
  }
  if (!rpsEngine.MOVES[action]) return;

  rpsStore.touch(id);
  const guildId = state.guildId || interaction.guild?.id;

  if (state.mode === "solo") {
    if (interaction.user.id !== state.player.id) {
      return ephemeral(interaction, "Questa è una partita privata.");
    }
    const botMove = rpsEngine.randomMove();
    const result = rpsEngine.judge(action, botMove);
    record(guildId, state.player.id, "rps", result);
    rpsStore.delete(id);

    const title =
      result === "win" ? "🏆 Hai vinto!" : result === "loss" ? "😵 Hai perso…" : "🤝 Pareggio!";
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(result === "win" ? COLORS.green : result === "loss" ? COLORS.red : COLORS.gold)
      .setDescription(
        `Tu: ${rpsEngine.MOVES[action].emoji} **${rpsEngine.MOVES[action].name}**\n` +
          `Bot: ${rpsEngine.MOVES[botMove].emoji} **${rpsEngine.MOVES[botMove].name}**`
      );
    return interaction.update({ embeds: [embed], components: [] });
  }

  // Duel move
  const uid = interaction.user.id;
  if (state.status !== "playing") {
    return ephemeral(interaction, "La sfida non è ancora iniziata.");
  }
  if (uid !== state.challenger.id && uid !== state.opponent.id) {
    return ephemeral(interaction, "Non fai parte di questa sfida.");
  }
  if (state.moves[uid]) {
    return ephemeral(interaction, "Hai già scelto la tua mossa.");
  }
  state.moves[uid] = action;
  rpsStore.touch(id);

  if (Object.keys(state.moves).length < 2) {
    return interaction.reply({
      content: `${rpsEngine.MOVES[action].emoji} Mossa scelta! In attesa dell'avversario…`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const mvChallenger = state.moves[state.challenger.id];
  const mvOpponent = state.moves[state.opponent.id];
  const forChallenger = rpsEngine.judge(mvChallenger, mvOpponent);
  const winner =
    forChallenger === "win" ? state.challenger : forChallenger === "loss" ? state.opponent : null;

  settlePvpResult(interaction, state, winner);
  record(guildId, state.challenger.id, "rps", forChallenger);
  record(
    guildId,
    state.opponent.id,
    "rps",
    forChallenger === "win" ? "loss" : forChallenger === "loss" ? "win" : "draw"
  );

  const embed = new EmbedBuilder()
    .setTitle(
      winner ? `🏆 ${winner.name} ha vinto!` : forChallenger === "draw" ? "🤝 Pareggio!" : "🏆 Vincitore!"
    )
    .setColor(winner ? COLORS.green : COLORS.gold)
    .setDescription(
      `<@${state.challenger.id}>: ${rpsEngine.MOVES[mvChallenger].emoji} **${rpsEngine.MOVES[mvChallenger].name}**\n` +
        `<@${state.opponent.id}>: ${rpsEngine.MOVES[mvOpponent].emoji} **${rpsEngine.MOVES[mvOpponent].name}**` +
        (state.stake > 0
          ? winner
            ? `\n\n💰 <@${winner.id}> incassa **${fmt(state.stake * 2)} 🪙**.`
            : "\n\n💰 Poste rimborsate."
          : "")
    );
  return interaction.update({ embeds: [embed], components: [] });
}

// ---------------------------------------------------------------------------
// Shared challenge accept/decline (RPS + Tris)
// ---------------------------------------------------------------------------

async function respondToChallenge(interaction, state, action, game) {
  if (state.status !== "pending") {
    return ephemeral(interaction, "Questa sfida è già stata gestita.");
  }
  if (interaction.user.id !== state.opponent.id) {
    return ephemeral(interaction, "Solo l'avversario può rispondere alla sfida.");
  }

  const guildId = state.guildId;
  const players = [state.challenger.id, state.opponent.id];

  if (action === "decline") {
    storeFor(state.game).delete(state.id);
    const embed = new EmbedBuilder()
      .setTitle("❌ Sfida rifiutata")
      .setColor(COLORS.grey)
      .setDescription(`<@${state.opponent.id}> ha rifiutato la sfida di <@${state.challenger.id}>.`);
    return interaction.update({ embeds: [embed], components: [] });
  }

  if (state.stake > 0) {
    const collected = betEscrow.escrow(guildId, players, state.stake, `posta ${game}`);
    if (!collected.ok) {
      storeFor(state.game).delete(state.id);
      const embed = new EmbedBuilder()
        .setTitle("❌ Posta non pagabile")
        .setColor(COLORS.red)
        .setDescription(
          `<@${collected.userId}> non ha abbastanza crediti per la posta di **${fmt(state.stake)} 🪙**.`
        );
      return interaction.update({ embeds: [embed], components: [] });
    }
    state.escrowed = true;
  }
  state.status = "playing";

  if (game === "rps") {
    rpsStore.touch(state.id);
    const embed = new EmbedBuilder()
      .setTitle("🪨 Scegliete la mossa!")
      .setColor(COLORS.blurple)
      .setDescription(
        `<@${state.challenger.id}> vs <@${state.opponent.id}>` +
          (state.stake > 0 ? `\n💰 In palio: **${fmt(state.stake * 2)} 🪙**` : "") +
          "\n\nOgni giocatore preme un pulsante: la scelta resta privata finché non hanno scelto entrambi."
      );
    return interaction.update({ embeds: [embed], components: [moveRow(state.id)] });
  }

  // tris
  trisStore.touch(state.id);
  const embed = trisBoardEmbed(state, "turno di X");
  return interaction.update({ embeds: [embed], components: trisRows(state) });
}

/** Winner takes the pot / draw refunds — call only when the game is decided. */
function settlePvpResult(interaction, state, winner) {
  const players = [state.challenger.id, state.opponent.id];
  if (state.stake > 0 && state.escrowed) {
    if (winner) betEscrow.settlePvp(state.guildId, winner.id, players, state.stake, `vincita ${state.game}`);
    else betEscrow.refund(state.guildId, players, state.stake, "rimborso: pareggio");
  }
  state.settled = true;
  storeFor(state.game).delete(state.id);
}

// ---------------------------------------------------------------------------
// Tris
// ---------------------------------------------------------------------------

async function startTris(interaction) {
  const guildId = interaction.guild.id;
  const player = playerOf(interaction);
  const opponent = interaction.options.getUser("avversario");
  const stake = interaction.options.getInteger("scommessa") ?? 0;

  if (stake > 0 && !opponent) {
    return ephemeral(interaction, "La scommessa serve solo in sfida contro un altro utente.");
  }

  if (!opponent) {
    const state = trisStore.create({
      mode: "solo",
      guildId,
      player,
      status: "playing",
      board: trisEngine.emptyBoard(),
      turn: "X",
    });
    const embed = trisBoardEmbed(state, "tocca a te (❌)");
    return interaction.reply({
      embeds: [embed],
      components: trisRows(state),
      flags: MessageFlags.Ephemeral,
    });
  }

  if (opponent.id === player.id) return ephemeral(interaction, "Non puoi sfidare te stesso.");
  if (opponent.bot) return ephemeral(interaction, "Non puoi sfidare un bot.");
  if (stake > 0 && !betEscrow.canAfford(guildId, player.id, stake)) {
    return ephemeral(
      interaction,
      `Ti servono **${fmt(stake)} 🪙** per la posta (saldo: ${fmt(econ.getOrCreate(guildId, player.id).balance)} 🪙).`
    );
  }

  const state = trisStore.create({
    mode: "duel",
    game: "tris",
    guildId,
    status: "pending",
    challenger: player,
    opponent: { id: opponent.id, name: opponent.username },
    stake,
    escrowed: false,
    board: trisEngine.emptyBoard(),
    turn: "X",
    onExpire: (entry) => {
      if (entry.escrowed && !entry.settled) {
        betEscrow.refund(entry.guildId, [entry.challenger.id, entry.opponent.id], entry.stake, "rimborso: sfida scaduta");
      }
    },
  });

  return interaction.reply({
    embeds: [challengeEmbed("❌⭕ Sfida a Tris", player, { id: opponent.id }, stake)],
    components: [challengeRow(state.id, "tris")],
  });
}

const TRIS_EMOJI = { X: "❌", O: "⭕", null: "⬜" };

function trisBoardEmbed(state, statusLine, extra) {
  const b = state.board;
  const grid = [0, 1, 2].map((r) => [0, 1, 2].map((c) => TRIS_EMOJI[b[r * 3 + c]]).join(" ")).join("\n");
  const over = trisEngine.winner(state.board);
  const embed = new EmbedBuilder()
    .setTitle("❌⭕ Tris")
    .setColor(over ? (over.mark === "draw" ? COLORS.gold : COLORS.green) : COLORS.blurple)
    .setDescription(grid)
    .addFields({ name: "Stato", value: statusLine, inline: true });

  if (state.mode === "duel") {
    embed.addFields({
      name: "Giocatori",
      value: `❌ <@${state.challenger.id}> · ⭕ <@${state.opponent.id}>` +
        (state.stake > 0 ? `\n💰 In palio: **${fmt(state.stake * 2)} 🪙**` : ""),
    });
  }
  if (extra) embed.setFooter({ text: extra });
  return embed;
}

function trisRows(state) {
  const disabledAll = Boolean(trisEngine.winner(state.board)) || state.status !== "playing";
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const index = r * 3 + c;
      const cell = state.board[index];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`tris:${state.id}:${index}`)
          .setLabel(TRIS_EMOJI[cell])
          .setStyle(
            cell === "X"
              ? ButtonStyle.Danger
              : cell === "O"
                ? ButtonStyle.Primary
                : ButtonStyle.Secondary
          )
          .setDisabled(disabledAll || Boolean(cell))
      );
    }
    rows.push(row);
  }
  return rows;
}

async function onTris(interaction, id, action) {
  const state = trisStore.get(id);
  if (!state) return expired(interaction);

  if (action === "accept" || action === "decline") {
    return respondToChallenge(interaction, state, action, "tris");
  }
  const index = Number(action);
  if (!Number.isInteger(index) || index < 0 || index > 8) return;

  const guildId = state.guildId || interaction.guild?.id;
  trisStore.touch(id);

  if (state.mode === "solo") return onTrisSolo(interaction, state, index);
  return onTrisDuel(interaction, state, index);
}

async function onTrisSolo(interaction, state, index) {
  if (interaction.user.id !== state.player.id) {
    return ephemeral(interaction, "Questa è una partita privata.");
  }
  if (state.status !== "playing" || state.turn !== "X" || state.board[index]) {
    return ephemeral(interaction, "Non è il tuo turno o la casella è occupata.");
  }

  state.board = trisEngine.applyMove(state.board, index, "X");
  let over = trisEngine.winner(state.board);
  let statusLine = "bot sta pensando…";

  if (!over) {
    const botCell = trisEngine.bestMove(state.board, "O");
    if (botCell !== null) state.board = trisEngine.applyMove(state.board, botCell, "O");
    over = trisEngine.winner(state.board);
    statusLine = "tocca a te (❌)";
  }

  if (over) {
    const result = over.mark === "draw" ? "draw" : over.mark === "X" ? "win" : "loss";
    record(state.guildId, state.player.id, "tris", result);
    statusLine =
      over.mark === "draw" ? "Pareggio!" : over.mark === "X" ? "Hai vinto! 🏆" : "Il bot ha vinto… 🤖";
    trisStore.delete(state.id);
  }

  const embed = trisBoardEmbed(state, statusLine, over ? undefined : "Il bot gioca in modo perfetto.");
  return interaction.update({ embeds: [embed], components: trisRows(state) });
}

async function onTrisDuel(interaction, state, index) {
  const uid = interaction.user.id;
  if (state.status !== "playing") return ephemeral(interaction, "La sfida non è ancora iniziata.");
  if (uid !== state.challenger.id && uid !== state.opponent.id) {
    return ephemeral(interaction, "Non fai parte di questa sfida.");
  }

  const expected = state.turn === "X" ? state.challenger : state.opponent;
  if (uid !== expected.id) {
    return ephemeral(interaction, `Tocca a <@${expected.id}> (${state.turn}).`);
  }
  if (state.board[index]) return ephemeral(interaction, "Casella già occupata.");

  state.board = trisEngine.applyMove(state.board, index, state.turn);
  const over = trisEngine.winner(state.board);

  if (over) {
    const winnerMark = over.mark;
    const winner =
      winnerMark === "draw" ? null : winnerMark === "X" ? state.challenger : state.opponent;
    settlePvpResult(interaction, state, winner);

    const forChallenger = winnerMark === "draw" ? "draw" : winnerMark === "X" ? "win" : "loss";
    record(state.guildId, state.challenger.id, "tris", forChallenger);
    record(
      state.guildId,
      state.opponent.id,
      "tris",
      forChallenger === "win" ? "loss" : forChallenger === "loss" ? "win" : "draw"
    );

    const statusLine =
      winnerMark === "draw"
        ? "Pareggio! 🤝"
        : `Vince <@${(winnerMark === "X" ? state.challenger : state.opponent).id}> 🏆`;
    const embed = trisBoardEmbed(state, statusLine);
    return interaction.update({ embeds: [embed], components: trisRows(state) });
  }

  state.turn = trisEngine.other(state.turn);
  trisStore.touch(state.id);
  const embed = trisBoardEmbed(state, `tocca a ${state.turn} (${TRIS_EMOJI[state.turn]})`);
  return interaction.update({ embeds: [embed], components: trisRows(state) });
}

// ---------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------

async function startSlots(interaction) {
  const guildId = interaction.guild.id;
  const player = playerOf(interaction);
  const bet = interaction.options.getInteger("scommessa") ?? DEFAULT_BET;
  const wallet = econ.getOrCreate(guildId, player.id);

  if (wallet.balance < bet) {
    return ephemeral(
      interaction,
      `Saldo insufficiente: hai **${fmt(wallet.balance)} 🪙** e la posta è **${fmt(bet)} 🪙**.`
    );
  }

  const state = slotStore.create({ guildId, player, bet, spins: 0, lastNet: 0 });
  const embed = new EmbedBuilder()
    .setTitle("🎰 Slot machine")
    .setColor(COLORS.gold)
    .setDescription(
      `Posta: **${fmt(bet)} 🪙**\n\n` +
        `7️⃣7️⃣7️⃣ → +**10×** di profitto\nTris → +**4×**\nCoppia → rimborso\nNiente → perdi la posta\n\n` +
        `Saldo: **${fmt(wallet.balance)} 🪙**`
    )
    .setFooter({ text: "Premi 🎰 per giocare" });

  return interaction.reply({
    embeds: [embed],
    components: [slotRow(state.id)],
    flags: MessageFlags.Ephemeral,
  });
}

const slotRow = (id) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`slots:${id}:spin`)
      .setLabel("Gira")
      .setEmoji("🎰")
      .setStyle(ButtonStyle.Primary)
  );

async function onSlots(interaction, id) {
  const state = slotStore.get(id);
  if (!state) return expired(interaction);
  if (interaction.user.id !== state.player.id) {
    return ephemeral(interaction, "Questa è una partita privata.");
  }

  slotStore.touch(id);
  const balance = econ.debit(state.guildId, state.player.id, state.bet, "posta slots");
  if (balance === null) {
    return interaction.reply({
      content: `❌ Saldo insufficiente per una posta di **${fmt(state.bet)} 🪙**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  const symbols = slotsEngine.spin();
  const kind = slotsEngine.evaluate(symbols);
  const returned = slotsEngine.creditsReturned(state.bet, kind);
  if (returned > 0) econ.credit(state.guildId, state.player.id, returned, "vincita slots");

  const net = returned - state.bet;
  const result = net > 0 ? "win" : net < 0 ? "loss" : "draw";
  record(state.guildId, state.player.id, "slots", result, net > 0 ? net : null);
  state.spins += 1;
  state.lastNet = net;

  const newBalance = econ.getOrCreate(state.guildId, state.player.id).balance;
  const embed = new EmbedBuilder()
    .setTitle(kind === "jackpot" ? "🎰 JACKPOT!" : "🎰 Slot machine")
    .setColor(kind === "jackpot" ? COLORS.gold : net > 0 ? COLORS.green : net < 0 ? COLORS.red : COLORS.grey)
    .setDescription(
      `## ${symbols.join(" ")}\n${slotsEngine.LABELS[kind]}\n\n` +
        `Posta: ${fmt(state.bet)} 🪙 · risultato: **${net >= 0 ? "+" : ""}${fmt(net)} 🪙**\n` +
        `Saldo: **${fmt(newBalance)} 🪙** · giri: ${state.spins}`
    )
    .setFooter({ text: "Premi 🎰 per rigiocare con la stessa posta" });

  return interaction.update({ embeds: [embed], components: [slotRow(state.id)] });
}

// ---------------------------------------------------------------------------
// Corsa (click race)
// ---------------------------------------------------------------------------

async function startCorsa(interaction) {
  const guildId = interaction.guild.id;
  const delay = raceEngine.revealDelay();
  const state = raceStore.create({ guildId, revealMs: delay, revealedAt: null, winner: null, late: [] });

  const preparing = new EmbedBuilder()
    .setTitle("🏃 Corsa…")
    .setColor(COLORS.gold)
    .setDescription(
      "Il 🎯 apparirà tra poco. **Non premere prima!** (chi tocca troppo presto perde)\n\n" +
        "Tutti possono cliccare: il primo vince la gara."
    );

  const message = await interaction.reply({ embeds: [preparing], components: [] });

  setTimeout(async () => {
    const live = raceStore.get(state.id);
    if (!live) return;
    live.revealedAt = Date.now();
    const go = new EmbedBuilder()
      .setTitle("🎯 TOCCA!")
      .setColor(COLORS.red)
      .setDescription("Adesso! Il primo a premere 🎯 vince.");
    try {
      await message.edit({ embeds: [go], components: [raceRow(live.id)] });
    } catch (err) {
      console.error("[games] corsa reveal failed", err);
    }
  }, delay);
}

const raceRow = (id) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`corsa:${id}:go`)
      .setLabel("TOCCA!")
      .setEmoji("🎯")
      .setStyle(ButtonStyle.Success)
  );

async function onCorsa(interaction, id) {
  const state = raceStore.get(id);
  if (!state) return expired(interaction);
  const guildId = state.guildId || interaction.guild?.id;
  const uid = interaction.user.id;

  if (!state.revealedAt) {
    return ephemeral(interaction, "Aspetta che il bersaglio appaia… ⏳");
  }

  if (state.winner) {
    if (!state.late.includes(uid)) {
      state.late.push(uid);
      record(guildId, uid, "corsa", "loss");
    }
    return ephemeral(interaction, "🐌 Troppo lento! Il bersaglio era già stato preso.");
  }

  const ms = Date.now() - state.revealedAt;
  state.winner = { id: uid, ms };
  record(guildId, uid, "corsa", "win", ms, "lower");

  const embed = new EmbedBuilder()
    .setTitle("🏆 Bersaglio preso!")
    .setColor(COLORS.green)
    .setDescription(
      `<@${uid}> ha premuto in **${fmt(ms)} ms**!` +
        (state.late.length ? `\n\nPochi istanti dopo: ${state.late.map((x) => `<@${x}>`).join(", ")}` : "")
    );

  return interaction.update({ embeds: [embed], components: [] });
}

// ---------------------------------------------------------------------------
// Blackjack
// ---------------------------------------------------------------------------

async function startBlackjack(interaction) {
  const guildId = interaction.guild.id;
  const player = playerOf(interaction);
  const bet = interaction.options.getInteger("scommessa") ?? DEFAULT_BET;

  const paid = econ.debit(guildId, player.id, bet, "posta blackjack");
  if (paid === null) {
    const wallet = econ.getOrCreate(guildId, player.id);
    return ephemeral(
      interaction,
      `Saldo insufficiente: hai **${fmt(wallet.balance)} 🪙** e la posta è **${fmt(bet)} 🪙**.`
    );
  }

  const deck = bjEngine.freshDeck();
  const hands = [{ cards: bjEngine.draw(deck, 2), bet, fromSplit: false, done: false }];
  const dealer = bjEngine.draw(deck, 2);
  const state = bjStore.create({ guildId, player, deck, hands, dealer, active: 0, phase: "playing", bet });

  const natural =
    bjEngine.isBlackjack(hands[0].cards) || bjEngine.isBlackjack(dealer);
  if (natural) {
    const summary = settleBj(state);
    return interaction.reply({
      embeds: [bjEmbed(state, summary)],
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.reply({
    embeds: [bjEmbed(state)],
    components: [bjRow(state)],
    flags: MessageFlags.Ephemeral,
  });
}

/** Dealer reveals, every hand is paid out, stats are recorded. */
function settleBj(state) {
  bjEngine.dealerPlay(state.deck, state.dealer);

  let returned = 0;
  let net = 0;
  const outcomes = [];
  for (const hand of state.hands) {
    const settled = bjEngine.settleHand({
      player: hand.cards,
      dealer: state.dealer,
      bet: hand.bet,
      fromSplit: hand.fromSplit,
    });
    returned += hand.bet + settled.profit;
    net += settled.profit;
    outcomes.push(settled.outcome);
  }

  if (returned > 0) econ.credit(state.guildId, state.player.id, returned, "vincita blackjack");
  const result = net > 0 ? "win" : net < 0 ? "loss" : "draw";
  record(state.guildId, state.player.id, "blackjack", result, net > 0 ? net : null);

  state.phase = "done";
  const balance = econ.getOrCreate(state.guildId, state.player.id).balance;
  return { net, outcomes, balance };
}

function bjEmbed(state, summary = null) {
  const revealed = Boolean(summary);
  const dealerLine = revealed
    ? `${bjEngine.formatHand(state.dealer)} (=**${bjEngine.handValue(state.dealer).total}**)`
    : `${state.dealer[0] ? bjEngine.formatCard(state.dealer[0]) : "?"} 🂠`;

  const handsLines = state.hands
    .map((hand, i) => {
      const value = bjEngine.handValue(hand.cards).total;
      const busted = value > 21 ? " 💥" : "";
      const marker = state.phase === "playing" && i === state.active ? " ▶" : "";
      const label = state.hands.length > 1 ? `Mano ${i + 1} (${fmt(hand.bet)} 🪙)` : "La tua mano";
      return `**${label}**${marker}: ${bjEngine.formatHand(hand.cards)} (=**${value}**${busted})`;
    })
    .join("\n");

  const embed = new EmbedBuilder()
    .setTitle("🃏 Blackjack")
    .setColor(
      summary
        ? summary.net > 0
          ? COLORS.green
          : summary.net < 0
            ? COLORS.red
            : COLORS.grey
        : COLORS.blurple
    )
    .addFields(
      { name: "Dealer", value: dealerLine, inline: true },
      { name: "Giocatore", value: handsLines || "—", inline: false }
    );

  if (summary) {
    embed.addFields({
      name: "Risultato sessione",
      value:
        `**${summary.net >= 0 ? "+" : ""}${fmt(summary.net)} 🪙** · ` +
        `Saldo: **${fmt(summary.balance)} 🪙**`,
    });
  } else {
    embed.setFooter({ text: `Posta ${fmt(state.bet)} 🪙 · il dealer pesca fino a 17` });
  }
  return embed;
}

function bjRow(state) {
  const hand = state.hands[state.active];
  const canSplit =
    state.phase === "playing" &&
    state.hands.length === 1 &&
    hand.cards.length === 2 &&
    hand.cards[0].rank === hand.cards[1].rank;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj:${state.id}:hit`)
      .setLabel("Pesca")
      .setEmoji("🃏")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`bj:${state.id}:stand`)
      .setLabel("Stai")
      .setEmoji("✋")
      .setStyle(ButtonStyle.Primary)
  );
  if (canSplit) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`bj:${state.id}:split`)
        .setLabel("Dividi")
        .setEmoji("✂️")
        .setStyle(ButtonStyle.Secondary)
    );
  }
  return row;
}

async function onBlackjack(interaction, id, action) {
  const state = bjStore.get(id);
  if (!state) return expired(interaction);
  if (interaction.user.id !== state.player.id) {
    return ephemeral(interaction, "Questa è una partita privata.");
  }
  if (state.phase !== "playing") return expired(interaction);
  if (!["hit", "stand", "split"].includes(action)) return;

  bjStore.touch(id);
  const hand = state.hands[state.active];

  if (action === "hit") {
    hand.cards.push(...bjEngine.draw(state.deck, 1));
    if (bjEngine.isBusted(hand.cards)) {
      hand.done = true;
      return advanceBlackjack(interaction, state);
    }
    return interaction.update({ embeds: [bjEmbed(state)], components: [bjRow(state)] });
  }

  if (action === "stand") {
    hand.done = true;
    return advanceBlackjack(interaction, state);
  }

  // split
  if (state.hands.length !== 1 || hand.cards.length !== 2 || hand.cards[0].rank !== hand.cards[1].rank) {
    return ephemeral(interaction, "Qui non puoi dividere.");
  }
  const extra = econ.debit(state.guildId, state.player.id, state.bet, "posta split blackjack");
  if (extra === null) {
    return ephemeral(
      interaction,
      `Ti servono altri **${fmt(state.bet)} 🪙** per dividere (saldo: ${fmt(extra === null ? econ.getOrCreate(state.guildId, state.player.id).balance : extra)} 🪙).`
    );
  }

  const [first, second] = hand.cards;
  state.hands = [
    { cards: [first, ...bjEngine.draw(state.deck, 1)], bet: state.bet, fromSplit: true, done: false },
    { cards: [second, ...bjEngine.draw(state.deck, 1)], bet: state.bet, fromSplit: true, done: false },
  ];
  state.active = 0;

  if (state.hands[0].cards.length === 2 && bjEngine.handValue(state.hands[0].cards).total === 21) {
    state.hands[0].done = true;
    return advanceBlackjack(interaction, state);
  }
  return interaction.update({ embeds: [bjEmbed(state)], components: [bjRow(state)] });
}

/** After the active hand ends: next hand, or dealer settles everything. */
async function advanceBlackjack(interaction, state) {
  const next = state.hands.findIndex((hand, i) => i > state.active && !hand.done);
  if (next !== -1) {
    state.active = next;
    bjStore.touch(state.id);
    return interaction.update({ embeds: [bjEmbed(state)], components: [bjRow(state)] });
  }

  const summary = settleBj(state);
  bjStore.delete(state.id);
  return interaction.update({ embeds: [bjEmbed(state, summary)], components: [] });
}

// ---------------------------------------------------------------------------
// Classifica
// ---------------------------------------------------------------------------

const BEST_LABEL = {
  slots: (row) => (row.best != null ? ` · record **+${fmt(row.best)} 🪙**` : ""),
  blackjack: (row) => (row.best != null ? ` · miglior sessione **+${fmt(row.best)} 🪙**` : ""),
  corsa: (row) => (row.best != null ? ` · 🏁 **${fmt(row.best)} ms**` : ""),
  rps: () => "",
  tris: () => "",
};

async function showLeaderboard(interaction) {
  const game = interaction.options.getString("gioco");
  const guildId = interaction.guild.id;
  const medal = (i) => ["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`;

  let lines = [];
  let title;

  if (!game) {
    title = "🏆 Classifica generale";
    const top = gamesDb.topOverall(guildId, 10);
    lines = top.map(
      (row, i) =>
        `${medal(i)} <@${row.user_id}> — **${row.wins}** 🏆 · ${row.plays} partite ` +
        `(${row.wins}V ${row.losses}S ${row.draws}P)`
    );
  } else {
    title = `🏆 Classifica — ${game}`;
    const top = gamesDb.topForGame(guildId, game, 10, { byBest: game === "corsa" });
    const label = BEST_LABEL[game] || (() => "");
    lines = top.map(
      (row, i) =>
        `${medal(i)} <@${row.user_id}> — **${row.wins}** 🏆 · ${row.plays} partite${label(row)}`
    );
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(COLORS.gold)
    .setDescription(lines.length ? lines.join("\n") : "Nessuna partita giocata ancora. Corri a giocare! 🎮");

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

module.exports = {
  data: buildData(),

  /** Prefixes owned by this command — used by the component registry. */
  components: ["rps:", "tris:", "slots:", "corsa:", "bj:"],

  async execute(interaction) {
    switch (interaction.options.getSubcommand()) {
      case "rps":
        return startRps(interaction);
      case "tris":
        return startTris(interaction);
      case "slots":
        return startSlots(interaction);
      case "corsa":
        return startCorsa(interaction);
      case "blackjack":
        return startBlackjack(interaction);
      case "classifica":
        return showLeaderboard(interaction);
      default:
        return ephemeral(interaction, "Sottocomando sconosciuto.");
    }
  },

  /** Router for every button of this command (called from interactionCreate). */
  async onComponent(interaction) {
    const [prefix, id, action] = String(interaction.customId).split(":");
    switch (prefix) {
      case "rps":
        return onRps(interaction, id, action);
      case "tris":
        return onTris(interaction, id, action);
      case "slots":
        return onSlots(interaction, id, action);
      case "corsa":
        return onCorsa(interaction, id, action);
      case "bj":
        return onBlackjack(interaction, id, action);
      default:
        return;
    }
  },
};
