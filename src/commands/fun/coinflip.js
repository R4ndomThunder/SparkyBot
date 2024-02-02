const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin'),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        try {
            const { options } = interaction;

            var result = getRandomInt(100) < 50 ? 'heads' : 'tails';

            const embed = new EmbedBuilder()
                .setAuthor({ iconURL: interaction.user.avatarURL(), name: `${interaction.user.displayName}`, })
                .setColor(0xFBD462)
                .setTitle(`It's ${result}`)
                .setImage(result == 'heads' ? 'https://rollthedice.online/assets/images/upload/dice/dado-cara-cruz/cara_moneda.png' : 'https://rollthedice.online/assets/images/upload/dice/dado-cara-cruz/cruz_moneda.png')
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
