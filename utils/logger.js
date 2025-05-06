// utils/logger.js - İki farklı log sistemi

const { WebhookClient, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Log konfigürasyonu
const config = {
    // Discord log kanalı ID'si
    channelId: process.env.LOG_CHANNEL_ID || null,
    // Webhook URL'si
    webhookUrl: process.env.LOG_WEBHOOK_URL || null,
    // Dosya loglaması
    fileLogging: true,
    // Konsola yazdırma
    consoleLogging: true,
    // Log dosyası konumu
    logFolder: path.join(__dirname, '../logs'),
    // Günlük log dosyası
    dailyRotate: true
};

// Webhook istemcisi
let webhookClient = null;
if (config.webhookUrl) {
    try {
        webhookClient = new WebhookClient({ url: config.webhookUrl });
    } catch (error) {
        console.error('Webhook oluşturulamadı:', error);
    }
}

// Discord client referansı
let discordClient = null;

// Discord client'ı ayarla
const setDiscordClient = (client) => {
    discordClient = client;
};

// Log dosyası yolunu oluştur
const getLogFile = () => {
    if (!config.fileLogging) return null;
    
    // Klasör yoksa oluştur
    if (!fs.existsSync(config.logFolder)) {
        fs.mkdirSync(config.logFolder, { recursive: true });
    }
    
    // Tarih bilgisi
    const now = new Date();
    const dateStr = config.dailyRotate 
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        : 'bot';
    
    return path.join(config.logFolder, `${dateStr}.log`);
};

// Temel log fonksiyonu
const log = async (level, message, details = {}) => {
    const timestamp = new Date().toISOString();
    
    // Log mesajını biçimlendir
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    const detailsStr = Object.keys(details).length > 0 
        ? `\n${JSON.stringify(details, null, 2)}`
        : '';
    
    // Konsola yazdır
    if (config.consoleLogging) {
        console.log(logMessage + detailsStr);
    }
    
    // Dosyaya yaz
    if (config.fileLogging) {
        const logFile = getLogFile();
        if (logFile) {
            fs.appendFileSync(logFile, logMessage + detailsStr + '\n');
        }
    }
    
    return true;
};

// Webhook ile log gönderme (komut kullanımları için)
const sendWebhookEmbed = async (embed) => {
    if (!webhookClient) return false;
    
    try {
        await webhookClient.send({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error('Log webhook\'a gönderilemedi:', error);
        return false;
    }
};

// Discord kanalına log gönderme (işlem sonuçları için)
const sendChannelEmbed = async (embed) => {
    if (!discordClient || !config.channelId) return false;
    
    try {
        const channel = await discordClient.channels.fetch(config.channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Log kanalına gönderilemedi:', error);
        return false;
    }
};

// Log seviyesine göre renk belirle
const getColorByLevel = (level) => {
    switch(level.toUpperCase()) {
        case 'INFO': return '#0099ff';
        case 'SUCCESS': return '#00FF00';
        case 'WARNING': return '#FFFF00';
        case 'ERROR': return '#FF0000';
        case 'DEBUG': return '#FF00FF';
        default: return '#FFFFFF';
    }
};

// Log helper fonksiyonları
module.exports = {
    setClient: (client) => setDiscordClient(client),
    
    info: (message, details = {}) => log('INFO', message, details),
    success: (message, details = {}) => log('SUCCESS', message, details),
    warning: (message, details = {}) => log('WARNING', message, details),
    error: (message, details = {}) => log('ERROR', message, details),
    debug: (message, details = {}) => log('DEBUG', message, details),
    
    // Komut logları - Webhook'a gönderilir
    command: (commandName, user, guild, details = {}) => {
        // Dosya loglaması
        log('INFO', `/${commandName} komutu çalıştırıldı`, {
            ...details,
            user: `${user.tag} (${user.id})`,
            guild: guild ? `${guild.name} (${guild.id})` : 'DM'
        });
        
        // Webhook'a gönder
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Komut Kullanıldı')
            .setDescription(`/${commandName} komutu kullanıldı`)
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Sunucu', value: guild ? `${guild.name} (${guild.id})` : 'DM', inline: true }
            )
            .setTimestamp();
            
        if (Object.keys(details).length > 0) {
            Object.entries(details).forEach(([key, value]) => {
                embed.addFields({ 
                    name: key, 
                    value: String(value).substring(0, 1024), 
                    inline: true 
                });
            });
        }
        
        return sendWebhookEmbed(embed);
    },
    
    // Rütbe değişikliği - Log dosyasına kaydedilir + Discord kanalına gönderilir
    rankChange: (discordUser, targetRobloxUsername, targetRobloxId, oldRank, newRank, reason) => {
        // Dosya log
        log('INFO', `Rütbe değişikliği: ${targetRobloxUsername} (${targetRobloxId}) - ${oldRank} -> ${newRank}`, {
            executor: `${discordUser.tag} (${discordUser.id})`,
            target: `${targetRobloxUsername} (${targetRobloxId})`,
            oldRank,
            newRank,
            reason
        });
        
        // Discord kanalı log
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Rütbe Değişikliği')
            .setDescription(`${targetRobloxUsername} (${targetRobloxId}) adlı personelin rütbesi değiştirildi.`)
            .addFields(
                { name: 'Eski Rütbe', value: oldRank, inline: true },
                { name: 'Yeni Rütbe', value: newRank, inline: true },
                { name: 'Sebep', value: reason, inline: false },
                { name: 'İşlemi Yapan', value: `${discordUser.tag} (${discordUser.id})`, inline: false }
            )
            .setTimestamp();
            
        return sendChannelEmbed(embed);
    },
    
    // Terfi - Log dosyasına kaydedilir + Discord kanalına gönderilir
    rankPromotion: (discordUser, targetRobloxUsername, targetRobloxId, oldRank, newRank, reason) => {
        // Dosya log
        log('SUCCESS', `Terfi: ${targetRobloxUsername} (${targetRobloxId}) - ${oldRank} -> ${newRank}`, {
            executor: `${discordUser.tag} (${discordUser.id})`,
            target: `${targetRobloxUsername} (${targetRobloxId})`,
            oldRank,
            newRank,
            reason
        });
        
        // Discord kanalı log
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Terfi')
            .setDescription(`${targetRobloxUsername} (${targetRobloxId}) adlı personel terfi edildi.`)
            .addFields(
                { name: 'Eski Rütbe', value: oldRank, inline: true },
                { name: 'Yeni Rütbe', value: newRank, inline: true },
                { name: 'Sebep', value: reason, inline: false },
                { name: 'İşlemi Yapan', value: `${discordUser.tag} (${discordUser.id})`, inline: false }
            )
            
            
        return sendChannelEmbed(embed);
    },
    
    // Tenzil - Log dosyasına kaydedilir + Discord kanalına gönderilir
    rankDemotion: (discordUser, targetRobloxUsername, targetRobloxId, oldRank, newRank, reason) => {
        // Dosya log
        log('WARNING', `Tenzil: ${targetRobloxUsername} (${targetRobloxId}) - ${oldRank} -> ${newRank}`, {
            executor: `${discordUser.tag} (${discordUser.id})`,
            target: `${targetRobloxUsername} (${targetRobloxId})`,
            oldRank,
            newRank,
            reason
        });
        
        // Discord kanalı log
        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Tenzil')
            .setDescription(`${targetRobloxUsername} (${targetRobloxId}) adlı personel tenzil edildi.`)
            .addFields(
                { name: 'Eski Rütbe', value: oldRank, inline: true },
                { name: 'Yeni Rütbe', value: newRank, inline: true },
                { name: 'Sebep', value: reason, inline: false },
                { name: 'İşlemi Yapan', value: `${discordUser.tag} (${discordUser.id})`, inline: false }
            )
            
            
        return sendChannelEmbed(embed);
    }
};