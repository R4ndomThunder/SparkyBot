const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { Slots } = require('discord-gamecord')
module.exports = {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Play slot machines'),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const Game = new Slots({
            message: interaction,
            isSlashGame: true,
            embed: {
                title: 'Slot Machine',
                color: '#223f98'
            },
            slots: ['🍇', '🍊', '🍋', '🍌']
        });

        Game.startGame();
        Game.on('gameOver', async (result) => {
            // const embed = new EmbedBuilder()
            //     .setTitle(result.result)
            //     // .setDescription(`Your score: ${result.score}`)
            //     .setTimestamp()

            // await interaction.channel.send({ embeds: [embed] })
        });
    }
}