const axios = require('axios');
const { linkUser } = require('./robloxDatabase');
require('dotenv').config();

// RoWifi API bilgileri
const ROWIFI_API_TOKEN = process.env.ROWIFI_API_TOKEN;
const ROWIFI_API_URL = process.env.ROWIFI_API_URL || 'https://api.rowifi.xyz';

// RoWifi API'si ile bağlı Roblox hesabını al
async function getLinkedRobloxAccount(discordId, guildId) {
    try {
        // RoWifi API'sine istek gönder
        const response = await axios.get(`${ROWIFI_API_URL}/guilds/${guildId}/users/${discordId}`, {
            headers: {
                'Authorization': `Bot ${ROWIFI_API_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        // Başarılı yanıt kontrolü
        if (response.status === 200 && response.data) {
            return {
                success: true,
                robloxId: response.data.roblox_id,
                robloxUsername: response.data.roblox_username
            };
        } else {
            console.log(`RoWifi API yanıtı başarısız: ${response.status}`);
            return {
                success: false,
                message: 'RoWifi üzerinde bağlı hesap bulunamadı.'
            };
        }
    } catch (error) {
        console.error(`RoWifi API hatası: ${error.message}`);
        return {
            success: false,
            message: `RoWifi API hatası: ${error.response?.data?.message || error.message}`
        };
    }
}

// Discord ID'den RoWifi üzerinden Roblox ID'sini al ve kendi veritabanımıza kaydet
async function syncRoWifiAccount(discordId, guildId) {
    try {
        // RoWifi'den bağlı hesabı al
        const rowifiAccount = await getLinkedRobloxAccount(discordId, guildId);
        
        if (!rowifiAccount.success) {
            return rowifiAccount; // Hata mesajını ilet
        }
        
        // Kendi veritabanımıza kaydet
        const success = await linkUser(
            discordId, 
            rowifiAccount.robloxId, 
            rowifiAccount.robloxUsername
        );
        
        if (success) {
            return {
                success: true,
                robloxId: rowifiAccount.robloxId,
                robloxUsername: rowifiAccount.robloxUsername
            };
        } else {
            return {
                success: false,
                message: 'Hesap veritabanına kaydedilirken bir hata oluştu.'
            };
        }
    } catch (error) {
        console.error(`RoWifi hesap senkronizasyon hatası: ${error.message}`);
        return {
            success: false,
            message: `Hesap senkronizasyon hatası: ${error.message}`
        };
    }
}

module.exports = {
    getLinkedRobloxAccount,
    syncRoWifiAccount
};