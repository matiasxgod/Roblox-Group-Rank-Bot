const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
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
                const universeId = process.env.ROBLOX_PLACE_ID; // .env dosyasına ekleyin
                
                // Noblox.js ile oyun bilgisini al
                const gameInfo = await noblox.getUniverseInfo([universeId]);
                
                if (gameInfo && gameInfo.length > 0) {
                    // Oyun bilgisinden aktif oyuncu sayısını al
                    const playerCount = gameInfo[0].playing || 0;
                    
                    // Noblox.js ile oyun sunucularını kontrol et
                    try {
                        // Sunucuları al (ilk 100 sunucu)
                        const gameInstances = await noblox.getGameInstances(universeId, "Public", "Asc", 100);
                        
                        // Tüm sunuculardaki oyuncu sayılarını topla
                        let totalPlayers = 0;
                        for (const server of gameInstances) {
                            totalPlayers += server.playing;
                        }
                        
                        // En güncel oyuncu sayısını kullan
                        const finalPlayerCount = Math.max(playerCount, totalPlayers);
                        
                        const embed = new EmbedBuilder()
                            .setColor('#0000FF')
                            .setTitle('Aktiflik Sorgu')
                            .setDescription(`**Aktif Oyuncu Sayısı:** ${finalPlayerCount}`)
                            .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                            .setTimestamp();
                        
                        await interaction.editReply({ embeds: [embed] });
                    } catch (secondError) {
                        console.log("Sunucu bilgisi hatası:", secondError.message);
                        
                        // İkinci istek başarısız olursa, ilk istek sonucunu kullan
                        const embed = new EmbedBuilder()
                            .setColor('#0000FF')
                            .setTitle('Aktiflik Sorgu')
                            .setDescription(`**Aktif Oyuncu Sayısı:** ${playerCount}`)
                            .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                            .setTimestamp();
                        
                        await interaction.editReply({ embeds: [embed] });
                    }
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