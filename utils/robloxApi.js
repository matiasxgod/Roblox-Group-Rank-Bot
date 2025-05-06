const axios = require('axios');
require('dotenv').config();

const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getCsrfToken() {
    try {
        const authResponse = await axios.get(
            "https://users.roblox.com/v1/users/authenticated",
            {
                headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
            },
        );

        if (!authResponse.data.id) {
            console.error("ROBLOX_COOKIE geçersiz! Lütfen yeni bir çerez alın.");
            return null;
        }

        console.log("ROBLOX_COOKIE doğrulandı, CSRF Token alınıyor...");

        try {
            await axios.post(
                "https://auth.roblox.com/v2/logout",
                {},
                {
                    headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
                },
            );
        } catch (error) {
            if (error.response && error.response.headers["x-csrf-token"]) {
                return error.response.headers["x-csrf-token"];
            }
        }

        console.error("CSRF Token alınamadı.");
        return null;
    } catch (error) {
        console.error(`CSRF Token alma işlemi başarısız: ${error.message}`);
        return null;
    }
}

async function getUserIdFromUsername(username) {
    try {
        const response = await axios.post(
            "https://users.roblox.com/v1/usernames/users",
            {
                usernames: [username],
                excludeBannedUsers: true,
            },
        );
        return response.data.data.length > 0 ? response.data.data[0].id : null;
    } catch (error) {
        if (error.response && error.response.status === 429) {
            console.log("Rate limit hatası, 1 saniye bekleniyor...");
            await delay(1000);
            return getUserIdFromUsername(username);
        } else {
            console.error(`Kullanıcı ID alınamadı: ${error.message}`);
            return null;
        }
    }
}

async function getRoleByInput(input) {
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/groups/${ROBLOX_GROUP_ID}/roles`);
        const roles = response.data.roles;

        if (!isNaN(input)) {
            return roles.find((r) => r.rank === parseInt(input)) || null;
        }

        return roles.find(
            (r) => r.name.toLowerCase() === input.toLowerCase(),
        ) || null;
    } catch (error) {
        console.error(`Rank bilgisi alınamadı: ${error.message}`);
        return null;
    }
}

async function getUserRole(userId) {
    try {
        const response = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        const userGroup = response.data.data.find((group) => group.group.id === parseInt(ROBLOX_GROUP_ID));
        return userGroup ? userGroup.role : null;
    } catch (error) {
        console.error(`Kullanıcının rolü alınamadı: ${error.message}`);
        return null;
    }
}

async function getUserFullInfo(userId) {
    try {
        const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        return {
            name: response.data.name,
            id: response.data.id
        };
    } catch (error) {
        console.error(`Kullanıcı bilgisi alınamadı: ${error.message}`);
        return { name: "Bilinmiyor", id: "Bilinmiyor" };
    }
}

async function getRoleNames() {
    try {
        const response = await axios.get(`https://groups.roblox.com/v1/groups/${ROBLOX_GROUP_ID}/roles`);
        return response.data.roles.map(role => role.name);
    } catch (error) {
        console.error(`Roller alınamadı: ${error.message}`);
        if (error.response && error.response.status === 503) {
            console.log('Roblox API geçici olarak kullanılamaz. 5 saniye bekleniyor...');
            await delay(5000);
            return getRoleNames();
        }
        return [];
    }
}

// Gruba katılma isteği gönderme
async function sendJoinRequest(userId, groupId) {
    try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) {
            return { success: false, message: "CSRF Token alınamadı." };
        }

        // Kullanıcı adına gruba katılma isteği gönderiyor
        await axios.post(
            `https://groups.roblox.com/v1/groups/${groupId}/join-requests`,
            {},
            {
                headers: {
                    "X-CSRF-TOKEN": csrfToken,
                    Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
                    "Content-Type": "application/json",
                    "Referer": `https://www.roblox.com/groups/${groupId}/group`,
                },
            }
        );

        return { success: true, message: "Gruba katılım isteği başarıyla gönderildi." };
    } catch (error) {
        console.error(`Katılma isteği gönderilirken hata oluştu: ${error.message}`);
        let errorMessage = "Bir hata oluştu.";
        if (error.response) {
            if (error.response.status === 400 && error.response.data.errors[0]?.message.includes("already requested")) {
                errorMessage = "Kullanıcı zaten bu gruba katılma isteği göndermiş.";
            }
            if (error.response.status === 400 && error.response.data.errors[0]?.message.includes("already in the group")) {
                errorMessage = "Kullanıcı zaten bu gruba üye.";
            }
        }
        return { success: false, message: errorMessage };
    }
}

