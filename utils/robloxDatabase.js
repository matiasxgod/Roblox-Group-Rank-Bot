const fs = require('fs');
const path = require('path');

// Veritabanı dosyasının yolu
const dbFilePath = path.join(__dirname, '..', 'database', 'users.json');

// Veritabanından kullanıcıları yükle
function loadUsers() {
    try {
        if (fs.existsSync(dbFilePath)) {
            const data = fs.readFileSync(dbFilePath, 'utf8');
            // Boş veya geçersiz JSON kontrolü
            if (!data || data.trim() === '') {
                console.log('Veritabanı dosyası boş, yeni bir dizi oluşturuluyor.');
                return [];
            }
            
            try {
                return JSON.parse(data);
            } catch (parseError) {
                console.error(`JSON ayrıştırma hatası: ${parseError.message}`);
                console.log('Geçersiz JSON dosyası, yeni bir dizi oluşturuluyor.');
                // Dosyayı yedekle
                const backupPath = `${dbFilePath}.backup-${Date.now()}`;
                fs.copyFileSync(dbFilePath, backupPath);
                console.log(`Bozuk veritabanı dosyası yedeklendi: ${backupPath}`);
                return [];
            }
        }
        console.log('Veritabanı dosyası bulunamadı, yeni bir dizi oluşturuluyor.');
        return [];
    } catch (error) {
        console.error(`Veritabanı okuma hatası: ${error.message}`);
        return [];
    }
}

// Veritabanına kullanıcıları kaydet
function saveUsers(users) {
    try {
        // Veritabanı klasörünün var olduğundan emin ol
        const dbDir = path.dirname(dbFilePath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        fs.writeFileSync(dbFilePath, JSON.stringify(users, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`Veritabanı yazma hatası: ${error.message}`);
        return false;
    }
}

// Discord ID'den Roblox ID'sini bul
async function getRobloxIdFromDiscordId(discordId) {
    const users = loadUsers();
    const user = users.find(u => u.discordId === discordId);
    return user ? user.robloxId : null;
}

// Roblox ID'den Discord ID'sini bul
async function getDiscordIdFromRobloxId(robloxId) {
    const users = loadUsers();
    const user = users.find(u => u.robloxId === robloxId || u.robloxId === parseInt(robloxId));
    return user ? user.discordId : null;
}

// Roblox kullanıcı adından Discord ID'sini bul
async function getDiscordIdFromRobloxUsername(robloxUsername) {
    const users = loadUsers();
    const user = users.find(u => 
        u.robloxUsername && 
        u.robloxUsername.toLowerCase() === robloxUsername.toLowerCase()
    );
    return user ? user.discordId : null;
}

// Tüm kullanıcı listesini al
async function getAllUsers() {
    return loadUsers();
}

// Discord ve Roblox hesaplarını bağla
async function linkUser(discordId, robloxId, robloxUsername) {
    const users = loadUsers();
    
    // Kullanıcıyı veritabanında ara
    const existingIndex = users.findIndex(u => u.discordId === discordId);
    
    // Bu Roblox ID'si başka bir Discord hesabına bağlı mı kontrol et
    const linkedToOther = users.find(u => 
        u.discordId !== discordId && 
        (u.robloxId === robloxId || u.robloxId === parseInt(robloxId))
    );
    
    // Eğer bu Roblox hesabı başka bir Discord hesabına bağlıysa, son bağlanan kişiyi kabul et
    if (linkedToOther) {
        console.log(`Roblox ID ${robloxId} daha önce Discord ID ${linkedToOther.discordId} ile eşleştirilmiş. Yeni eşleştirme: ${discordId}`);
        // Eski bağlantıyı kaldır
        const oldIndex = users.findIndex(u => u.discordId === linkedToOther.discordId);
        if (oldIndex !== -1) {
            users.splice(oldIndex, 1);
        }
    }
    
    // Güncel tarih bilgisini ekle
    const now = new Date();
    
    if (existingIndex !== -1) {
        // Kullanıcı zaten var, bilgilerini güncelle
        users[existingIndex].robloxId = parseInt(robloxId); // Sayı olarak sakla
        users[existingIndex].robloxUsername = robloxUsername;
        users[existingIndex].updatedAt = now.toISOString(); // Son güncelleme zamanı
    } else {
        // Yeni kullanıcı ekle
        users.push({
            discordId,
            robloxId: parseInt(robloxId), // Sayı olarak sakla
            robloxUsername,
            createdAt: now.toISOString(), // Oluşturulma zamanı
            updatedAt: now.toISOString() // Son güncelleme zamanı
        });
    }
    
    return saveUsers(users);
}

// Discord ve Roblox hesap bağlantısını kaldır
async function unlinkUser(discordId) {
    const users = loadUsers();
    
    // Kullanıcıyı veritabanında ara
    const existingIndex = users.findIndex(u => u.discordId === discordId);
    
    if (existingIndex !== -1) {
        // Kullanıcıyı kaldır
        users.splice(existingIndex, 1);
        return saveUsers(users);
    }
    
    return true; // Zaten bağlantı yoksa başarılı kabul et
}

// Verilen bir kullanıcının bağlantı durumunu kontrol et
async function checkUserLinkStatus(discordId) {
    const users = loadUsers();
    const user = users.find(u => u.discordId === discordId);
    
    if (!user) {
        return {
            linked: false,
            message: "Bu Discord hesabı herhangi bir Roblox hesabına bağlı değil."
        };
    }
    
    return {
        linked: true,
        robloxId: user.robloxId,
        robloxUsername: user.robloxUsername,
        createdAt: user.createdAt || null,
        updatedAt: user.updatedAt || null,
        message: `Bu Discord hesabı ${user.robloxUsername} (${user.robloxId}) Roblox hesabına bağlı.`
    };
}

module.exports = {
    getRobloxIdFromDiscordId,
    getDiscordIdFromRobloxId,
    getDiscordIdFromRobloxUsername,
    getAllUsers,
    linkUser,
    unlinkUser,
    checkUserLinkStatus
};