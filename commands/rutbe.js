const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCsrfToken, getUserIdFromUsername, getRoleByInput, getUserRole, getUserFullInfo, getRoleNames } = require('../utils/robloxApi');
const { checkPermission } = require('../utils/permissionCheck');
require('dotenv').config();
const axios = require('axios');

const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;
const ROBLOX_COOKIE = process.env.ROBLOX_COOKIE;

async function changeRank(userId, rankInput, interaction, reason, isTenzil = false) {
    if (!checkPermission(interaction.member)) {
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
        const userInfo = await getUserFullInfo(userId);
        username = userInfo.name;
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
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** adlı personele **${newRole.name}** rütbesi başarıyla verildi!`;
            } else if (currentRoleRank > newRole.rank) {
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** adlı personele **${newRole.name}** rütbesi başarıyla verildi!`;
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

module.exports = {
    data: new SlashCommandBuilder()
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
                        .setRequired(true))),
    
    autocomplete: async function(interaction) {
        if (interaction.commandName === 'rütbe') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'değiştir') {
                await autocompleteRoles(interaction);
            }
        }
    },
    
    execute: async function(interaction) {
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
};