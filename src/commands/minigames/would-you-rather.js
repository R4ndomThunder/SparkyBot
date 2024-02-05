const { SlashCommandBuilder } = require("discord.js");
const { WouldYouRather } = require('discord-gamecord');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('would-you-rather')
        .setDescription('Play Would You Rather'),        
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {

        const Game = new WouldYouRather({
            message: message,
            isSlashGame: true,
            embed: {
              title: 'Would You Rather',
              color: '#223f98',
            },
            buttons: {
              option1: 'Option 1',
              option2: 'Option 2',
            },
            timeoutTime: 60000,
            errMessage: 'Unable to fetch question data! Please try again.',
            playerOnlyMessage: 'Only {player} can use these buttons.'
          });
          
          Game.startGame();
          
    }
}