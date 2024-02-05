const {
  EmbedBuilder,
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType,
} = require("discord.js");

const CounterTypes_onlyMembers = { name: "Only Members", value: "onlymembers" }
const CounterTypes_onlyBots = { name: "Only Bots", value: "onlybots" }
const CounterTypes_roles = { name: "Members with role", value: "role" }
const CounterTypes_allMembers = { name: "Members & Bots", value: "allmembers" }
const CounterTypes_status = { name: "Members with status", value: "status" }

const ChannelCounter = require("../../models/channelCounter.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Manage statics counter.")
    .addSubcommand((command) =>
      command
        .setName("basic-counter")
        .setDescription("Create a new counter in your server")
        .addStringOption((option) =>
          option
            .setName("counter-type")
            .setDescription("The counter you want to create")
            .setRequired(true)
            .addChoices(CounterTypes_onlyMembers, CounterTypes_onlyBots, CounterTypes_allMembers)
        )
    )
    .addSubcommand(command =>
      command
        .setName('role-counter')
        .setDescription('Create a role counter')
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role that you want to count')
            .setRequired(true)
        )
    )
    .addSubcommand(command =>
      command
        .setName('status-counter')
        .setDescription('Create a status counter')
        .addStringOption(option =>
          option
            .setName('status')
            .setDescription('The status that you want to count')
            .addChoices({ name: '🟢 Online', value: 'online' }, { name: '🌙 Idle', value: 'idle' }, { name: '🔴 Do Not Disturb', value: 'dnd' }, { name: '⚫ Offline', value: 'offline' })
            .setRequired(true)
        )
    )
    .addSubcommand(command =>
      command
        .setName('nft-counter')
        .setDescription('Create a nft counter')
        .addStringOption(option =>
          option
            .setName('type')
            .setDescription('The type of the counter')
            .addChoices({ name: 'Floor price', value: 'floor' }, { name: 'Total Sales', value: 'total-sales' }, { name: 'Market Cap', value: 'market_cap' }, { name: 'Owners', value: 'num_owners' })
            .setRequired(true)
        )
        .addStringOption(option =>
          option
            .setName('collection')
            .setDescription('The nft collection slug for the counter')
            .setRequired(true)
        )
    )
    .addSubcommand((command) =>
      command
        .setName("delete")
        .setDescription("Delete one of the existing counters.")
        .addStringOption((option) =>
          option
            .setName("counter-type")
            .setDescription("The counter you want to create")
            .setRequired(true)
            .addChoices(CounterTypes_onlyMembers, CounterTypes_allMembers, CounterTypes_onlyBots, CounterTypes_roles, CounterTypes_status)
        )
        .addRoleOption(option =>
          option
            .setName('role')
            .setDescription('The role counter you want to delete')
            .setRequired(false)
        )
        .addStringOption(option =>
          option.setName('status')
            .setDescription('The status of the counter you want to delete')
            .addChoices({ name: '🟢 Online', value: 'online' }, { name: '🌙 Idle', value: 'idle' }, { name: '🔴 Do Not Disturb', value: 'dnd' }, { name: '⚫ Offline', value: 'offline' })
        )
    )
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  options: {
    deleted: false,
    devOnly: false,
  },
  run: async ({ interaction, client }) => {
    const { options } = interaction;

    const sub = options.getSubcommand()

    switch (sub) {
      case 'basic-counter':
        {
          const counterType = options.getString('counter-type')
          let guildCounter = await ChannelCounter.findOne({ guildId: interaction.guild.id })
          let guildMembers = interaction.guild.members.cache
          if (!guildCounter) {
            guildCounter = await ChannelCounter.create({
              guildId: interaction.guild.id,
              counters: []
            })
            await guildCounter.save()
          }

          if (!guildCounter.counters.includes({ counterType: counterType })) {
            let name = ''
            if (counterType == 'allmembers') {
              name = `Members: ${guildMembers.size}`
            }

            if (counterType == 'onlymembers') {
              const count = await guildMembers.filter(member => !member.user.bot)
              name = `Users: ${count.size}`
            }

            if (counterType == 'onlybots') {
              const count = await guildMembers.filter(member => member.user.bot)
              name = `Bots: ${count.size}`
            }

            const channel = await interaction.guild.channels.create({
              type: ChannelType.GuildVoice,
              name: `${name}`,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect],
                  allow: [PermissionsBitField.Flags.ViewChannel]
                }
              ]
            });

            await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $push: { counters: { channelId: channel.id, counterType: counterType } } })

            const embed = new EmbedBuilder()
              .setTitle('Counter created successfully')
              .setDescription(`A new counter of type: ${counterType} has been created successfully `)
              .setColor('Green')
              .setTimestamp()

            await interaction.reply({ embeds: [embed], ephemeral: true })
          }
          else {
            const embed = new EmbedBuilder()
              .setTitle('Counter creation error')
              .setDescription(`A counter of type: ${counterType} already exists`)
              .setColor('Red')
              .setTimestamp()

            return await interaction.reply({ embeds: [embed], ephemeral: true })
          }
        }
        break;
      case 'role-counter':
        {
          const counterType = options.getString('counter-type')
          const role = options.getRole('role')
          let guildCounter = await ChannelCounter.findOne({ guildId: interaction.guild.id })

          if (!guildCounter) {
            guildCounter = await ChannelCounter.create({
              guildId: interaction.guild.id,
              counters: []
            })
            await guildCounter.save()
          }

          if (!guildCounter.counters.includes({ counterType: 'role', value: role.id })) {

            const members = await role.members
            const count = members.size;

            const channel = await interaction.guild.channels.create({
              type: ChannelType.GuildVoice,
              name: `${role.name}: ${count}`,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect],
                  allow: [PermissionsBitField.Flags.ViewChannel]
                }
              ]
            });

            await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $push: { counters: { channelId: channel.id, counterType: 'role', value: role.id } } })

            const embed = new EmbedBuilder()
              .setTitle('Counter created successfully')
              .setDescription(`A new counter of type: 'role' ${role.name} has been created successfully `)
              .setColor('Green')
              .setTimestamp()

            await interaction.reply({ embeds: [embed], ephemeral: true })
          }
          else {
            const embed = new EmbedBuilder()
              .setTitle('Counter creation error')
              .setDescription(`A counter of type: 'role' ${role.name} already exists`)
              .setColor('Red')
              .setTimestamp()

            return await interaction.reply({ embeds: [embed], ephemeral: true })
          }
        }
        break;
      case 'status-counter':
        {
          const status = options.getString('status')

          let guildCounter = await ChannelCounter.findOne({ guildId: interaction.guild.id })

          if (!guildCounter) {
            guildCounter = await ChannelCounter.create({
              guildId: interaction.guild.id,
              counters: []
            })
            await guildCounter.save()
          }

          if (!guildCounter.counters.includes({ counterType: 'status', value: status })) {
            let count = await guildMembers

            let name = ''

            if (data.value == online.value) {
              name = "Online"
              count = await guildMembers.filter(member => member.presence?.status == online.value)
            }
            else if (data.value == idle.value) {
              name = "Idle"
              count = await guildMembers.filter(member => member.presence?.status == idle.value)
            } else if (data.value == dnd.value) {
              name = "Do not disturb"
              count = await guildMembers.filter(member => member.presence?.status == dnd.value)
            } else if (data.value == offline.value) {
              name = "Offline"
              count = await guildMembers.filter(member => member.presence?.status == offline.value || !member.presence)
            }


            const channel = await interaction.guild.channels.create({
              type: ChannelType.GuildVoice,
              name: `${name}: ${count}`,
              permissionOverwrites: [
                {
                  id: interaction.guild.id,
                  deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect],
                  allow: [PermissionsBitField.Flags.ViewChannel]
                }
              ]
            });

            await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $push: { counters: { channelId: channel.id, counterType: 'status', value: status } } })

            const embed = new EmbedBuilder()
              .setTitle('Counter created successfully')
              .setDescription(`A new counter of type: 'status' ${status} has been created successfully `)
              .setColor('Green')
              .setTimestamp()

            await interaction.reply({ embeds: [embed], ephemeral: true })
          }
          else {
            const embed = new EmbedBuilder()
              .setTitle('Counter creation error')
              .setDescription(`A counter of type: 'status' ${status} already exists`)
              .setColor('Red')
              .setTimestamp()

            return await interaction.reply({ embeds: [embed], ephemeral: true })
          }
        }
        break;
      case 'nft-counter': {
        const type = options.getString('type')
        const collection = options.getString('collection')

        let guildCounter = await ChannelCounter.findOne({ guildId: interaction.guild.id })

        if (!guildCounter) {
          guildCounter = await ChannelCounter.create({
            guildId: interaction.guild.id,
            counters: []
          })
          await guildCounter.save()
        }

        if (!guildCounter.counters.includes({ counterType: type, value: collection })) {
          const channel = await interaction.guild.channels.create({
            type: ChannelType.GuildVoice,
            name: `${type} - ${collection}`,
            permissionOverwrites: [
              {
                id: interaction.guild.id,
                deny: [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.Connect],
                allow: [PermissionsBitField.Flags.ViewChannel]
              }
            ]
          });

          await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $push: { counters: { channelId: channel.id, counterType: type, value: collection } } })

          const embed = new EmbedBuilder()
            .setTitle('Counter created successfully')
            .setDescription(`A new counter of type: ${type} - ${collection} has been created successfully `)
            .setColor('Green')
            .setTimestamp()

          await interaction.reply({ embeds: [embed], ephemeral: true })
        }
        else {
          const embed = new EmbedBuilder()
            .setTitle('Counter creation error')
            .setDescription(`A counter of type: ${type} - ${collection} already exists`)
            .setColor('Red')
            .setTimestamp()

          return await interaction.reply({ embeds: [embed], ephemeral: true })
        }
      }
        break;
      case 'delete':
        const counterType = options.getString('counter-type')

        const role = options.getRole('role')
        const status = options.getString('status')

        let guildCounter = await ChannelCounter.findOne({ guildId: interaction.guild.id })
        if (!guildCounter) {
          const embed = new EmbedBuilder()
            .setTitle('Cannot delete counter')
            .setDescription(`The counter of type: ${counterType} not exists `)
            .setColor('Red')
            .setTimestamp()

          return await interaction.reply({ embeds: [embed], ephemeral: true })
        }

        if (role) {
          const data = await guildCounter.counters.filter(c => c.counterType == 'role' && c.value == role.id)
          const ch = await interaction.guild.channels.fetch(data[0].channelId);
          if (ch)
            await ch.delete()

          await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $pull: { counters: { counterType: 'role', value: role.id } } })
        }
        else if (status) {

          const data = await guildCounter.counters.filter(c => c.counterType == 'status' && c.value == status)
          const ch = await interaction.guild.channels.fetch(data[0].channelId);
          if (ch)
            await ch.delete()

          await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $pull: { counters: { counterType: 'status', value: status } } })
        }
        else {
          const data = await guildCounter.counters.filter(c => c.counterType == counterType)
          const ch = await interaction.guild.channels.fetch(data[0].channelId);
          if (ch)
            await ch.delete()

          await ChannelCounter.updateOne({ guildId: interaction.guild.id }, { $pull: { counters: { counterType: counterType } } })
        }

        const embed = new EmbedBuilder()
          .setTitle('Counter deleted successfully')
          .setDescription(`The counter of type: ${counterType} has been deleted successfully `)
          .setColor('Green')
          .setTimestamp()

        await interaction.reply({ embeds: [embed], ephemeral: true })

        break;
    }


  },
};