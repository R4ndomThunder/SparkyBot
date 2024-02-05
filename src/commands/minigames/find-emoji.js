const { SlashCommandBuilder } = require("discord.js");
const { FindEmoji } = require('discord-gamecord');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('find-emoji')
        .setDescription('Play Find Emoji'),        
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {

        const Game = new FindEmoji({
            message: interaction,
            isSlashGame: true,
            embed: {
              title: 'Find Emoji',
              color: '#223f98',
              description: 'Remember the emojis from the board below.',
              findDescription: 'Find the {emoji} emoji before the time runs out.'
            },
            timeoutTime: 60000,
            hideEmojiTime: 5000,
            buttonStyle: 'PRIMARY',
            emojis: ['🍉', '🍇', '🍊', '🍋', '🥭', '🍎', '🍏', '🥝'],
            winMessage: 'You won! You selected the correct emoji. {emoji}',
            loseMessage: 'You lost! You selected the wrong emoji. {emoji}',
            timeoutMessage: 'You lost! You ran out of time. The emoji is {emoji}',
            playerOnlyMessage: 'Only {player} can use these buttons.'
          });
          
          Game.startGame();
          Game.on('gameOver', result => {
            console.log(result);  // =>  { result... }
          });
    }
}