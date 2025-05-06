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

// Roblox oturumunu başlatma fonksiyonu
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

// Kullanıcı bilgilerini işleme fonksiyonu
async function processUserInfo(userInput, interaction) {
    // Discord etiketini kontrol et
    if (userInput.startsWith('<@') && userInput.endsWith('>')) {
        const userId = userInput.replace(/[<@!>]/g, '');
        
        try {
            // Discord ID'den Roblox ID'yi almayı dene
            try {
                const robloxId = await getRobloxIdFromDiscordId(userId);
                if (robloxId) {
                    const username = await noblox.getUsernameFromId(robloxId);
                    return { success: true, userId: robloxId, username: username };
                }
            } catch (error) {
                console.error(`Veritabanından Roblox ID alınamadı: ${error.message}`);
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
                                return { success: true, userId: robloxId, username: displayName };
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
            return { success: true, userId: userId, username: userInput };
        } catch (error) {
            return { 
                success: false, 
                message: `"${userInput}" adlı Roblox kullanıcısı bulunamadı.` 
            };
        }
    }
    
    try {
        const username = await noblox.getUsernameFromId(userId);
        return { success: true, userId: userId, username: username };
    } catch (error) {
        return {
            success: false,
            message: `Roblox ID'si ${userId} olan kullanıcı bulunamadı.`
        };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('branş-istek')
        .setDescription('Branşlara katılma isteği sistemi')
        .addSubcommand(subcommand =>
            subcommand
                .setName('sorgu')
                .setDescription('Belirtilen kişinin, belirtilen branşa katılma isteği gönderip göndermediğini kontrol eder')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Kontrol edilecek kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('branş')
                        .setDescription('Kontrol edilecek branş')
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
                .setName('işlem')
                .setDescription('Branşlara katılma isteğini kabul veya reddeder')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('İşlem yapılacak kişi (Discord etiketi veya Roblox adı)')
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
                    option.setName('işlem')
                        .setDescription('Yapılacak işlem')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Kabul', value: 'kabul' },
                            { name: 'Ret', value: 'ret' }
                        ))
                .addStringOption(option =>
                    option.setName('sebep')
                        .setDescription('İşlemin sebebi')
                        .setRequired(true))),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        // Roblox oturumunu başlat
        const robloxInitialized = await initRoblox();
        if (!robloxInitialized) {
            return interaction.editReply('Roblox oturumu başlatılamadı. Lütfen daha sonra tekrar deneyin.');
        }
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'sorgu') {
            const kişi = interaction.options.getString('kişi');
            const branchId = interaction.options.getString('branş');
            
            const branchName = BRANCH_NAMES[branchId] || branchId;
            const branchGroupId = BRANCH_GROUP_IDS[branchId];
            
            if (!branchGroupId) {
                return interaction.editReply(`Geçersiz branş: ${branchId}`);
            }
            
            // Kullanıcı bilgisini işle
            const userInfo = await processUserInfo(kişi, interaction);
            if (!userInfo.success) {
                return interaction.editReply(userInfo.message);
            }
            
            try {
                // Grup isteklerini kontrol et
                const joinRequests = await noblox.getJoinRequests(branchGroupId);
                
                // Kullanıcının isteği var mı kontrol et
                const userRequest = joinRequests.data.find(request => 
                    request.requester && 
                    request.requester.userId.toString() === userInfo.userId.toString()
                );
                
                if (userRequest) {
                    // İstek varsa
                    const requestDate = new Date(userRequest.created);
                    const formattedDate = requestDate.toLocaleString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Branş İsteği Sorgu')
                        .setDescription(`**${userInfo.username}** (${userInfo.userId}) adlı kullanıcının **${branchName}** branşına katılma isteği bulunuyor.`)
                        .addFields(
                            { name: 'İstek Tarihi', value: formattedDate }
                        )
                        .setFooter({ text: 'İstek sistemi' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    // İstek yoksa
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Branş İsteği Sorgu')
                        .setDescription(`**${userInfo.username}** (${userInfo.userId}) adlı kullanıcının **${branchName}** branşına katılma isteği bulunmuyor.`)
                        .setFooter({ text: 'İstek sistemi' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                }
            } catch (error) {
                console.error(`İstek sorgulama hatası:`, error);
                return interaction.editReply(`İstek sorgulanırken bir hata oluştu: ${error.message}`);
            }
        } else if (subcommand === 'işlem') {
            const kişi = interaction.options.getString('kişi');
            const branchId = interaction.options.getString('branş');
            const işlem = interaction.options.getString('işlem');
            const sebep = interaction.options.getString('sebep');
            
            const branchName = BRANCH_NAMES[branchId] || branchId;
            const branchGroupId = BRANCH_GROUP_IDS[branchId];
            
            if (!branchGroupId) {
                return interaction.editReply(`Geçersiz branş: ${branchId}`);
            }
            
            // Kullanıcı bilgisini işle
            const userInfo = await processUserInfo(kişi, interaction);
            if (!userInfo.success) {
                return interaction.editReply(userInfo.message);
            }
            
            // İşlem türüne göre devam et
            if (işlem === 'kabul') {
                try {
                    // noblox.js'in handleJoinRequest fonksiyonunu kullan
                    await noblox.handleJoinRequest(branchGroupId, userInfo.userId, true);
                    
                    // Başarı mesajı
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTitle('Branş İsteği Kabul Edildi')
                        .setDescription(`**${userInfo.username}** (${userInfo.userId}) adlı kullanıcının **${branchName}** branşına katılma isteği kabul edildi.`)
                        .addFields(
                            { name: 'Sebep', value: sebep },
                            { name: 'İşlemi Yapan', value: `<@${interaction.user.id}>` }
                        )
                        .setFooter({ text: 'İstek sistemi' })
                        .setTimestamp();
                    
                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.error(`İstek kabul edilirken hata:`, error);
                    if (error.message && error.message.includes("not found")) {
                        await interaction.editReply(`Bu kullanıcının gruba bir katılma isteği bulunamadı. Kullanıcı önce Roblox üzerinden katılma isteği göndermelidir.`);
                    } else {
                        await interaction.editReply(`İstek kabul edilirken bir hata oluştu: ${error.message}`);
                    }
                }
            } else if (işlem === 'ret') {
                try {
                    // noblox.js'in handleJoinRequest fonksiyonunu kullan
                    await noblox.handleJoinRequest(branchGroupId, userInfo.userId, false);
                    
                    // Red mesajı
                    const embed = new EmbedBuilder()
                        .setColor('#FF0000')
                        .setTitle('Branş İsteği Reddedildi')
                        .setDescription(`**${userInfo.username}** (${userInfo.userId}) adlı kullanıcının **${branchName}** branşına katılma isteği reddedildi.`)
                        .addFields(
                            { name: 'Sebep', value: sebep },
                            { name: 'İşlemi Yapan', value: `<@${interaction.user.id}>` }
                        )
                        .setFooter({ text: 'İstek sistemi' })
                        .setTimestamp();

                    await interaction.editReply({ embeds: [embed] });
                } catch (error) {
                    console.error(`İstek reddedilirken hata:`, error);
                    if (error.message && error.message.includes("not found")) {
                        await interaction.editReply(`Bu kullanıcının gruba bir katılma isteği bulunamadı. Kullanıcı önce Roblox üzerinden katılma isteği göndermelidir.`);
                    } else {
                        await interaction.editReply(`İstek reddedilirken bir hata oluştu: ${error.message}`);
                    }
                }
            }
        }
    }
};