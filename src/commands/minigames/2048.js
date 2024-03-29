const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { TwoZeroFourEight } = require('discord-gamecord');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('2048')
        .setDescription('Play 2048'),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const Game = new TwoZeroFourEight({
            message: interaction,
            isSlashGame: true,
            embed: {
                title: '2048',
                color: '#223f98'
            },
            emojis: {
                up: '⬆️',
                down: '⬇️',
                left: '⬅️',
                right: '➡️',
            },
            timeoutTime: 60000,
            buttonStyle: 'PRIMARY',
            playerOnlyMessage: 'Only {player} can use these buttons.'
        });

        Game.startGame();

        Game.on('gameOver', async (result) => {           
        });
    }
}