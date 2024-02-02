const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('test'),
    options:
    {
        deleted: true
    },
    run: async ({ interaction, client }) => {
    //    const memb = await client.members.fetch('346698714347339777')
    //     console.log(memb)
    }
}