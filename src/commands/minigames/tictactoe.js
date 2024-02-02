const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { TicTacToe } = require('discord-gamecord')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('tic-tac-toe')
        .setDescription('Play Tic Tac Toe')
        .addUserOption(option =>
            option
                .setName('opponent')
                .setDescription('The person to play against')
                .setRequired(true)
        ),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {

        const { options } = interaction;

        const opponent = options.getUser('opponent');

        const Game = new TicTacToe({
            message: interaction,
            isSlashGame: true,
            opponent: opponent,
            embed: {
                title: 'Tic Tac Toe',
                color: '#5865F2',
                statusTitle: 'Status',
                overTitle: 'Game Over'
            },
            emojis: {
                xButton: '❌',
                oButton: '🔵',
                blankButton: '➖'
            },
            mentionUser: true,
            timeoutTime: 60000,
            xButtonStyle: 'DANGER',
            oButtonStyle: 'PRIMARY',
            turnMessage: '{emoji} | Its turn of player **{player}**.',
            winMessage: '{emoji} | **{player}** won the TicTacToe Game.',
            tieMessage: 'The Game tied! No one won the Game!',
            timeoutMessage: 'The Game went unfinished! No one won the Game!',
            playerOnlyMessage: 'Only {player} and {opponent} can use these buttons.'
        });

        Game.startGame();
        Game.on('gameOver', result => {
            // console.log(result);  // =>  { result... }
        });
    }
}