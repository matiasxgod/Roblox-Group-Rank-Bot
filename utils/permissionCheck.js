const { getUserRole, getUserFullInfo } = require('./robloxApi');
const { getRobloxIdFromDiscordId } = require('./robloxDatabase');
const axios = require('axios');
require('dotenv').config();

const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;

// Grup rollerini alma fonksiyonu
async function getGroupRoles() {
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/groups/${ROBLOX_GROUP_ID}/roles`);
        return response.data.roles;
    } catch (error) {
        console.error(`Grup rolleri alınamadı: ${error.message}`);
        return [];
    }
}

// Rütbe ID'sine göre rütbe adı getiren fonksiyon
async function getRoleNameByRank(rank) {
    try {
        const roles = await getGroupRoles();
        const role = roles.find(r => r.rank === rank);
        return role ? role.name : "Bilinmeyen Rütbe";
    } catch (error) {
        console.error(`Rütbe adı alınamadı: ${error.message}`);
        return "Bilinmeyen Rütbe";
    }
}

// Kullanıcı rütbe kontrolü (gereken minimum rütbe)
async function checkPermission(discordId, requiredRoleRank = 32) {
    try {
        console.log(`Rütbe kontrolü: Discord ID ${discordId}, Gereken rütbe: ${requiredRoleRank}`);
        
        // Discord ID'den Roblox ID'yi al
        const robloxId = await getRobloxIdFromDiscordId(discordId);
        
        if (!robloxId) {
            const message = "Hesap bağlantınız bulunamadı. Eğer yukarıda yazan isim, Roblox IDsi veya rütbe size ait değilse RoWifi bağlantınızı kontrol edin ve /yenile komutunu kullanın.";
            
            return {
                success: false,
                message: message
            };
        }
        
        console.log(`Roblox ID: ${robloxId}`);
        
        // Kullanıcının roblox bilgilerini al
        const userInfo = await getUserFullInfo(robloxId);
        const username = userInfo ? userInfo.name : robloxId;
        
        // Kullanıcının gruptaki rütbesini al
        const userRole = await getUserRole(robloxId);
        console.log(`Kullanıcı rolü: ${JSON.stringify(userRole)}`);
        
        if (!userRole) {
            const message = `Sizin (${username}) (${robloxId}) hesabınızın grup üyeliği bulunamadı veya rütbe bilgisi alınamadı. Lütfen gruba üye olduğunuzdan emin olun.`;
            
            return {
                success: false,
                message: message
            };
        }
        
        // Gerekli rütbe adını çek
        const requiredRoleName = await getRoleNameByRank(requiredRoleRank);
        
        // Kullanıcının rütbesi yeterli mi kontrol et
        if (userRole.rank >= requiredRoleRank) {
            return {
                success: true,
                role: userRole
            };
        } else {
            const message = `**${username}** **(${robloxId})** rütbeniz bu komutu çalıştırmak için yeterli değil.\n\nGüncel Rütbeniz: **${userRole.name}**\nGereken en düşük rütbe: **${requiredRoleName}**\n\nEğer yukarıda yazan isim, Roblox ID veya rütbe size ait değilse RoWifi bağlantınızı kontrol edin ve /yenile komutunu kullanın.`;
            
            return {
                success: false,
                message: message
            };
        }
    } catch (error) {
        console.error(`Rütbe kontrol hatası: ${error.message}`);
        
        const message = `Rütbe kontrolü yapılırken bir hata oluştu: ${error.message}`;
        
        return {
            success: false,
            message: message
        };
    }
}

// Kullanıcının, hedef kullanıcıya işlem yapabilme kontrolü
async function checkRankOperation(executorDiscordId, targetRobloxId) {
    try {
        // İşlemi yapan kullanıcının Roblox ID'sini ve rolünü al
        const executorRobloxId = await getRobloxIdFromDiscordId(executorDiscordId);
        if (!executorRobloxId) {
            const message = "Hesap bağlantınız bulunamadı. Lütfen /yenile komutunu kullanın.";
            
            return {
                success: false,
                message: message
            };
        }
        
        const executorRole = await getUserRole(executorRobloxId);
        if (!executorRole) {
            const message = `Sizin grup üyeliğiniz bulunamadı veya rütbe bilginiz alınamadı.`;
            
            return {
                success: false,
                message: message
            };
        }
        
        // Hedef kullanıcının rolünü al
        const targetRole = await getUserRole(targetRobloxId);
        if (!targetRole) {
            const message = `Hedef kullanıcının grup üyeliği bulunamadı veya rütbe bilgisi alınamadı.`;
            
            return {
                success: false,
                message: message
            };
        }
        
        // Kullanıcı bilgilerini al
        const executorInfo = await getUserFullInfo(executorRobloxId);
        const targetInfo = await getUserFullInfo(targetRobloxId);
        
        const executorUsername = executorInfo ? executorInfo.name : executorRobloxId;
        const targetUsername = targetInfo ? targetInfo.name : targetRobloxId;
        
        // Kullanıcı sadece kendi rütbesinin altında işlem yapabilir
        if (executorRole.rank <= targetRole.rank) {
            const message = `**${executorUsername}** **(${executorRobloxId})** Kendinizden daha yüksek veya eşit rütbedeki kullanıcılara işlem yapamazsınız.\n\nGüncel Rütbeniz: **${executorRole.name}**\nHedef Kullanıcının Rütbesi: **${targetRole.name}**`;
            
            return {
                success: false,
                message: message
            };
        }
        
        // Başarılı kontrol
        return {
            success: true,
            executorRole: executorRole,
            targetRole: targetRole
        };
    } catch (error) {
        console.error(`Rütbe işlem kontrolü hatası: ${error.message}`);
        
        const message = `Rütbe işlem kontrolü yapılırken bir hata oluştu: ${error.message}`;
        
        return {
            success: false,
            message: message
        };
    }
}

module.exports = {
    checkPermission,
    checkRankOperation,
    getGroupRoles,
    getRoleNameByRank
};