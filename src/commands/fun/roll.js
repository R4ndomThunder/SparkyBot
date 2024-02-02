
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll a dice')
        .addStringOption(option => option.setDescription('The quantity and type of dices to roll (eg. 3d6 or 2d10)').setName('dices').setRequired(true)
        ),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {

        try {
            const { options } = interaction;

            const dice = await options.getString('dices').split('d')

            const quantity = parseInt(dice[0])
            const type = parseInt(dice[1])

            let result = ''
            for (var i = 0; i < quantity; i++) {
                result += `${getRandomInt(type) + 1} `
            }


            const embed = new EmbedBuilder()
                .setAuthor({ iconURL: interaction.user.avatarURL(), name: `${interaction.user.displayName}`, })
                .setThumbnail('https://cdn.pixabay.com/photo/2017/08/31/04/01/d20-2699387_1280.png')
                .setColor('Red')
                .addFields({ name: 'Rolls', value: `${result}` })
                .setTimestamp()

            await interaction.reply({ embeds: [embed] })
        }
        catch (err) {
            console.error(err)
        }
    }
}

function getRandomInt(max) {
    return Math.floor(Math.random() * max);
}