// Kullanıcıyı gruba ekleme
async function addUserToGroup(userId, groupId) {
    try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) {
            console.error("CSRF Token alınamadı.");
            return { success: false, message: "CSRF Token alınamadı." };
        }

        const rolesResponse = await axios.get(
            `https://groups.roblox.com/v1/groups/${groupId}/roles`,
            {
                headers: {
                    Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
                },
            }
        );

        const roles = rolesResponse.data.roles;
        roles.sort((a, b) => a.rank - b.rank);

        const lowestRole = roles.find(role => role.rank > 0); // 0 rank Guest olabilir, 1+ olanı alalım
        if (!lowestRole) {
            console.error("Grup için rol bulunamadı.");
            return { success: false, message: "Grup için rol bulunamadı." };
        }

        // Kullanıcıyı gruba ekleme
        await axios.post(
            `https://groups.roblox.com/v1/groups/${groupId}/users`,
            { userId: parseInt(userId) },
            {
                headers: {
                    "X-CSRF-TOKEN": csrfToken,
                    Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
                    "Content-Type": "application/json",
                    "Referer": `https://www.roblox.com/groups/${groupId}/group`,
                },
            }
        );

        // Rütbe verme işlemi
        await axios.patch(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
            { roleId: lowestRole.id },
            {
                headers: {
                    "X-CSRF-TOKEN": csrfToken,
                    Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
                    "Content-Type": "application/json",
                },
            }
        );

        return { success: true, message: `Kullanıcı başarıyla gruba eklendi ve **${lowestRole.name}** rütbesi verildi.` };
    } catch (error) {
        console.error(`Hata: ${error.message}`);
        return { success: false, message: "Kullanıcı eklenemedi." };
    }
}

async function getJoinRequests(groupId, limit = 10, cursor = "") {
    try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) {
            return { success: false, message: "CSRF Token alınamadı.", requests: [] };
        }

        let url = `https://groups.roblox.com/v1/groups/${groupId}/join-requests?limit=${limit}`;
        if (cursor) {
            url += `&cursor=${cursor}`;
        }

        const response = await axios.get(url, {
            headers: {
                "X-CSRF-TOKEN": csrfToken,
                Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
            },
        });

        return {
            success: true,
            requests: response.data.data,
            nextCursor: response.data.nextPageCursor,
        };
    } catch (error) {
        console.error(`Katılma istekleri alınamadı: ${error.message}`);
        return { success: false, message: "Katılma istekleri alınamadı.", requests: [] };
    }
}
// Gruba katılma isteğini kabul etme
async function acceptJoinRequest(userId, groupId) {
    try {
        const csrfToken = await getCsrfToken();
        if (!csrfToken) {
            return { success: false, message: "CSRF Token alınamadı." };
        }

        console.log(`CSRF Token: ${csrfToken}`);
        console.log(`Kullanıcı ID: ${userId} için grup katılma isteği kabul edilmeye çalışılıyor...`);
        
        // ÖNEMLİ: Endpoint URL'i değişti - "users" yerine "user" kullanılmalı
        const response = await axios({
            method: 'post',
            url: `https://groups.roblox.com/v1/groups/${groupId}/join-requests/users/${userId}`,
            headers: {
                'Content-Type': 'application/json',
                'Cookie': `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
                'X-CSRF-TOKEN': csrfToken,
                'Referer': 'https://www.roblox.com/'
            },
            // API istek gövdesi olarak boş obje gönderiyoruz
            data: {}
        });

        console.log(`İstek yanıtı: ${response.status}`);
        return { success: true, message: "Kullanıcının gruba katılma isteği başarıyla kabul edildi." };
    } catch (error) {
        console.error(`İstek kabul edilirken hata: ${error.message}`);
        
        if (error.response) {
            console.error(`Hata detayları: ${JSON.stringify(error.response.data || {})}`);
            
            // Belirli hata kodları için özel mesajlar
            if (error.response.status === 403) {
                return { 
                    success: false, 
                    message: "Yetki hatası: Hesabınız bu işlemi yapmaya yetkili değil veya API çağrısı reddedildi."
                };
            } else if (error.response.status === 400) {
                // API'den gelen hata mesajını kontrol et
                if (error.response.data && error.response.data.errors) {
                    const errorMsg = error.response.data.errors[0]?.message;
                    if (errorMsg) {
                        if (errorMsg.includes("not found")) {
                            return { 
                                success: false, 
                                message: "Kullanıcının bu gruba katılma isteği bulunamadı. Önce Roblox üzerinden katılma isteği göndermelidir." 
                            };
                        }
                        return { success: false, message: errorMsg };
                    }
                }
            }
        }
        
        return { success: false, message: "İstek işlenirken bir hata oluştu. Lütfen daha sonra tekrar deneyin." };
    }
}

module.exports = {
    getCsrfToken,
    getUserIdFromUsername,
    getRoleByInput,
    getUserRole,
    getUserFullInfo,
    getRoleNames,
    sendJoinRequest,
    addUserToGroup,
    getJoinRequests,
    acceptJoinRequest
};
