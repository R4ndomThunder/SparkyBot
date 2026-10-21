const {
  SlashCommandBuilder,
  InteractionContextType,
  MessageFlags,
  EmbedBuilder,
} = require("discord.js");
const econ = require("../../db/economy");

const fmt = (n) => Number(n).toLocaleString("it-IT");
const ephemeral = (interaction, content) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

const COLORS = { gold: 0xfee75c, green: 0x57f287, red: 0xed4245, blurple: 0x5865f2 };

const fmtDuration = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
};

const WORK_FLAVORS = [
  "Hai consegnato pacchi sotto la pioggia",
  "Hai fatto il cameriere in un locale affollato",
  "Hai riparato computer per i vicini",
  "Hai dato ripetizioni di matematica",
  "Hai lavorato in un banco dati",
  "Hai aiutato allo stadio durante la partita",
  "Hai montato scaffali tutto il giorno",
  "Hai fatto il corriere in bici",
];

const buildData = () =>
  new SlashCommandBuilder()
    .setName("economia")
    .setDescription("Crediti del server: saldo, bonus giornalieri e trasferimenti.")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("saldo")
        .setDescription("Mostra il tuo credito o quello di un altro utente")
        .addUserOption((opt) => opt.setName("utente").setDescription("Di cui vedere il saldo"))
    )
    .addSubcommand((sub) => sub.setName("daily").setDescription("Ricompensa giornaliera: 150 🪙 ogni 24h"))
    .addSubcommand((sub) => sub.setName("lavora").setDescription("Piccolo lavoro: 20–80 🪙 ogni ora"))
    .addSubcommand((sub) =>
      sub
        .setName("paga")
        .setDescription("Trasferisci crediti a un altro utente")
        .addIntegerOption((opt) =>
          opt.setName("importo").setDescription("Quanti crediti").setRequired(true).setMinValue(1).setMaxValue(1_000_000)
        )
        .addUserOption((opt) => opt.setName("utente").setDescription("Chi riceve").setRequired(true))
    )
    .addSubcommand((sub) =>
      sub.setName("movimenti").setDescription("Gli ultimi 10 movimenti del tuo conto")
    )
    .addSubcommand((sub) =>
      sub.setName("classifica").setDescription("I 10 utenti più ricchi di questo server")
    );

module.exports = {
  data: buildData(),

  async execute(interaction) {
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    switch (interaction.options.getSubcommand()) {
      case "saldo": {
        const target = interaction.options.getUser("utente") || interaction.user;
        const wallet = econ.getOrCreate(guildId, target.id);
        const now = Math.floor(Date.now() / 1000);
        const parts = [`🪙 Saldo: **${fmt(wallet.balance)} crediti**`];
        if (target.id === userId) {
          parts.push(
            wallet.daily_at && now - wallet.daily_at < econ.DAILY_COOLDOWN
              ? `⏳ Daily tra ${fmtDuration(wallet.daily_at + econ.DAILY_COOLDOWN - now)}`
              : "🟢 Daily disponibile (`/economia daily`)"
          );
          parts.push(
            wallet.work_at && now - wallet.work_at < econ.WORK_COOLDOWN
              ? `⏳ Lavoro tra ${fmtDuration(wallet.work_at + econ.WORK_COOLDOWN - now)}`
              : "🟢 Lavoro disponibile (`/economia lavora`)"
          );
        }
        const embed = new EmbedBuilder()
          .setTitle(`🪙 Conto di ${target.username}`)
          .setColor(COLORS.gold)
          .setDescription(parts.join("\n"));
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      case "daily": {
        const res = econ.claimDaily(guildId, userId);
        if (!res.ok) {
          return ephemeral(
            interaction,
            `⏳ Daily già presa! Torna tra **${fmtDuration(res.retryAt - Math.floor(Date.now() / 1000))}**.`
          );
        }
        const embed = new EmbedBuilder()
          .setTitle("🎁 Daily incassata!")
          .setColor(COLORS.green)
          .setDescription(
            `+**${fmt(res.amount)} 🪙** · nuovo saldo: **${fmt(res.balance)} crediti**`
          );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      case "lavora": {
        const amount = econ.WORK_MIN + Math.floor(Math.random() * (econ.WORK_MAX - econ.WORK_MIN + 1));
        const res = econ.claimWork(guildId, userId, amount);
        if (!res.ok) {
          return ephemeral(
            interaction,
            `⏳ Hai già lavorato di recente! Pausa di **${fmtDuration(res.retryAt - Math.floor(Date.now() / 1000))}**.`
          );
        }
        const flavor = WORK_FLAVORS[Math.floor(Math.random() * WORK_FLAVORS.length)];
        const embed = new EmbedBuilder()
          .setTitle("💪 Turno concluso")
          .setColor(COLORS.green)
          .setDescription(
            `${flavor}: +**${fmt(res.amount)} 🪙**\nNuovo saldo: **${fmt(res.balance)} crediti**`
          );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      case "paga": {
        const amount = interaction.options.getInteger("importo", true);
        const target = interaction.options.getUser("utente", true);

        if (target.id === userId) return ephemeral(interaction, "Non puoi pagare te stesso.");
        if (target.bot) return ephemeral(interaction, "Non puoi pagare un bot.");

        const res = econ.transfer(guildId, userId, target.id, amount, `trasferimento a ${target.username}`);
        if (!res) {
          const wallet = econ.getOrCreate(guildId, userId);
          return ephemeral(
            interaction,
            `❌ Saldo insufficiente: hai **${fmt(wallet.balance)} 🪙**.`
          );
        }
        const embed = new EmbedBuilder()
          .setTitle("💸 Trasferimento completato")
          .setColor(COLORS.blurple)
          .setDescription(
            `Hai inviato **${fmt(amount)} 🪙** a **${target.username}**.\nIl tuo saldo: **${fmt(res.balance)} crediti**`
          );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      case "movimenti": {
        const rows = econ.recentMovements(guildId, userId, 10);
        const lines = rows.map((row) => {
          const when = new Date(row.created_at * 1000).toLocaleString("it-IT", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          const sign = row.delta >= 0 ? "+" : "";
          return `\`${when}\` — **${sign}${fmt(row.delta)} 🪙**${row.reason ? ` · ${row.reason}` : ""}`;
        });
        const embed = new EmbedBuilder()
          .setTitle("📒 Ultimi movimenti")
          .setColor(COLORS.blurple)
          .setDescription(lines.length ? lines.join("\n") : "Nessun movimento registrato.");
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      case "classifica": {
        const top = econ.topBalances(guildId, 10);
        const medal = (i) => ["🥇", "🥈", "🥉"][i] ?? `**${i + 1}.**`;
        const lines = top.map(
          (row, i) => `${medal(i)} <@${row.user_id}> — **${fmt(row.balance)} 🪙**`
        );
        const embed = new EmbedBuilder()
          .setTitle("💰 I più ricchi del server")
          .setColor(COLORS.gold)
          .setDescription(
            lines.length ? lines.join("\n") : "Nessun conto ancora aperto: gioca con `/giochi`!"
          );
        return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      }

      default:
        return ephemeral(interaction, "Sottocomando sconosciuto.");
    }
  },
};
