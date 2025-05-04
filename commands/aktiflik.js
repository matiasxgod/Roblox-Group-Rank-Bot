const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('aktiflik')
        .setDescription('Oyun ile ilgili aktiflik bilgilerini sorgular')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sorgu')
                .setDescription('Oyun sunucusunun aktiflik durumunu sorgular')),
    execute: async function(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'sorgu') {
            await interaction.deferReply();
            
            try {
                const placeId = process.env.ROBLOX_PLACE_ID; // .env dosyasına ekleyin
                const response = await axios.get(`https://games.roblox.com/v1/games?universeIds=${placeId}`);
                
                if (response.data.data && response.data.data.length > 0) {
                    const gameData = response.data.data[0];
                    const playerCount = gameData.playing || 0;
                    
                    const embed = new EmbedBuilder()
                        .setColor('#0000FF')
                        .setTitle('Aktiflik Sorgu')
                        .setDescription(`**Aktif Oyuncu Sayısı:** ${playerCount}`)
                        .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.editReply('Oyun bilgisi alınamadı.');
                }
            } catch (error) {
                console.error(`Aktiflik sorgu hatası: ${error.message}`);
                await interaction.editReply('Oyun aktiflik bilgisi alınırken bir hata oluştu.');
            }
        }
    }
};