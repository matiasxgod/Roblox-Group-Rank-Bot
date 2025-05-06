const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const noblox = require('noblox.js');
const { getRobloxIdFromDiscordId } = require('../utils/robloxDatabase');
require('dotenv').config();

// Branşlar için grup ID'leri
const BRANCH_GROUP_IDS = {
    asiz: process.env.ASIZ_GROUP_ID,
    hkk: process.env.HKK_GROUP_ID,
    okk: process.env.OKK_GROUP_ID,
    kkk: process.env.KKK_GROUP_ID,
    jgk: process.env.JGK_GROUP_ID,
    dkk: process.env.DKK_GROUP_ID,
    sm: process.env.SM_GROUP_ID
};

// Branş isimleri
const BRANCH_NAMES = {
    asiz: "ASIZ",
    hkk: "HKK",
    okk: "ÖKK",
    kkk: "KKK",
    jgk: "JGK",
    dkk: "DKK",
    sm: "SM"
};

// Branşta minimum yetkili rütbe kontrolü
const MINIMUM_BRANCH_AUTHORITY_RANK = 254;

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

// Branş için rütbe değiştirme fonksiyonu
async function changeBranchRank(userId, branchId, rankInput, interaction, reason) {
    const discordId = interaction.user.id;
    const branchGroupId = BRANCH_GROUP_IDS[branchId];
    const branchName = BRANCH_NAMES[branchId] || branchId;
    
    if (!branchGroupId) {
        return interaction.editReply(`Geçersiz branş: ${branchId}`);
    }
    
    // Komutu çalıştıranın Roblox ID'sini al
    const executorRobloxId = await getRobloxIdFromDiscordId(discordId);
    if (!executorRobloxId) {
        return interaction.editReply("Hesap bağlantınız bulunamadı. Lütfen /yenile komutunu kullanın.");
    }
    
    try {
        // Komutu çalıştıranın branş içindeki rütbesini al
        let executorRoleName = "Bilinmiyor";
        let executorRoleRank = 0;
        
        try {
            const executorRank = await noblox.getRankInGroup(branchGroupId, executorRobloxId);
            executorRoleRank = executorRank;
            
            if (executorRoleRank === 0) {
                return interaction.editReply(`Siz **${branchName}** branşına üye değilsiniz. Bu branşta işlem yapamazsınız.`);
            }
            
            executorRoleName = await noblox.getRankNameInGroup(branchGroupId, executorRobloxId);
        } catch (error) {
            console.error(`Komutu çalıştıranın rütbesi alınamadı: ${error.message}`);
            return interaction.editReply("Rütbe bilgileriniz alınamadı.");
        }
        
        // Branşta minimum yetkili rütbe kontrolü
        if (executorRoleRank < MINIMUM_BRANCH_AUTHORITY_RANK) {
            // Minimum rank değerine karşılık gelen rütbe adını al
            const groupRoles = await noblox.getRoles(branchGroupId);
            const minimumRole = groupRoles.find(role => role.rank >= MINIMUM_BRANCH_AUTHORITY_RANK);
            const minimumRoleName = minimumRole ? minimumRole.name : "Yetkili Rütbe";
            
            return interaction.editReply(`**${branchName}** branşında rütbe değişikliği yapabilmeniz için Gereken en düşük Rütbe **${minimumRoleName}** \nMevcut rütbeniz: **${executorRoleName}**`);
        }
        
        // Hedef kişinin bilgilerini al
        const userName = await noblox.getUsernameFromId(userId);
        
        // Hedef kişinin branştaki rütbesi
        let currentRoleRank = 0;
        let currentRoleName = "Bilinmiyor";
        
        try {
            currentRoleRank = await noblox.getRankInGroup(branchGroupId, userId);
            
            if (currentRoleRank === 0) {
                return interaction.editReply(`**${userName}** (${userId}) adlı personel ${branchName} branşına üye değil.`);
            }
            
            currentRoleName = await noblox.getRankNameInGroup(branchGroupId, userId);
            
            // Komutu çalıştıranın, hedef kişinin mevcut rütbesinden yüksek rütbede olup olmadığını kontrol et
            if (currentRoleRank >= executorRoleRank) {
                return interaction.editReply(`**${userName}** adlı personelin rütbesi sizinkine eşit veya daha yüksek olduğu için işlem yapamazsınız.\nSizin rütbeniz: **${executorRoleName}** (${executorRoleRank})\nHedef kişinin rütbesi: **${currentRoleName}** (${currentRoleRank})`);
            }
        } catch (error) {
            console.error(`Kullanıcının mevcut rütbesi alınamadı: ${error.message}`);
            return interaction.editReply("Kullanıcının mevcut rütbesi alınamadı.");
        }
        
        // Rolü bul
        const groupRoles = await noblox.getRoles(branchGroupId);
        let newRole = null;
        
        if (!isNaN(rankInput)) {
            // Sayı olarak verilmişse
            newRole = groupRoles.find(role => role.rank === parseInt(rankInput));
        } else {
            // İsim olarak verilmişse
            newRole = groupRoles.find(role => role.name.toLowerCase() === rankInput.toLowerCase());
        }
        
        if (!newRole) {
            return interaction.editReply(`${branchName} branşında geçerli bir rütbe bulunamadı.`);
        }
        
        // Komutu çalıştıranın kendi rütbesini kontrol et
        if (newRole.rank >= executorRoleRank) {
            return interaction.editReply(`**${branchName}** branşında kendinize eşit veya daha yüksek rütbede işlem yapamazsınız.\nSizin rütbeniz: **${executorRoleName}** (${executorRoleRank})\nHedef rütbe: **${newRole.name}** (${newRole.rank})`);
        }
        
        // Rütbeyi değiştir
        await noblox.setRank(branchGroupId, userId, newRole.rank);
        
        // Başarı mesajı
        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('Branş Rütbe Değişikliği')
            .setDescription(`**${userName} (${userId})** adlı personele **${branchName}** branşında **${newRole.name}** rütbesi başarıyla verildi!`)
            .addFields(
                { name: 'Sebep', value: reason },
                { name: 'İşlemi Yapan:', value: `<@${interaction.user.id}>` }
            )
            .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
        return true;
    } catch (error) {
        console.error(`Rütbe değiştirme hatası: ${error.message}`);
        return interaction.editReply(`Rütbe değiştirme işlemi sırasında bir hata oluştu: ${error.message}`);
    }
}

