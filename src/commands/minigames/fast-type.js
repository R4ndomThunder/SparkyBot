const { SlashCommandBuilder } = require("discord.js");
const { FastType } = require('discord-gamecord');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fast-type')
        .setDescription('Play Fast Type'),        
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const Game = new FastType({
            message: interaction,
            isSlashGame: true,
            embed: {
              title: 'Fast Type',
              color: '#223f98',
              description: 'You have {time} seconds to type the sentence below.'
            },
            timeoutTime: 60000,
            sentence: 'Some really cool sentence to fast type.',
            winMessage: 'You won! You finished the type race in {time} seconds with wpm of {wpm}.',
            loseMessage: 'You lost! You didn\'t type the correct sentence in time.',
          });
          
          Game.startGame();
          Game.on('gameOver', result => {
            console.log(result);  // =>  { result... }
          });
    }
}