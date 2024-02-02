const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle, PermissionsBitField,
  ChannelType,
} = require("discord.js");
const Ticket = require("../../models/ticket.js");
const { createTranscript } = require("discord-html-transcripts");

module.exports = async (interaction, client) => {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId == "ticketModal") {
        const data = await Ticket.findOne({ guildId: interaction.guild.id });
        const usernameInput = interaction.fields.getTextInputValue("username");
        const reasonInput = interaction.fields.getTextInputValue("reason");

        const posChannel = await interaction.guild.channels.cache.find(
          (c) => c.name === `ticket-${interaction.user.username}`
        );
        if (posChannel)
          return await interaction.reply({
            content: `You already have a ticket open - ${posChannel}`,
            ephemeral: true,
          });

        const category = data.channel;

        const embed = new EmbedBuilder()
          .setColor("Blue")
          .setTitle(`${interaction.user.username}'s Ticket`)
          .setDescription(
            "Welcome to your ticket Please wait while the staff review your information"
          )
          .addFields({ name: "Username", value: `${usernameInput}` })
          .addFields({ name: "Reason", value: `${reasonInput}` })
          .addFields({ name: "Type", value: `${data.ticket}` })
          .setFooter({ text: `${interaction.guild.name} tickets` });

        const button = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("close-ticket")
            .setLabel(`🗑️ Close Ticket`)
            .setStyle(ButtonStyle.Danger)
        );

        let channel = await interaction.guild.channels.create({
          name: `ticket-${interaction.user.username}`,
          type: ChannelType.GuildText,
          parent: `${category}`,
          permissionOverwrites: [
            {
              id: interaction.user.id,
              allow: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ViewChannel],
            },
            {
              id: interaction.guild.id, 
              deny: [PermissionsBitField.Flags.ViewChannel]
            }            
          ]

        });

        let msg = await channel.send({ embeds: [embed], components: [button] });
        await interaction.reply({
          content: `Your ticket is now open in ${channel}`,
          ephemeral: true,
        });
        const collector = msg.createMessageComponentCollector();

        collector.on("collect", async (i) => {
          
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
            .setColor("Blue")
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
        });
      }
    }
  } catch (err) {
    console.error(err);
  }
};
