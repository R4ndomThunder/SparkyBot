const { SlashCommandBuilder } = require("discord.js");
const { Minesweeper } = require("discord-gamecord");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("minesweeper")
    .setDescription("Play Mainsweeper"),
  options: {
    deleted: false,
  },
  run: async ({ interaction, client }) => {
    const Game = new Minesweeper({
      message: interaction,
      isSlashGame: true,
      embed: {
        title: "Minesweeper",
        color: "#223f98",
        description: "Click on the buttons to reveal the blocks except mines.",
      },
      emojis: { flag: "🚩", mine: "💣" },
      mines: 5,
      timeoutTime: 60000,
      winMessage: "You won the Game! You successfully avoided all the mines.",
      loseMessage: "You lost the Game! Beaware of the mines next time.",
      playerOnlyMessage: "Only {player} can use these buttons.",
    });

    Game.startGame();
    Game.on("gameOver", (result) => {
      console.log(result); // =>  { result... }
    });
  },
};
