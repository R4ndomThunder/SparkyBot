const { SlashCommandBuilder } = require("discord.js");
const { Hangman } = require('discord-gamecord');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('Play Hangman')
        .addStringOption(option =>
            option
                .setName('theme')
                .setDescription('Select your theme')
                .addChoices(
                    { name: 'Nature', value: 'nature' },
                    { name: 'Sport', value: 'sport' },
                    { name: 'Color', value: 'color' },
                    { name: 'Camp', value: 'camp' },
                    { name: 'Fruit', value: 'fruit' },
                    { name: 'Discord', value: 'discord' },
                    { name: 'Winter', value: 'winter' },
                    { name: 'Pokémon', value: 'pokemon' }
                )
                .setRequired(true)
        ),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {

        const { options } = interaction;

        const theme = options.getString('theme')

        const Game = new Hangman({
            message: interaction,
            isSlashGame: true,
            embed: {
                title: 'Hangman',
                color: '#223f98'
            },
            hangman: { hat: '🎩', head: '😟', shirt: '👕', pants: '🩳', boots: '👞👞' },
            timeoutTime: 60000,
            theme: theme,
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