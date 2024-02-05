const {
    SlashCommandBuilder,
    PermissionsBitField,
    EmbedBuilder,
  } = require("discord.js");
  
  module.exports = {
    data: new SlashCommandBuilder()
      .setName("automod")
      .setDescription("Setup AutoMod for  the server")
      .addSubcommand((command) =>
        command
          .setName("flagged-words")
          .setDescription("Block profanity, sexual content, and slurs")
      )
      .addSubcommand((command) =>
        command
          .setName("spam-messages")
          .setDescription("Block messages suspected of spam")
      )
      .addSubcommand((command) =>
        command
          .setName("mention-spam")
          .setDescription(
            "block  messages containing a certain amount of mentions"
          )
          .addIntegerOption((option) =>
            option
              .setName("number")
              .setDescription(
                "The number of mentions required to block a message"
              )
              .setRequired(true)
          )
      )
      .addSubcommand((command) =>
        command
          .setName("keyword")
          .setDescription("Block a given keyword in the server")
          .addStringOption((option) =>
            option
              .setName("word")
              .setDescription("The word to block")
              .setRequired(true)
          )
      )
      .setDMPermission(false)
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    run: async ({ interaction, client }) => {
      const { guild, options } = interaction;
      const sub = options.getSubcommand();
  
      switch (sub) {
        case "flagged-words":
          await interaction.reply({
            content:
              "<a:loading:1149044133202243604> Loading your AutoMod rules...",
          });
  
          const rule = await guild.autoModerationRules
            .create({
              name: "Block profanity, sexual content, and slurs by Sparky",
              creatorId: "1095254484915081366",
              enabled: true,
              eventType: 1,
              triggerType: 4,
              triggerMetadata: {
                presets: [1, 2, 3],
              },
              actions: [
                {
                  type: 1,
                  metadata: {
                    channel: interaction.channel,
                    durationSeconds: 10,
                    customMessage:
                      "This  message was prevented by Sparky auto moderation",
                  },
                },
              ],
            })
            .catch(async (err) => {
              setTimeout(async () => {
                console.log(err);
                await interaction.editReply({ content: err });
              }, 2000);
            });
  
          setTimeout(async () => {
            if (!rule) return;
  
            const embed = new EmbedBuilder()
              .setColor(0x223f98)
              .setDescription(
                ":white_check_mark: Your AutoMod rule has been created. All swears will be stopped by Sparky"
              );
            await interaction.editReply({ content: "",embeds: [embed] });
          }, 3000);
          break;
  
        case "keyword":
          await interaction.reply({
            content:
              "<a:loading:1149044133202243604> Loading your AutoMod rules...",
          });
  
          const word = options.getString("word");
  
          const rule2 = await guild.autoModerationRules
            .create({
              name: "Prevent the word " + word + " from being used by Sparky",
              creatorId: "1095254484915081366",
              enabled: true,
              eventType: 1,
              triggerType: 1,
              triggerMetadata: {
                keywordFilter: ["" + word],
              },
              actions: [
                {
                  type: 1,
                  metadata: {
                    channel: interaction.channel,
                    durationSeconds: 10,
                    customMessage:
                      "This message was prevented by Sparky auto moderation",
                  },
                },
              ],
            })
            .catch(async (err) => {
              setTimeout(async () => {
                console.log(err);
                await interaction.editReply({ content: err });
              }, 2000);
            });
  
          setTimeout(async () => {
            if (!rule2) return;
  
            const embed2 = new EmbedBuilder()
              .setColor(0x223f98)
              .setDescription(
                ":white_check_mark: Your AutoMod rule has been created. All messages containing the word " +
                  word +
                  " will be deleted by Sparky"
              );
            await interaction.editReply({ content: "", embeds: [embed2] });
          }, 3000);
          break;
  
        case "spam-messages":
          await interaction.reply({
            content:
              "<a:loading:1149044133202243604> Loading your AutoMod rules...",
          });
  
          const rule3 = await guild.autoModerationRules
            .create({
              name: "Prevent spam messages by Sparky",
              creatorId: "1095254484915081366",
              enabled: true,
              eventType: 1,
              triggerType: 3,
              triggerMetadata: {
              },
              actions: [
                {
                  type: 1,
                  metadata: {
                    channel: interaction.channel,
                    durationSeconds: 10,
                    customMessage:
                      "This  message was prevented by Sparky auto moderation",
                  },
                },
              ],
            })
            .catch(async (err) => {
              setTimeout(async () => {
                console.log(err);
                await interaction.editReply({ content: err });
              }, 2000);
            });
  
          setTimeout(async () => {
            if (!rule3) return;
  
            const embed3 = new EmbedBuilder()
              .setColor(0x223f98)
              .setDescription(
                ":white_check_mark: Your AutoMod rule has been created. All messages suspected of spam will be deleted by Sparky"
              );
            await interaction.editReply({content: "", embeds: [embed3] });
          }, 3000);
          break;
  
        case "mention-spam":
          await interaction.reply({
            content:
              "<a:loading:1149044133202243604> Loading your AutoMod rules...",
          });
  
          const number = options.getInteger("number");
  
          const rule4 = await guild.autoModerationRules
            .create({
              name: "Prevent spam mentions by Sparky",
              creatorId: "1095254484915081366",
              enabled: true,
              eventType: 1,
              triggerType: 5,
              triggerMetadata: {
                mentionTotalLimit: number,
              },
              actions: [
                {
                  type: 1,
                  metadata: {
                    channel: interaction.channel,
                    durationSeconds: 10,
                    customMessage:
                      "This message was prevented by Sparky auto moderation",
                  },
                },
              ],
            })
            .catch(async (err) => {
              setTimeout(async () => {
                console.log(err);
                await interaction.editReply({ content: err });
              }, 2000);
            });
  
          setTimeout(async () => {
            if (!rule4) return;
  
            const embed4 = new EmbedBuilder()
              .setColor(0x223f98)
              .setDescription(
                ":white_check_mark: Your AutoMod rule has been created. All messages suspected of mention spam will be deleted by Sparky"
              );
            await interaction.editReply({content: "", embeds: [embed4] });
          }, 3000);
          break;
      }
    },
  };
  