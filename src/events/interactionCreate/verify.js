const Captcha = require("../../models/captcha.js");

module.exports = async (interaction, client) => {

    if (interaction.partial) {
        try {
            await interaction.fetch();
        } catch (e) {
            console.error(`Something went wrong when fetching the message: ${e}`);
        }
    }

    if (interaction.isModalSubmit()) return;

    if (interaction.customId !== "capModal") return;
    console.log("Interaction is capModal");

    const Data = await Captcha.findOne({ guildId: client.guild.id });
    const answer = interaction.fields.getTextInputValue("answer");
    const cap = Data.captcha;

    if (answer != cap)
        return await interaction.reply({
            content: "That was wrong! Try again.",
            ephemeral: true,
        });

    const capGuild = await client.guilds.fetch(client.guild.id);
    const role = await capGuild.roles.cache.get(Data.role);

    const member = await capGuild.members.fetch(interaction.user.id);
    await member.roles.add(role).catch((err) => {
        interaction.reply({ content: "Error on role assignment", ephemeral: true });
    });

    interaction.reply({ content: "You have been verified!", ephemeral: true });
};
