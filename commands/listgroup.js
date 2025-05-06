const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const noblox = require('noblox.js');
const { getRobloxIdFromDiscordId } = require('../utils/robloxDatabase');

// Sayfa sayısı oluşturma fonksiyonu
function getPageIndicator(currentPage, totalPages) {
    return `Sayfa ${currentPage + 1}/${totalPages}`;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('grup')
        .setDescription('Grup İşlemleri')
        .addSubcommand(subcommand =>
            subcommand
                .setName('listele')
                .setDescription('Belirtilen kişinin üye olduğu grupları listeler')
                .addStringOption(option =>
                    option.setName('kişi')
                        .setDescription('Grupları görüntülemek istediğiniz kişi (Discord etiketi veya Roblox adı)')
                        .setRequired(true))),
    
    execute: async function(interaction) {
        await interaction.deferReply();
        
        const subcommand = interaction.options.getSubcommand();
        
        if (subcommand === 'listele') {
            const kişi = interaction.options.getString('kişi');
            
            // Kullanıcı bilgilerini işleme
            let robloxId = null;
            let username = null;
            
            // Discord etiketini kontrol et
            if (kişi.startsWith('<@') && kişi.endsWith('>')) {
                const discordId = kişi.replace(/[<@!>]/g, '');
                robloxId = await getRobloxIdFromDiscordId(discordId);
                
                if (!robloxId) {
                    return interaction.editReply(`${kişi} adlı Discord kullanıcısına bağlı bir Roblox hesabı bulunamadı.`);
                }
                
                try {
                    username = await noblox.getUsernameFromId(robloxId);
                } catch (error) {
                    console.error(`Kullanıcı adı alınamadı: ${error.message}`);
                    username = "Bilinmiyor";
                }
            } else {
                // Roblox kullanıcı adı olarak işlem yap
                username = kişi;
                try {
                    robloxId = await noblox.getIdFromUsername(kişi);
                    
                    if (!robloxId) {
                        return interaction.editReply(`"${kişi}" adlı Roblox kullanıcısı bulunamadı.`);
                    }
                } catch (error) {
                    return interaction.editReply(`"${kişi}" adlı Roblox kullanıcısı bulunamadı.`);
                }
            }
            
            // Kullanıcının gruplarını al
            try {
                const groups = await noblox.getGroups(robloxId);
                
                // Hiç grup yoksa
                if (groups.length === 0) {
                    return interaction.editReply(`${username} (${robloxId}) adlı kullanıcı herhangi bir Roblox grubuna üye değil.`);
                }
                
                // Her sayfada 18 grup
                const GROUPS_PER_PAGE = 18;
                const pageCount = Math.ceil(groups.length / GROUPS_PER_PAGE);
                
                // Sayfa oluşturma fonksiyonu
                function createEmbed(pageIndex) {
                    const startIdx = pageIndex * GROUPS_PER_PAGE;
                    const endIdx = Math.min(startIdx + GROUPS_PER_PAGE, groups.length);
                    const pageGroups = groups.slice(startIdx, endIdx);
                    
                    const embed = new EmbedBuilder()
                        .setColor('#00FF00')
                        .setTimestamp();
                    
                    // Sayfa numarasına göre başlık ve açıklama değiştir
                    if (pageIndex === 0) {
                        embed.setTitle('İşlem başarıyla tamamlandı')
                             .setDescription(`**${username}** **(${robloxId})** adlı kişinin mevcut olduğu gruplar:`);
                    } else {
                        embed.setTitle(`${pageIndex + 1}. Sayfa`)
                             .setDescription(`**${username}** **(${robloxId})** adlı kişinin mevcut olduğu gruplar:`);
                    }
                    
                    embed.setFooter({ 
                        text: `@matiasxgod tarafından sağlanmıştır. | ${getPageIndicator(pageIndex, pageCount)}` 
                    });
                    
                    // Grupları ekle
                    for (const group of pageGroups) {
                        embed.addFields({
                            name: group.Name,
                            value: `Grup ID: ${group.Id}\nÜye Sayısı: ${group.MemberCount || '?'}\nRütbe: ${group.Role}`,
                            inline: true
                        });
                    }
                    
                    // Satır başına grup sayısı
                    const GROUPS_PER_ROW = 6;
                    
                    // Mevcut sayfadaki grup sayısı
                    const groupsInPage = pageGroups.length;
                    
                    // Her 3 gruptan sonra görünmez ayırıcı ekle
                    for (let i = 3; i < groupsInPage; i += GROUPS_PER_ROW) {
                        if (i < GROUPS_PER_ROW) {
                            // Satırın ortasında, 3. gruptan sonra boş alan ekle
                            embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
                        }
                    }
                    
                    // Satır sonlarını tamamlamak için gereken boş alanları ekle
                    const lastRowItemCount = groupsInPage % GROUPS_PER_ROW;
                    
                    if (lastRowItemCount > 0 && lastRowItemCount < GROUPS_PER_ROW) {
                        // Son satırı tamamlamak için gerekli boş alan sayısı
                        const emptyFieldsNeeded = GROUPS_PER_ROW - lastRowItemCount;
                        
                        for (let i = 0; i < emptyFieldsNeeded; i++) {
                            embed.addFields({ name: '\u200B', value: '\u200B', inline: true });
                        }
                    }
                    
                    return embed;
                }
                
                // İlk sayfayı oluştur
                const initialEmbed = createEmbed(0);
                
                // Düğmeleri oluştur
                const buttonRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('first')
                            .setLabel('İlk Sayfa')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true), // İlk sayfada "İlk Sayfa" düğmesi devre dışı
                        
                        new ButtonBuilder()
                            .setCustomId('previous')
                            .setLabel('Önceki')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(true), // İlk sayfada "Önceki" düğmesi devre dışı
                        
                        new ButtonBuilder()
                            .setCustomId('next')
                            .setLabel('Sonraki')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageCount <= 1), // Tek sayfa varsa "Sonraki" düğmesi devre dışı
                        
                        new ButtonBuilder()
                            .setCustomId('last')
                            .setLabel('Son Sayfa')
                            .setStyle(ButtonStyle.Primary)
                            .setDisabled(pageCount <= 1) // Tek sayfa varsa "Son Sayfa" düğmesi devre dışı
                    );
                
                // İlk mesajı gönder
                const message = await interaction.editReply({
                    embeds: [initialEmbed],
                    components: pageCount > 1 ? [buttonRow] : [] // Tek bir sayfa varsa düğmeleri gösterme
                });
                
                // Düğme etkileşimleri için collector oluştur
                if (pageCount > 1) {
                    const collector = message.createMessageComponentCollector({
                        componentType: ComponentType.Button,
                        time: 300000 // 5 dakika sonra düğmeler pasif hale gelir
                    });
                    
                    let currentPage = 0;
                    
                    collector.on('collect', async (i) => {
                        // Sadece komutu kullanan kişi düğmelere basabilir
                        if (i.user.id !== interaction.user.id) {
                            return i.reply({
                                content: 'Bu düğmeleri sadece komutu kullanan kişi kullanabilir.',
                                ephemeral: true
                            });
                        }
                        
                        // Düğmeye göre işlem yap
                        switch (i.customId) {
                            case 'first':
                                currentPage = 0;
                                break;
                            case 'previous':
                                currentPage = Math.max(0, currentPage - 1);
                                break;
                            case 'next':
                                currentPage = Math.min(pageCount - 1, currentPage + 1);
                                break;
                            case 'last':
                                currentPage = pageCount - 1;
                                break;
                        }
                        
                        // Düğmeleri güncelle
                        const updatedButtonRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('first')
                                    .setLabel('İlk Sayfa')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(currentPage === 0),
                                
                                new ButtonBuilder()
                                    .setCustomId('previous')
                                    .setLabel('Önceki')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(currentPage === 0),
                                
                                new ButtonBuilder()
                                    .setCustomId('next')
                                    .setLabel('Sonraki')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(currentPage === pageCount - 1),
                                
                                new ButtonBuilder()
                                    .setCustomId('last')
                                    .setLabel('Son Sayfa')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(currentPage === pageCount - 1)
                            );
                        
                        // Sayfayı güncelle
                        await i.update({
                            embeds: [createEmbed(currentPage)],
                            components: [updatedButtonRow]
                        });
                    });
                    
                    collector.on('end', async () => {
                        // Süre dolduğunda düğmeleri devre dışı bırak
                        const disabledButtonRow = new ActionRowBuilder()
                            .addComponents(
                                new ButtonBuilder()
                                    .setCustomId('first')
                                    .setLabel('İlk Sayfa')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true),
                                
                                new ButtonBuilder()
                                    .setCustomId('previous')
                                    .setLabel('Önceki')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true),
                                
                                new ButtonBuilder()
                                    .setCustomId('next')
                                    .setLabel('Sonraki')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true),
                                
                                new ButtonBuilder()
                                    .setCustomId('last')
                                    .setLabel('Son Sayfa')
                                    .setStyle(ButtonStyle.Primary)
                                    .setDisabled(true)
                            );
                        
                        try {
                            await message.edit({
                                components: [disabledButtonRow]
                            });
                        } catch (error) {
                            console.error('Düğmeler devre dışı bırakılırken hata oluştu:', error);
                        }
                    });
                }
            } catch (error) {
                console.error(`Grupları alırken hata oluştu: ${error.message}`);
                return interaction.editReply(`Gruplar alınırken bir hata oluştu: ${error.message}`);
            }
        }
    }
};