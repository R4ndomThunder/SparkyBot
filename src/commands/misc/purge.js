const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('purge')
        .setDescription('Delete a number of messages from a channel (limit 100).')
        .addIntegerOption(option =>
            option
                .setName('limit')
                .setDescription('How many messages you want to purge')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        const { options } = interaction;
        let number = options.getInteger('limit')

        const embed = new EmbedBuilder()
            .setColor(0x223f98)
            .setDescription(`:white_check_mark: Deleted **${number}** messages`)

        await interaction.channel.bulkDelete(number)
            .catch(async (err) => {
                const embed = new EmbedBuilder()
                    .setColor(0x223f98)
                    .setDescription(`❌ Error deleting **${number}** messages\n\`${err.message}\``)

                return await interaction.reply({ embeds: [embed], ephemeral: true })
            })

        await interaction.reply({ embeds: [embed], ephemeral: true })
    }
}