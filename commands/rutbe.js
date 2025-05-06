const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const { checkPermission, checkRankOperation } = require('../utils/permissionCheck');
const { getRobloxIdFromDiscordId } = require('../utils/robloxDatabase');
const logger = require('../utils/logger'); // Logger'ı ekleyelim
require('dotenv').config();

const ROBLOX_GROUP_ID = process.env.ROBLOX_GROUP_ID;

// Roblox oturumunu başlatma
async function initRoblox() {
    try {
        const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log(`Roblox hesabı ile giriş yapıldı: ${currentUser.UserName} [${currentUser.UserID}]`);
        return true;
    } catch (error) {
        console.error('Roblox girişi yapılamadı:', error.message);
        return false;
    }
}

async function changeRank(userId, rankInput, interaction, reason, isTenzil = false) {
    // Discord ID'den Roblox ID'yi al ve rütbe kontrolü yap
    const discordId = interaction.user.id;
    
    // 1. Önce kullanıcının YK+ olup olmadığını kontrol et
    const permCheck = await checkPermission(discordId, 32); // 32, Yönetim Kurulu rütbesi rank değeri
    
    if (!permCheck.success) {
        return interaction.editReply(permCheck.message);
    }
    
    // 2. Şimdi hedef kullanıcıya işlem yapma yetkisi var mı kontrol et
    const rankOpCheck = await checkRankOperation(discordId, userId);
    
    if (!rankOpCheck.success) {
        return interaction.editReply(rankOpCheck.message);
    }

    let newRole;
    if (isNaN(rankInput)) {
        // İsim olarak verilmişse
        try {
            const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
            newRole = roles.find(role => role.name.toLowerCase() === rankInput.toLowerCase());
            
            if (!newRole) {
                return interaction.editReply("Geçerli bir rütbe bulunamadı.");
            }
        } catch (error) {
            logger.error(`Rütbeler alınamadı`, { error: error.message });
            return interaction.editReply("Grup rütbeleri alınamadı.");
        }
    } else {
        // Rank değeri olarak verilmişse
        try {
            const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
            newRole = roles.find(role => role.rank === parseInt(rankInput));
            
            if (!newRole) {
                return interaction.editReply(`${rankInput} rank değerine sahip bir rütbe bulunamadı.`);
            }
        } catch (error) {
            logger.error(`Rütbeler alınamadı`, { error: error.message });
            return interaction.editReply("Grup rütbeleri alınamadı.");
        }
    }

    let username;
    let currentRoleRank = 0;
    let currentRoleName = "Bilinmiyor";

    try {
        username = await noblox.getUsernameFromId(userId);
        
        // Kullanıcının mevcut rütbesini al
        currentRoleRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userId);
        
        if (currentRoleRank === 0) {
            logger.warning(`Kullanıcı gruba üye değil`, { 
                username, 
                userId,
                executor: `${interaction.user.tag} (${interaction.user.id})`
            });
            return interaction.editReply(`**${username}** (${userId}) adlı personel gruba üye değil.`);
        }
        
        currentRoleName = await noblox.getRankNameInGroup(ROBLOX_GROUP_ID, userId);
    } catch (error) {
        logger.error(`Kullanıcı bilgileri alınamadı`, { error: error.message });
        return interaction.editReply("Kullanıcı bilgileri alınamadı.");
    }

    try {
        // Rütbeyi değiştir
        await noblox.setRank(ROBLOX_GROUP_ID, userId, newRole.rank);

        let statusMessage = '';
        let embedColor = '#00FF00';

        if (currentRoleRank < newRole.rank) {
            statusMessage = `**${username} (${userId})** adlı personele **${newRole.name}** rütbesi başarıyla verildi!`;
            // Log terfi kaydı
            logger.rankPromotion(
                interaction.user, 
                username,
                userId,
                currentRoleName,
                newRole.name,
                reason
            );
        } else if (currentRoleRank > newRole.rank) {
            statusMessage = `**${username} (${userId})** adlı personele **${newRole.name}** rütbesi başarıyla verildi!`;
            // Log tenzil kaydı
            logger.rankDemotion(
                interaction.user, 
                username,
                userId,
                currentRoleName,
                newRole.name,
                reason
            );
        } else {
            statusMessage = `**${username} (${userId})** adlı personel zaten **${newRole.name}** rütbesinde.`;
            // Aynı rütbe üzerinde değişiklik yok, standart log
            logger.info(`Rütbe değişikliği yok`, {
                username: username,
                userId: userId,
                rütbe: newRole.name,
                executor: `${interaction.user.tag} (${interaction.user.id})`
            });
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
    } catch (error) {
        logger.error(`Rütbe değiştirme hatası`, { 
            error: error.message,
            username,
            userId,
            targetRank: newRole.name,
            executor: `${interaction.user.tag} (${interaction.user.id})`
        });
        return interaction.editReply(`Rütbe değiştirme işlemi sırasında bir hata oluştu: ${error.message}`);
    }
}

