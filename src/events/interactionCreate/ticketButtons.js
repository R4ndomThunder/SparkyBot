const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
} = require("discord.js");
const Ticket = require("../../models/ticket.js");
const { createTranscript } = require("discord-html-transcripts");

module.exports = async (interaction, client) => {
    try {
        if (interaction.partial) {
            try {
                await interaction.fetch();
            } catch (e) {
                console.error(`Something went wrong when fetching the message: ${e}`);
            }
        }

        if (interaction.isButton() && interaction.customId == 'close-ticket') {

            const data = await Ticket.findOne({ guildId: interaction.guild.id });

            const channel = interaction.channel;
            
            const file = await createTranscript(channel, {
                returnBuffer: false,
                filename: `${channel.name.toLowerCase()}-transcript.html`,
            });

            (await channel).delete();
            
            let cache = client.channels.cache.get(data.transcript);
            let msg = await cache.send({ files: [file] });

            const button = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel("View transcription")
                    .setURL(`${msg.attachments.first()?.url}`)
                    .setStyle(ButtonStyle.Link)
            );

            const dmEmbed = new EmbedBuilder()
                .setColor(0x223f98)
                .setTitle("Your ticket has been closed")
                .setDescription(
                    "Thanks for contacting us! If you need anything else, feel free to create another ticket"
                )
                .setFooter({ text: `${interaction.guild.name} tickets` })
                .setTimestamp();

            await interaction.member
                .send({ embeds: [dmEmbed], components: [button] })
                .catch((err) => {
                    return console.error(err);
                });
        }
    } catch (err) { console.error(err); }
}