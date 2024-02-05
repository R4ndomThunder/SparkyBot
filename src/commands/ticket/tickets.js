const {
  PermissionsBitField,
  EmbedBuilder,
  ChannelType,
  ActionRowBuilder,
  SelectMenuBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const Ticket = require("../../models/ticket.js");
module.exports = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("This sets up the ticket message and system.")
    .addSubcommand((command) =>
      command
        .setName("setup")
        .setDescription("This sets up the ticket message and system")
        .addChannelOption((option) =>
          option
            .setName("channel")
            .setDescription(
              "The channel you want to send the ticket message in"
            )
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName("category")
            .setDescription("The category you want the tickets to be sent in")
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(true)
        )
        .addChannelOption((option) =>
          option
            .setName('transcript')
            .setDescription("The channel where you want to send the transcription")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        ))
    .addSubcommand((command) =>
      command
        .setName("disable")
        .setDescription("That disables the ticket message and system")
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  options: {},
  run: async ({ interaction, client }) => {
    const { guild, options } = interaction;
    const sub = options.getSubcommand();

    switch (sub) {
      case "setup":
        const channel = interaction.options.getChannel("channel");
        const category = interaction.options.getChannel("category");
        const transcript = interaction.options.getChannel("transcript");

        const data = await Ticket.findOne({ guildId: interaction.guild.id });
        if (!data) {
          await Ticket.create({
            guildId: interaction.guild.id,
            channel: category.id,
            transcript: transcript.id,
            ticket: "first",
          });
        } else {
          return await interaction.reply({
            content:
              "You already have a ticket message set up. You can run /ticket disable to remove it and restart",
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x223f98)
          .setTitle("🎫 Ticket System")
          .setDescription(
            "**If you have a problem, open a ticket to talk to staff members!**"
          )
          .setFooter({ text: interaction.guild.name + " Tickets" });

        const menu = new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("select")
            .setMaxValues(1)
            .setPlaceholder("Select a topic")
            .addOptions(
              {
                label: "🔧 General Support",
                value: "Subject: General Support",
              },

              {
                label: "🌐 Moderation Support",
                value: "Subject: Moderation Support",
              },
              {
                label: "🤖 Bot Support",
                value: "Subject: Bot Support",
              },
              {
                label: "💭 Other",
                value: "Subject: Other",
              }
            )
        );

        await channel.send({ embeds: [embed], components: [menu] });
        await interaction.reply({
          content: "Your ticket system has been set up in " + channel,
          ephemeral: true,
        });
        break;
      case "disable":
        await Ticket.deleteMany({ guildId: interaction.guild.id });

        await interaction.reply({
          content: "Your ticket system has been removed",
          ephemeral: true,
        });
        break;
    }
  },
};