async function autocompleteRoles(interaction) {
    try {
        const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
        const focusedOption = interaction.options.getFocused(true);
        
        const filteredRoles = roles
            .filter(role => role.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
            .map(role => ({
                name: role.name,
                value: role.name
            }));
        
        await interaction.respond(filteredRoles.slice(0, 25));
    } catch (error) {
        logger.error(`Otomatik tamamlama hatası`, { error: error.message });
        await interaction.respond([
            { name: "Roller yüklenemedi", value: "hata" }
        ]);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rütbe')
        .setDescription('Roblox grup rütbe işlemleri')
        .addSubcommand(subcommand =>
            subcommand
                .setName('değiştir')
                .setDescription('Kişinin rütbesini değiştirir')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Rütbesini değiştirmek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rütbe')
                        .setDescription('Vermek istediğiniz rütbe')
                        .setRequired(true)
                        .setAutocomplete(true))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Rütbe değişikliğinin nedeni')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('terfi')
                .setDescription('Kişiye terfi verir, rütbesini bir kademe arttırır')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Terfi vermek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Terfi nedeni')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('tenzil')
                .setDescription('Kişiye tenzil verir, rütbesini bir kademe düşürür')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Tenzil vermek istediğiniz kişi (Discord etiketi veya Roblox adı)')
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
                        .setDescription('Rütbesini öğrenmek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))),
    
    autocomplete: async function(interaction) {
        if (interaction.commandName === 'rütbe') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'değiştir') {
                const focusedOption = interaction.options.getFocused(true);
                if (focusedOption.name === 'rütbe') {
                    await autocompleteRoles(interaction);
                }
            }
        }
    },
    
    execute: async function(interaction) {
        await interaction.deferReply();
        
        // Komut kullanımını logla
        logger.command('rütbe', interaction.user, interaction.guild, {
            subcommand: interaction.options.getSubcommand()
        });
        
        // Roblox oturumunu başlat
        const robloxInitialized = await initRoblox();
        if (!robloxInitialized) {
            logger.error(`Roblox oturumu başlatılamadı`);
            return interaction.editReply('Roblox oturumu başlatılamadı. Lütfen daha sonra tekrar deneyin.');
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        // Kullanıcı bilgilerini işleme fonksiyonu
        async function processUserInfo(userInput) {
            // Discord etiketini kontrol et
            if (userInput.startsWith('<@') && userInput.endsWith('>')) {
                const userId = userInput.replace(/[<@!>]/g, '');
                
                try {
                    // Discord ID'den Roblox ID'yi al
                    const robloxId = await getRobloxIdFromDiscordId(userId);
                    
                    if (robloxId) {
                        logger.debug(`Discord ID'den Roblox ID bulundu`, { 
                            discordId: userId, 
                            robloxId 
                        });
                        return { success: true, userId: robloxId };
                    }
                    
                    // Discord üyesini kontrol et
                    try {
                        const member = await interaction.guild.members.fetch(userId);
                        if (member) {
                            const displayName = member.nickname || member.user.username;
                            if (displayName) {
                                try {
                                    const robloxId = await noblox.getIdFromUsername(displayName);
                                    if (robloxId) {
                                        logger.debug(`Discord ismi üzerinden Roblox ID bulundu`, { 
                                            discordId: userId, 
                                            displayName,
                                            robloxId 
                                        });
                                        return { success: true, userId: robloxId };
                                    }
                                } catch (error) {
                                    logger.debug(`Discord ismi üzerinden Roblox ID bulunamadı`, { 
                                        discordId: userId, 
                                        displayName,
                                        error: error.message 
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        logger.debug(`Discord üye bilgisi alınamadı`, { 
                            discordId: userId, 
                            error: error.message 
                        });
                    }
                    
                    logger.warning(`Discord kullanıcısına bağlı Roblox hesabı bulunamadı`, {
                        discordId: userId
                    });
                    
                    return { 
                        success: false, 
                        message: `${userInput} adlı Discord kullanıcısına bağlı bir Roblox hesabı bulunamadı.` 
                    };
                } catch (error) {
                    logger.error(`Roblox ID alınamadı`, { 
                        discordId: userId, 
                        error: error.message 
                    });
                    return { 
                        success: false, 
                        message: `${userInput} adlı Discord kullanıcısına bağlı bir Roblox hesabı bulunamadı.` 
                    };
                }
            }
            
            // Roblox kullanıcı adı veya ID olarak işlem yap
            let userId = userInput;
            if (isNaN(userId)) {
                try {
                    userId = await noblox.getIdFromUsername(userInput);
                    if (!userId) {
                        logger.warning(`Roblox kullanıcısı bulunamadı`, { username: userInput });
                        return { 
                            success: false, 
                            message: `"${userInput}" adlı Roblox kullanıcısı bulunamadı.` 
                        };
                    }
                    
                    logger.debug(`Roblox kullanıcı adından ID bulundu`, { 
                        username: userInput, 
                        userId 
                    });
                } catch (error) {
                    logger.warning(`Roblox kullanıcısı bulunamadı`, { 
                        username: userInput,
                        error: error.message
                    });
                    return { 
                        success: false, 
                        message: `"${userInput}" adlı Roblox kullanıcısı bulunamadı.` 
                    };
                }
            } else {
                logger.debug(`Roblox ID olarak kullanılıyor`, { userId });
            }
            
            return { success: true, userId: userId };
        }
        
        const kişi = interaction.options.getString('kişi');
        if (!kişi) {
            logger.warning(`Kişi belirtilmedi`, { 
                user: `${interaction.user.tag} (${interaction.user.id})` 
            });
            return interaction.editReply('Lütfen bir kişi belirtin (Discord etiketi veya Roblox kullanıcı adı).');
        }
        
        const userInfo = await processUserInfo(kişi);
        if (!userInfo.success) {
            return interaction.editReply(userInfo.message);
        }
        
        if (subcommand === 'değiştir') {
            const rankInput = interaction.options.getString('rütbe');
            const reason = interaction.options.getString('sebep');
            
            logger.debug(`Rütbe değiştirme işlemi başlatıldı`, {
                target: userInfo.userId,
                rankInput,
                reason,
                executor: `${interaction.user.tag} (${interaction.user.id})`
            });
            
            await changeRank(userInfo.userId, rankInput, interaction, reason);
        }
        else if (subcommand === 'terfi') {
            const reason = interaction.options.getString('sebep');
            
            logger.debug(`Terfi işlemi başlatıldı`, {
                target: userInfo.userId,
                reason,
                executor: `${interaction.user.tag} (${interaction.user.id})`
            });
            
            // Yetki kontrolü yap
            const discordId = interaction.user.id;
            const permCheck = await checkPermission(discordId, 32);
            if (!permCheck.success) {
                logger.warning(`Terfi için yetki yetersiz`, {
                    user: `${interaction.user.tag} (${interaction.user.id})`,
                    requiredRank: 32
                });
                return interaction.editReply(permCheck.message);
            }
            
            // Hedef kullanıcıya işlem yapma yetkisi kontrol et
            const rankOpCheck = await checkRankOperation(discordId, userInfo.userId);
            if (!rankOpCheck.success) {
                logger.warning(`Terfi için hedef kullanıcıya işlem yapma yetkisi yok`, {
                    user: `${interaction.user.tag} (${interaction.user.id})`,
                    target: userInfo.userId
                });
                return interaction.editReply(rankOpCheck.message);
            }
            
            try {
                // Kullanıcının mevcut rütbesini al
                const currentRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userInfo.userId);
                
                if (currentRank === 0) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    logger.warning(`Terfi: Kullanıcı gruba üye değil`, {
                        username: userName,
                        userId: userInfo.userId,
                        executor: `${interaction.user.tag} (${interaction.user.id})`
                    });
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel gruba üye değil.`);
                }
                
                // Tüm rolleri al
                const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
                
                // Rolleri rank değerine göre sırala
                roles.sort((a, b) => a.rank - b.rank);
                
                // Mevcut rolün indeksini bul
                const currentRoleIndex = roles.findIndex(role => role.rank === currentRank);
                
                // En yüksek rütbe indeksi
                const highestRoleIndex = roles.length - 1;
                
                // Kullanıcı zaten en yüksek rütbede mi?
                if (currentRoleIndex === highestRoleIndex) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    const currentRoleName = roles[currentRoleIndex].name;
                    logger.warning(`Terfi: Kullanıcı zaten en yüksek rütbede`, {
                        username: userName,
                        userId: userInfo.userId,
                        currentRank: currentRoleName,
                        executor: `${interaction.user.tag} (${interaction.user.id})`
                    });
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel zaten en yüksek rütbe olan **${currentRoleName}** rütbesinde. Daha fazla terfi verilemez.`);
                }
                
                // Bir üst rütbeyi al
                const nextRole = roles[currentRoleIndex + 1];
                
                // Rütbeyi değiştir
                await changeRank(userInfo.userId, nextRole.rank, interaction, reason);
            } catch (error) {
                logger.error(`Terfi hatası`, { 
                    error: error.message,
                    target: userInfo.userId,
                    executor: `${interaction.user.tag} (${interaction.user.id})`
                });
                return interaction.editReply(`Terfi işlemi sırasında bir hata oluştu: ${error.message}`);
            }
        }
        else if (subcommand === 'tenzil') {
            const reason = interaction.options.getString('sebep');
            
            logger.debug(`Tenzil işlemi başlatıldı`, {
                target: userInfo.userId,
                reason,
                executor: `${interaction.user.tag} (${interaction.user.id})`
            });
            
            // Yetki kontrolü yap
            const discordId = interaction.user.id;
            const permCheck = await checkPermission(discordId, 32);
            if (!permCheck.success) {
                logger.warning(`Tenzil için yetki yetersiz`, {
                    user: `${interaction.user.tag} (${interaction.user.id})`,
                    requiredRank: 32
                });
                return interaction.editReply(permCheck.message);
            }
            
            // Hedef kullanıcıya işlem yapma yetkisi kontrol et
            const rankOpCheck = await checkRankOperation(discordId, userInfo.userId);
            if (!rankOpCheck.success) {
                logger.warning(`Tenzil için hedef kullanıcıya işlem yapma yetkisi yok`, {
                    user: `${interaction.user.tag} (${interaction.user.id})`,
                    target: userInfo.userId
                });
                return interaction.editReply(rankOpCheck.message);
            }
            
            try {
                // Kullanıcının mevcut rütbesini al
                const currentRank = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userInfo.userId);
                
                if (currentRank === 0) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    logger.warning(`Tenzil: Kullanıcı gruba üye değil`, {
                        username: userName,
                        userId: userInfo.userId,
                        executor: `${interaction.user.tag} (${interaction.user.id})`
                    });
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel gruba üye değil.`);
                }
                
                // Tüm rolleri al
                const roles = await noblox.getRoles(ROBLOX_GROUP_ID);
                
                // Rolleri rank değerine göre sırala
                roles.sort((a, b) => a.rank - b.rank);
                
                // Mevcut rolün indeksini bul
                const currentRoleIndex = roles.findIndex(role => role.rank === currentRank);
                
                // En düşük rütbe indeksi
                const lowestRoleIndex = 0;
                
                // Kullanıcı zaten en düşük rütbede mi?
                if (currentRoleIndex === lowestRoleIndex) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    const currentRoleName = roles[currentRoleIndex].name;
                    logger.warning(`Tenzil: Kullanıcı zaten en düşük rütbede`, {
                        username: userName,
                        userId: userInfo.userId,
                        currentRank: currentRoleName,
                        executor: `${interaction.user.tag} (${interaction.user.id})`
                    });
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel zaten en düşük rütbe olan **${currentRoleName}** rütbesinde. Daha fazla tenzil verilemez.`);
                }
                
                // Bir alt rütbeyi al
                const prevRole = roles[currentRoleIndex - 1];
                
                // Rütbeyi değiştir
                await changeRank(userInfo.userId, prevRole.rank, interaction, reason, true);
            } catch (error) {
                logger.error(`Tenzil hatası`, { 
                    error: error.message,
                    target: userInfo.userId,
                    executor: `${interaction.user.tag} (${interaction.user.id})`
                });
                return interaction.editReply(`Tenzil işlemi sırasında bir hata oluştu: ${error.message}`);
            }
        }
        else if (subcommand === 'sorgu') {
            try {
                // Kullanıcının rütbesini al
                const username = await noblox.getUsernameFromId(userInfo.userId);
                const rankInGroup = await noblox.getRankInGroup(ROBLOX_GROUP_ID, userInfo.userId);
                
                if (rankInGroup === 0) {
                    logger.warning(`Sorgu: Kullanıcı gruba üye değil`, {
                        username,
                        userId: userInfo.userId,
                        executor: `${interaction.user.tag} (${interaction.user.id})`
                    });
                    return interaction.editReply(`**${username}** (${userInfo.userId}) adlı personel gruba üye değil.`);
                }
                
                const rankName = await noblox.getRankNameInGroup(ROBLOX_GROUP_ID, userInfo.userId);
                
                // Sorgu komutu için özel log çıktısı oluşturulmadı
                
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Rütbe Sorgu')
                    .setDescription(`**${username}** (${userInfo.userId}) adlı personelin rütbesi: **${rankName}**`)
                    .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                logger.error(`Rütbe sorgu hatası`, { 
                    error: error.message,
                    target: userInfo.userId,
                    executor: `${interaction.user.tag} (${interaction.user.id})`
                });
                return interaction.editReply(`Rütbe sorgu işlemi sırasında bir hata oluştu: ${error.message}`);
            }
        }
    }
};