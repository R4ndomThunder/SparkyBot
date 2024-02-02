const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Replies with Pong!"),
    run: async ({ interaction, client }) => {
        await interaction.deferReply();

        const reply = await interaction.fetchReply();
        const ping = reply.createdTimestamp - interaction.createdTimestamp;

        const embed = new EmbedBuilder()
            .setColor('White')
            .setTitle(`**Pong!**`)
            .addFields({ name: 'Client', value: `> ${ping} ms`, inline: true }, { name: 'Websocket', value: `> ${client.ws.ping} ms`, inline: true })
            .setFooter({ text: `Test bot's ping` })
            .setTimestamp()

        await interaction.editReply({ embeds: [embed] }
        );
    },
};
