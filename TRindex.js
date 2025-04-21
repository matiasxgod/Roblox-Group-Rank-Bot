const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const commands = [ //Slash Komutları
    new SlashCommandBuilder()
        .setName('rütbe')
        .setDescription('Belirlenen kişinin rütbesini değiştir.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('değiştir')
                .setDescription('Kişinin rütbesini değiştirir.')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Rütbesini değiştirmek istediğiniz kişi.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rütbe')
                        .setDescription('Kişiye vermek istediğiniz rütbe.')
                        .setRequired(true)
                        .setAutocomplete(true)) 
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Rütbe değişikliğinin nedeni')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('terfi')
                .setDescription('Kişiye terfi verir, rütbesini bir kademe arttırır.')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Terfi vermek istediğiniz kişi.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Terfi nedeni')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('tenzil')
                .setDescription('Kişiye terfi verir, rütbesini bir kademe düşürür.')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Tenzil vermek istediğiniz kişi.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Tenzil nedeni')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sorgu')
                .setDescription('Kişinin rütbesini sorgular')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Rütbesini öğrenmek istediğiniz kişi.')
                        .setRequired(true)))
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('Slash komutları kaydediliyor...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log('Komutlar başarıyla kaydedildi!');
    } catch (error) {
        console.error(error);
    }
})();

async function getCsrfToken() { // csrf token
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

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

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

const ALLOWED_ROLES = ["Rank Verme", "Yönetim Kurulu"];

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

async function changeRank(userId, rankInput, interaction, reason, isTenzil = false) { // rank değiştirme
    const userHasPermission = interaction.member.roles.cache.some(role =>
        ALLOWED_ROLES.includes(role.name)
    );

    if (!userHasPermission) {
        await interaction.deferReply();
        return interaction.editReply("Bu komutu kullanma yetkiniz yok. Sadece belirli roller bu komutu kullanabilir.");
    }

    if (interaction.replied || interaction.deferred) {
        return;
    }

    await interaction.deferReply();

    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
        return interaction.editReply("CSRF Token alınamadı.");
    }

    const newRole = await getRoleByInput(rankInput);
    if (!newRole) {
        return interaction.editReply("Geçerli bir rütbe bulunamadı.");
    }

    let username = "Bilinmiyor";
    let currentRoleRank = 0;
    let userIdFinal = userId;

    try {
        const userInfo = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        if (userInfo.data && userInfo.data.name) {
            username = userInfo.data.name;
        }
    } catch (error) {
        console.error(`Kullanıcı adı alınamadı: ${error.message}`);
    }

    try {
        const userResponse = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        if (userResponse.data && userResponse.data.data) {
            const userGroup = userResponse.data.data.find((g) => g.group.id === parseInt(ROBLOX_GROUP_ID));
            if (userGroup) {
                currentRoleRank = userGroup.role.rank;
            }
        }
    } catch (error) {
        console.error(`Kullanıcının mevcut rütbesi alınamadı: ${error.message}`);
    }

    try {
        const response = await axios.patch(
            `https://groups.roblox.com/v1/groups/${ROBLOX_GROUP_ID}/users/${userId}`,
            { roleId: newRole.id },
            {
                headers: {
                    "X-CSRF-TOKEN": csrfToken,
                    Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}`,
                    "Content-Type": "application/json",
                },
            },
        );

        const userFullInfo = await getUserFullInfo(userId);

        let statusMessage = '';
        let embedColor = '#00FF00';

        if (response.status === 200) {
            if (currentRoleRank < newRole.rank) {
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** adlı personel **${newRole.name}** rütbesine terfi edilmiştir!`;
            } else if (currentRoleRank > newRole.rank) {
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** adlı personel **${newRole.name}** rütbesine tenzil edilmiştir!`;
            } else {
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** adlı personel zaten **${newRole.name}** rütbesinde.`;
            }

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('Rütbe Değişikliği')
                .setDescription(statusMessage)
                .addFields(
                    { name: 'Sebep', value: reason },
                    { name: 'İşlemi Yapan:', value: `<@${interaction.user.id}>` }
                )
                .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            return true;
        } else {
            console.error(`Rank değiştirme başarısız. Status: ${response.status}`);
            return interaction.editReply("Rank değiştirme işlemi başarısız oldu.");
        }
    } catch (error) {
        console.error(`Hata Kodu: ${error.response?.status || "Bilinmiyor"}`);
        return interaction.editReply("Bir hata oluştu, işlem başarısız.");
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

async function autocompleteRoles(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const roleNames = await getRoleNames();
    const filteredRoles = roleNames.filter(role =>
        role.toLowerCase().includes(focusedOption.value.toLowerCase()) && role.length <= 25
    );
    const responseChoices = filteredRoles.slice(0, 25).map(role => ({
        name: role,
        value: role
    }));
    await interaction.respond(responseChoices);
}

client.on('interactionCreate', async (interaction) => { // Komutlar
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rütbe') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'değiştir') {
                await autocompleteRoles(interaction);
            }
        }
    }

    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'rütbe') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'değiştir') {
            const username = interaction.options.getString('kişi');
            const rankInput = interaction.options.getString('rütbe');
            const reason = interaction.options.getString('sebep');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`"${username}" adlı kullanıcı bulunamadı.`);
                }
            }

            const success = await changeRank(userId, rankInput, interaction, reason);
            if (!success) {
                return interaction.reply('Rütbe değiştirme işlemi başarısız oldu.');
            }
        }

        if (subcommand === 'terfi') {
            const username = interaction.options.getString('kişi');
            const reason = interaction.options.getString('sebep');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`"${username}" adlı kullanıcı bulunamadı.`);
                }
            }

            const currentRole = await getUserRole(userId);
            if (!currentRole) {
                return interaction.reply(`"${username}" adlı kullanıcı için rol bilgisi alınamadı.`);
            }

            const nextRank = currentRole.rank + 1;
            const success = await changeRank(userId, nextRank, interaction, reason);
            if (!success) {
                return interaction.reply('Rütbe terfi işlemi başarısız oldu.');
            }
        }

        if (subcommand === 'tenzil') {
            const username = interaction.options.getString('kişi');
            const reason = interaction.options.getString('sebep');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`"${username}" adlı kullanıcı bulunamadı.`);
                }
            }

            const currentRole = await getUserRole(userId);
            if (!currentRole) {
                return interaction.reply(`"${username}" adlı kullanıcı için rol bilgisi alınamadı.`);
            }

            const nextRank = currentRole.rank - 1;
            const success = await changeRank(userId, nextRank, interaction, reason, true);
            if (!success) {
                return interaction.reply('Rütbe tenzil işlemi başarısız oldu.');
            }
        }

        if (subcommand === 'sorgu') {
            const username = interaction.options.getString('kişi');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`"${username}" adlı kullanıcı bulunamadı.`);
                }
            }

            const currentRole = await getUserRole(userId);
            if (!currentRole) {
                return interaction.reply(`"${username}" adlı kullanıcı için rol bilgisi alınamadı.`);
            }

            const userFullInfo = await getUserFullInfo(userId); 

            const embed = new EmbedBuilder()
                .setColor('#00FF00') 
                .setTitle('Rütbe Sorgu')
                .setDescription(`**${userFullInfo.name} (${userFullInfo.id})** adlı personelin rütbesi: **${currentRole.name}**`)
                .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
});

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

client.login(DISCORD_TOKEN);
