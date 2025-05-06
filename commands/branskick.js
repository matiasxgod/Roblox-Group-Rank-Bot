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
const MINIMUM_BRANCH_AUTHORITY_RANK = 254; // Bu değeri ihtiyacınıza göre ayarlayabilirsiniz

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('branş-at')
        .setDescription('Belirtilen kişiyi branştan çıkarır')
        .addStringOption(option =>
            option.setName('kişi')
                .setDescription('Branştan çıkarılacak kişi (Discord etiketi veya Roblox adı)')
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
                .setDescription('Branştan çıkarma sebebi')
                .setRequired(true)),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        // Roblox oturumunu başlat
        const robloxInitialized = await initRoblox();
        if (!robloxInitialized) {
            return interaction.editReply('Roblox oturumu başlatılamadı. Lütfen daha sonra tekrar deneyin.');
        }
        
        const kişi = interaction.options.getString('kişi');
        const branchId = interaction.options.getString('branş');
        const sebep = interaction.options.getString('sebep');
        
        const branchName = BRANCH_NAMES[branchId] || branchId;
        const branchGroupId = BRANCH_GROUP_IDS[branchId];
        
        if (!branchGroupId) {
            return interaction.editReply(`Geçersiz branş: ${branchId}`);
        }
        
        // Komutu çalıştıranın Roblox ID'sini al
        const executorRobloxId = await getRobloxIdFromDiscordId(interaction.user.id);
        if (!executorRobloxId) {
            return interaction.editReply("Hesap bağlantınız bulunamadı. Lütfen /yenile komutunu kullanın.");
        }
        
        // Komutu çalıştıranın branş içindeki rütbesini al
        let executorRoleRank = 0;
        let executorRoleName = "Bilinmiyor";
        
        try {
            executorRoleRank = await noblox.getRankInGroup(branchGroupId, executorRobloxId);
            
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
            
            return interaction.editReply(`**${branchName}** branşında kişi çıkarma yapabilmeniz gereken en düşük rütbe **${minimumRoleName}** \nMevcut rütbeniz: **${executorRoleName}**`);
        }
        
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
        
        // Kullanıcı bilgisini işle
        const userInfo = await processUserInfo(kişi);
        if (!userInfo.success) {
            return interaction.editReply(userInfo.message);
        }
        
        // Hedef kullanıcının bilgilerini al
        let userName;
        try {
            userName = await noblox.getUsernameFromId(userInfo.userId);
        } catch (error) {
            console.error(`Kullanıcı adı alınamadı: ${error.message}`);
            userName = `(ID: ${userInfo.userId})`;
        }
        
        // Hedef kullanıcının branştaki rütbesini kontrol et
        let targetRoleRank = 0;
        try {
            targetRoleRank = await noblox.getRankInGroup(branchGroupId, userInfo.userId);
            
            if (targetRoleRank === 0) {
                return interaction.editReply(`**${userName}** (${userInfo.userId}) adlı kullanıcı **${branchName}** branşına zaten üye değil.`);
            }
            
            const targetRoleName = await noblox.getRankNameInGroup(branchGroupId, userInfo.userId);
            
            // Komutu çalıştıranın, hedef kişinin rütbesinden yüksek rütbede olup olmadığını kontrol et
            if (targetRoleRank >= executorRoleRank) {
                return interaction.editReply(`**${userName}** adlı kullanıcının rütbesi sizinkine eşit veya daha yüksek olduğu için işlem yapamazsınız.\nSizin rütbeniz: **${executorRoleName}** (${executorRoleRank})\nHedef kişinin rütbesi: **${targetRoleName}** (${targetRoleRank})`);
            }
            
            // Kullanıcıyı gruptan çıkar
            try {
                // Noblox.js ile kullanıcıyı gruptan çıkar (kick)
                await noblox.exile(branchGroupId, userInfo.userId);
                
                // Başarı mesajı
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('Branştan Çıkarma')
                    .setDescription(`**${userName}** (${userInfo.userId}) adlı kullanıcı **${branchName}** branşından başarıyla çıkarıldı.`)
                    .addFields(
                        { name: 'Sebep', value: sebep },
                        { name: 'İşlemi Yapan', value: `<@${interaction.user.id}>` }
                    )
                    .setFooter({ text: '@matiasxgod tarafından sağlanmıştır.' })
                    .setTimestamp();
                
                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                console.error(`Gruptan çıkarma hatası: ${error.message}`);
                return interaction.editReply(`Kullanıcı gruptan çıkarılırken bir hata oluştu: ${error.message}`);
            }
        } catch (error) {
            console.error(`Kullanıcı rütbesi kontrolü hatası: ${error.message}`);
            return interaction.editReply(`Kullanıcı rütbesi kontrol edilirken bir hata oluştu: ${error.message}`);
        }
    }
};