// Branşa özgü rolleri getiren fonksiyon
async function getBranchRoles(branchId) {
    const branchGroupId = BRANCH_GROUP_IDS[branchId];
    if (!branchGroupId) {
        return [];
    }

    try {
        const roles = await noblox.getRoles(branchGroupId);
        // Rolleri rankına göre sırala
        const sortedRoles = [...roles].sort((a, b) => a.rank - b.rank);
        // Rütbe adlarını döndür
        return sortedRoles.map(role => role.name);
    } catch (error) {
        console.error(`Branş rolleri alınamadı: ${error.message}`);
        return [];
    }
}

// Otomatik tamamlama fonksiyonu
async function autocompleteRoles(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    
    if (focusedOption.name === 'rütbe') {
        // Seçilen branşı al
        const branchId = interaction.options.getString('branş');
        
        // Eğer branş seçilmemişse genel rolleri göster
        if (!branchId) {
            return interaction.respond([
                { name: "Lütfen önce bir branş seçin", value: "seçin" }
            ]);
        }
        
        // Seçilen branşın rollerini getir
        const branchRoles = await getBranchRoles(branchId);
        
        // Filtreleme
        const filteredRoles = branchRoles.filter(role =>
            role.toLowerCase().includes(focusedOption.value.toLowerCase())
        );
        
        await interaction.respond(
            filteredRoles.slice(0, 25).map(role => ({
                name: role,
                value: role
            }))
        );
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('branş-rütbe')
        .setDescription('Branş Rütbe İşlemleri')
        .addSubcommand(subcommand =>
            subcommand
                .setName('değiştir')
                .setDescription('Kişinin branş rütbesini değiştirir')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Rütbesini değiştirmek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('branş')
                        .setDescription('İşlem yapılacak branş')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ASIZ', value: 'asiz' },
                            { name: 'HKK', value: 'hkk' },
                            { name: 'ÖKK', value: 'okk' },
                            { name: 'KKK', value: 'kkk' },
                            { name: 'JGK', value: 'jgk' },
                            { name: 'DKK', value: 'dkk' },
                            { name: 'SM', value: 'sm' }
                        ))
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
                .setName('sorgu')
                .setDescription('Kişinin branş içi rütbesini sorgular')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Rütbesini öğrenmek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('branş')
                        .setDescription('Sorgulanacak branş')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ASIZ', value: 'asiz' },
                            { name: 'HKK', value: 'hkk' },
                            { name: 'ÖKK', value: 'okk' },
                            { name: 'KKK', value: 'kkk' },
                            { name: 'JGK', value: 'jgk' },
                            { name: 'DKK', value: 'dkk' },
                            { name: 'SM', value: 'sm' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('terfi')
                .setDescription('Kişiye seçilen branşta bir üst rütbe verir')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Terfi vermek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('branş')
                        .setDescription('İşlem yapılacak branş')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ASIZ', value: 'asiz' },
                            { name: 'HKK', value: 'hkk' },
                            { name: 'ÖKK', value: 'okk' },
                            { name: 'KKK', value: 'kkk' },
                            { name: 'JGK', value: 'jgk' },
                            { name: 'DKK', value: 'dkk' },
                            { name: 'SM', value: 'sm' }
                        ))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Terfi verme nedeni')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('tenzil')
                .setDescription('Kişiye seçilen branşta bir alt rütbe verir')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Tenzil vermek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('branş')
                        .setDescription('İşlem yapılacak branş')
                        .setRequired(true)
                        .addChoices(
                            { name: 'ASIZ', value: 'asiz' },
                            { name: 'HKK', value: 'hkk' },
                            { name: 'ÖKK', value: 'okk' },
                            { name: 'KKK', value: 'kkk' },
                            { name: 'JGK', value: 'jgk' },
                            { name: 'DKK', value: 'dkk' },
                            { name: 'SM', value: 'sm' }
                        ))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('Tenzil verme nedeni')
                        .setRequired(true))),
    
    autocomplete: async function(interaction) {
        if (interaction.commandName === 'branş-rütbe') {
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
        
        // Roblox oturumunu başlat
        const robloxInitialized = await initRoblox();
        if (!robloxInitialized) {
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
                                        return { success: true, userId: robloxId };
                                    }
                                } catch (error) {
                                    console.error(`Roblox ID bulunamadı: ${error.message}`);
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Discord üye bilgisi alınamadı: ${error.message}`);
                    }
                    
                    return { 
                        success: false, 
                        message: `${userInput} adlı Discord kullanıcısına bağlı bir Roblox hesabı bulunamadı.` 
                    };
                } catch (error) {
                    console.error(`Roblox ID alınamadı: ${error.message}`);
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
                        return { 
                            success: false, 
                            message: `"${userInput}" adlı Roblox kullanıcısı bulunamadı.` 
                        };
                    }
                } catch (error) {
                    return { 
                        success: false, 
                        message: `"${userInput}" adlı Roblox kullanıcısı bulunamadı.` 
                    };
                }
            }
            
            return { success: true, userId: userId };
        }
        
        const kişi = interaction.options.getString('kişi');
        if (!kişi) {
            return interaction.editReply('Lütfen bir kişi belirtin (Discord etiketi veya Roblox kullanıcı adı).');
        }
        
        const userInfo = await processUserInfo(kişi);
        if (!userInfo.success) {
            return interaction.editReply(userInfo.message);
        }

        if (subcommand === 'değiştir') {
            const branchId = interaction.options.getString('branş');
            const rankInput = interaction.options.getString('rütbe');
            const reason = interaction.options.getString('sebep');
            
            await changeBranchRank(userInfo.userId, branchId, rankInput, interaction, reason);
        }
        else if (subcommand === 'sorgu') {
            const branchId = interaction.options.getString('branş');
            const branchName = BRANCH_NAMES[branchId] || branchId;
            const branchGroupId = BRANCH_GROUP_IDS[branchId];
            
            if (!branchGroupId) {
                return interaction.editReply(`Geçersiz branş: ${branchId}`);
            }
            
            try {
                // Kişinin branş içindeki rütbesini al
                const rankInGroup = await noblox.getRankInGroup(branchGroupId, userInfo.userId);
                
                if (rankInGroup === 0) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşına üye değil.`);
                }
                
                const rankName = await noblox.getRankNameInGroup(branchGroupId, userInfo.userId);
                const userName = await noblox.getUsernameFromId(userInfo.userId);
                
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('Branş Rütbe Sorgu')
                    .setDescription(`**${userName}** (${userInfo.userId}) adlı personelin **${branchName}** branşındaki rütbesi: **${rankName}**`)
                    .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(`Kullanıcının branş rütbesi alınamadı: ${error.message}`);
                return interaction.editReply("Kullanıcının branş rütbesi alınamadı.");
            }
        }
        else if (subcommand === 'terfi') {
            const branchId = interaction.options.getString('branş');
            const reason = interaction.options.getString('sebep');
            
            const branchGroupId = BRANCH_GROUP_IDS[branchId];
            if (!branchGroupId) {
                return interaction.editReply(`Geçersiz branş: ${branchId}`);
            }
            
            try {
                // Kullanıcının mevcut rütbesini al
                const currentRank = await noblox.getRankInGroup(branchGroupId, userInfo.userId);
                
                if (currentRank === 0) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    const branchName = BRANCH_NAMES[branchId] || branchId;
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşına üye değil.`);
                }
                
                // Grup rollerini al
                const roles = await noblox.getRoles(branchGroupId);
                
                // Rolleri rank değerine göre sırala
                roles.sort((a, b) => a.rank - b.rank);
                
                // Mevcut rol indeksini bul
                const currentRoleIndex = roles.findIndex(role => role.rank === currentRank);
                
                // En yüksek rol indeksi
                const highestRoleIndex = roles.length - 1;
                
                // Kullanıcı zaten en yüksek rütbede mi?
                if (currentRoleIndex === highestRoleIndex || currentRoleIndex === highestRoleIndex - 1) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    const branchName = BRANCH_NAMES[branchId] || branchId;
                    const currentRoleName = roles[currentRoleIndex].name;
                    const highestRoleName = roles[highestRoleIndex].name;
                    
                    if (currentRoleIndex === highestRoleIndex - 1) {
                        return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşında **${currentRoleName}** rütbesinde. Bir üst rütbe **${highestRoleName}** grup yönetim rütbesi olduğu için terfi verilemez.`);
                    } else {
                        return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşında zaten en yüksek rütbe olan **${currentRoleName}** rütbesinde. Daha fazla terfi verilemez.`);
                    }
                }
                
                // Bir üst rütbeyi al
                const nextRole = roles[currentRoleIndex + 1];
                
                // Rütbeyi değiştir
                await changeBranchRank(userInfo.userId, branchId, nextRole.rank, interaction, reason);
            } catch (error) {
                console.error(`Terfi hatası: ${error.message}`);
                return interaction.editReply(`Terfi işlemi sırasında bir hata oluştu: ${error.message}`);
            }
        }
        else if (subcommand === 'tenzil') {
            const branchId = interaction.options.getString('branş');
            const reason = interaction.options.getString('sebep');
            
            const branchGroupId = BRANCH_GROUP_IDS[branchId];
            if (!branchGroupId) {
                return interaction.editReply(`Geçersiz branş: ${branchId}`);
            }
            
            try {
                // Kullanıcının mevcut rütbesini al
                const currentRank = await noblox.getRankInGroup(branchGroupId, userInfo.userId);
                
                if (currentRank === 0) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    const branchName = BRANCH_NAMES[branchId] || branchId;
                    return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşına üye değil.`);
                }
                
                // Grup rollerini al
                const roles = await noblox.getRoles(branchGroupId);
                
                // Rolleri rank değerine göre sırala
                roles.sort((a, b) => a.rank - b.rank);
                
                // Mevcut rol indeksini bul
                const currentRoleIndex = roles.findIndex(role => role.rank === currentRank);
                
                // En düşük rol indeksi
                const lowestRoleIndex = 0;
                
                // Kullanıcı zaten en düşük rütbede mi?
                if (currentRoleIndex === lowestRoleIndex || currentRoleIndex === lowestRoleIndex + 1) {
                    const userName = await noblox.getUsernameFromId(userInfo.userId);
                    const branchName = BRANCH_NAMES[branchId] || branchId;
                    const currentRoleName = roles[currentRoleIndex].name;
                    const lowestRoleName = roles[lowestRoleIndex].name;
                    
                    if (currentRoleIndex === lowestRoleIndex + 1) {
                        //return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşında **${currentRoleName}** rütbesinde. Bir alt rütbe **${lowestRoleName}** en düşük rütbe.`);
                    } else {
                        return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı personel **${branchName}** branşında zaten en düşük rütbe olan **${currentRoleName}** rütbesinde. Daha fazla tenzil verilemez.`);
                    }
                }
                
                // Bir alt rütbeyi al
                const prevRole = roles[currentRoleIndex - 1];
                
                // Rütbeyi değiştir
                await changeBranchRank(userInfo.userId, branchId, prevRole.rank, interaction, reason);
            } catch (error) {
                console.error(`Tenzil hatası: ${error.message}`);
                return interaction.editReply(`Tenzil işlemi sırasında bir hata oluştu: ${error.message}`);
            }
        }
    }
};