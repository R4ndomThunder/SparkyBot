const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField } = require("discord.js");
const autopublish = require("../../models/autopubblish.js");
module.exports = {
    data: new SlashCommandBuilder()
        .setName('autopublish')
        .setDescription('Setup and disable your auto publisher system')
        .addSubcommand(command =>
            command
                .setName('setup')
                .setDescription('Adds a channel to the auto publisher channel')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel you want to add to autopublish')
                        .addChannelTypes(ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
        )
        .addSubcommand(command =>
            command
                .setName('disable')
                .setDescription('Removes a channel to the auto publisher channel')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel you want to remove to autopublish')
                        .addChannelTypes(ChannelType.GuildAnnouncement)
                        .setRequired(true)
                )
        )
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    options:
    {
        deleted: false
    },
    run: async ({ interaction, client }) => {
        try {
            const { options } = interaction

            const sub = options.getSubcommand()
            const channel = options.getChannel('channel')

            switch (sub) {
                case 'setup':
                    {
                        const data = await autopublish.findOne({ guildId: interaction.guild.id })
                        const embed = new EmbedBuilder()
                            .setColor(0x223f98)
                            .setDescription(`📢 All messages sent in ${channel} will be auto published!`)

                        if (!data) {
                            await interaction.reply({ embeds: [embed], ephemeral: true })

                            await autopublish.create({
                                guildId: interaction.guild.id,
                                channels: []
                            })

                            await autopublish.updateOne({ guildId: interaction.guild.id }, { $push: { channels: channel.id } })
                        }
                        else {
                            if (data.channels.includes(channel.id)) return await interaction.reply({ content: 'The channel you selected has already been setup for auto publishing!', ephemeral: true })

                            await autopublish.updateOne({ guildId: interaction.guild.id }, { $push: { channels: channel.id } })
                            await interaction.reply({ embeds: [embed], ephemeral: true })
                        }
                    }
                    break;
                case 'disable':
                    const data = await autopublish.findOne({ guildId: interaction.guild.id })
                    if (!data)
                        return await interaction.reply({ content: 'You have not added any channels to the auto publish system', ephemeral: true })
                    else {
                        const embed = new EmbedBuilder()
                            .setColor(0x223f98)
                            .setDescription(`${channel} has been removed off of your auto publish list`)


                        await interaction.reply({ embeds: [embed], ephemeral: true })
                        await autopublish.updateOne({ guildId: interaction.guild.id }, { $pull: { channels: channel.id } })
                    }
                    break;
            }
        } catch (err) {
            console.error(err)
        }
    }
}