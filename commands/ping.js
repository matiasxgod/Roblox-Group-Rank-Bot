const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Botun gecikmesini gösterir.'),
    execute: async function(interaction) {
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.reply(`Botun gecikmesi: ${latency}ms`);
    }
};