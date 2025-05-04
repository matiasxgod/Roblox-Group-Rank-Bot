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

        const role = roles.find(
            (r) => r.name.toLowerCase() === input.toLowerCase(),
        );
        return role || null;
    } catch (error) {
        console.error(`Rank bilgisi alınamadı: ${error.message}`);
        return null;
    }
}

async function getUserRole(userId) {
    try {
        const response = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        const userGroup = response.data.data.find((group) => group.group.id === parseInt(ROBLOX_GROUP_ID));
        if (userGroup) {
            return userGroup.role;
        }
        return null;
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

module.exports = {
    getCsrfToken,
    getUserIdFromUsername,
    getRoleByInput,
    getUserRole,
    getUserFullInfo,
    getRoleNames,
    delay
};