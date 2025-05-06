const { SlashCommandBuilder } = require('discord.js');
const noblox = require('noblox.js');
const { linkUser, checkUserLinkStatus } = require('../utils/robloxDatabase');
const logger = require('../utils/logger'); // Logger'ı ekleyelim

module.exports = {
    data: new SlashCommandBuilder()
        .setName('yenile')
        .setDescription('RoWifi\'ye bağlı Roblox hesabınızı bot veritabanına kaydeder')
        .setDMPermission(false),
    
    execute: async function(interaction) {
        await interaction.deferReply();
        
        const discordId = interaction.user.id;
        
        try {
            // Mevcut durumu kontrol et
            const currentStatus = await checkUserLinkStatus(discordId);
            let statusMessage = "";
            
            if (currentStatus.linked) {
                statusMessage = `Mevcut bağlantı: **${currentStatus.robloxUsername}** (${currentStatus.robloxId})\n`;
                logger.info(`Kullanıcının mevcut bağlantısı kontrol edildi`, {
                    discord: `${interaction.user.tag} (${discordId})`,
                    roblox: `${currentStatus.robloxUsername} (${currentStatus.robloxId})`
                });
            }
            
            await interaction.editReply(`${statusMessage}RoWifi bilgileriniz kontrol ediliyor, lütfen bekleyin...`);
            
            // Kullanıcının Discord üzerindeki rollerini ve bilgilerini al
            const member = await interaction.guild.members.fetch(discordId);
            
            // RoWifi sistemini kontrol et - ilk olarak roller üzerinden
            const roWifiRoles = member.roles.cache.filter(role => 
                role.name.includes('Verified') || 
                role.name.includes('Roblox') || 
                /^\d+$/.test(role.name) // Sadece sayılardan oluşan roller
            );
            
            let robloxUsername = null;
            let robloxId = null;
            
            // 1. Yöntem: Sunucudaki isim formatından Roblox bilgisini çıkarma
            const nickname = member.nickname || member.user.username;
            logger.debug(`Kullanıcı ismi kontrol ediliyor`, { nickname });
            
            // Farklı RoWifi format tiplerini dene
            if (nickname.includes('|')) {
                robloxUsername = nickname.split('|')[1].trim();
                logger.debug(`Kullanıcı adı '|' formatından alındı`, { robloxUsername });
            } 
            else if (nickname.includes('[') && nickname.includes(']')) {
                const match = nickname.match(/\[(.*?)\]/);
                if (match && match[1]) {
                    robloxUsername = match[1].trim();
                    logger.debug(`Kullanıcı adı '[]' formatından alındı`, { robloxUsername });
                }
            }
            else {
                robloxUsername = nickname;
                logger.debug(`Kullanıcı adı direkt nickname olarak alındı`, { robloxUsername });
            }
            
            // 2. Yöntem: RoWifi rolleri kontrol et
            if (!robloxId && roWifiRoles.size > 0) {
                logger.debug(`RoWifi rolleri kontrol ediliyor`, { 
                    roles: roWifiRoles.map(r => r.name).join(', ') 
                });
                
                for (const [_, role] of roWifiRoles) {
                    // RoWifi bazen rollere Roblox ID'leri ekler
                    const idMatch = role.name.match(/(\d{4,12})/);
                    if (idMatch && idMatch[1]) {
                        const possibleId = idMatch[1];
                        try {
                            // Bu bir Roblox ID mi kontrol et
                            const username = await noblox.getUsernameFromId(possibleId);
                            if (username) {
                                robloxId = parseInt(possibleId);
                                robloxUsername = username;
                                logger.debug(`Roblox ID rol üzerinden bulundu`, { 
                                    robloxId, 
                                    robloxUsername,
                                    role: role.name
                                });
                                break;
                            }
                        } catch (error) {
                            // Bu bir Roblox ID değil, devam et
                            logger.debug(`${possibleId} bir Roblox ID değil`, { error: error.message });
                        }
                    }
                }
            }
            
            // Eğer hiçbir şekilde kullanıcı adı bulunamazsa
            if (!robloxUsername && !robloxId) {
                logger.warning(`Roblox hesabı bulunamadı`, {
                    discord: `${interaction.user.tag} (${discordId})`,
                    nickname
                });
                
                return interaction.editReply(
                    'RoWifi\'ye bağlı Roblox hesabınız bulunamadı. ' +
                    'Lütfen önce sunucuda `/verify` komutunu kullanarak RoWifi ile hesabınızı doğrulayın, ' +
                    'ardından `/update` komutunu çalıştırın ve tekrar deneyin.'
                );
            }
            
            // Roblox ID yoksa kullanıcı adından alalım
            if (!robloxId && robloxUsername) {
                try {
                    robloxId = await noblox.getIdFromUsername(robloxUsername);
                    logger.debug(`Kullanıcı adından Roblox ID alındı`, { robloxUsername, robloxId });
                } catch (error) {
                    logger.error(`Roblox ID alınamadı`, { 
                        robloxUsername,
                        error: error.message 
                    });
                    
                    return interaction.editReply(`"${robloxUsername}" adlı Roblox kullanıcısı bulunamadı. Lütfen RoWifi ile hesabınızı tekrar doğrulayın.`);
                }
            }
            
            if (!robloxId) {
                logger.error(`Roblox ID bulunamadı`, { 
                    discord: `${interaction.user.tag} (${discordId})`,
                    robloxUsername 
                });
                
                return interaction.editReply(`Roblox hesap bilgileriniz bulunamadı. Lütfen RoWifi ile hesabınızı tekrar doğrulayın.`);
            }
            
            // Roblox kullanıcı adını al (eğer kullanıcı adı olmadan direkt ID ile geldiysek)
            if (!robloxUsername) {
                try {
                    robloxUsername = await noblox.getUsernameFromId(robloxId);
                    logger.debug(`Roblox ID'den kullanıcı adı alındı`, { robloxId, robloxUsername });
                } catch (error) {
                    logger.error(`Kullanıcı adı alınamadı`, { 
                        robloxId, 
                        error: error.message 
                    });
                    
                    return interaction.editReply(`Roblox ID: ${robloxId} için kullanıcı adı alınamadı.`);
                }
            }
            
            // Hesapları bağla
            const success = await linkUser(discordId, robloxId, robloxUsername);
            
            if (success) {
                // Bağlantı başarılı, log at
                logger.robloxLink(interaction.user, robloxUsername, robloxId);
                
                // Basit metin mesajı gönder (embed yerine)
                await interaction.editReply(`**${robloxUsername}** (${robloxId}) adlı Roblox hesabı başarıyla Discord hesabınıza bağlandı.`);
                
                // Eğer Discord sunucusunda hesapların bağlandığı bir log kanalı varsa
                try {
                    const logChannelId = process.env.LOG_CHANNEL_ID; // .env dosyasına ekleyebilirsiniz
                    if (logChannelId) {
                        const logChannel = await interaction.guild.channels.fetch(logChannelId);
                        if (logChannel) {
                            // Log için basit bir mesaj (embed yerine)
                            await logChannel.send(`<@${discordId}> hesabını **${robloxUsername}** (${robloxId}) Roblox hesabına bağladı.`);
                        }
                    }
                } catch (error) {
                    logger.error('Log kanalına mesaj gönderilemedi', { error: error.message });
                    // Kullanıcıya hata göstermeden devam et
                }
                
                return;
            } else {
                logger.error(`Hesap bağlantısı başarısız oldu`, {
                    discord: `${interaction.user.tag} (${discordId})`,
                    robloxUsername,
                    robloxId
                });
                
                return interaction.editReply('Hesap bağlantısı güncellenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
            }
            
        } catch (error) {
            logger.error(`Yenile komutu hatası`, { 
                discord: `${interaction.user.tag} (${discordId})`,
                error: error.message || 'Bilinmeyen hata'
            });
            
            return interaction.editReply(`Hesap bilgileriniz işlenirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`);
        }
    }
};