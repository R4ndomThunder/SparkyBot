const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Wordle } = require('discord-gamecord')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordle')
        .setDescription('Play Wordle'),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const Game = new Wordle({
            message: interaction,
            isSlashGame: true,
            embed: {
                title: 'Wordle',
                color: '#223f98',
            },
            customWord: null,
            timeoutTime: 120000,
            winMessage: 'You won! The word was **{word}**.',
            loseMessage: 'You lost! The word was **{word}**.',
            playerOnlyMessage: 'Only {player} can use these buttons.'
        });

        Game.startGame();
        Game.on('gameOver', result => {
            // console.log(result);  // =>  { result... }
        });
    }
}