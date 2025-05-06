const { Client, GatewayIntentBits, Collection, ActivityType } = require('discord.js');
const noblox = require('noblox.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { deployCommands } = require('./utils/deployCommands.js');

deployCommands()
  .then(() => console.log('Komutlar başarıyla deploy edildi.'))
  .catch((err) => console.error('Komut deploy hatası:', err));

// Discord istemcisini yapılandır
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Logger modülünü önce yükle
const logger = require('./utils/logger');

// Komutları yükle
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    try {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        // Komut dosyasının gerekli özellikleri içerip içermediğini kontrol et
        if (command.data && command.data.name && command.execute) {
            client.commands.set(command.data.name, command);
            console.log(`${command.data.name} komutu yüklendi.`);
        } else {
            console.warn(`[UYARI] ${file} dosyası gerekli özellikleri içermiyor (data, name veya execute).`);
        }
    } catch (error) {
        console.error(`[HATA] ${file} dosyası yüklenirken bir hata oluştu:`, error);
    }
}

// Roblox oturumunu başlat
async function initializeRoblox() {
    try {
        const currentUser = await noblox.setCookie(process.env.ROBLOX_COOKIE);
        console.log(`Roblox hesabı ile giriş yapıldı: ${currentUser.UserName} [${currentUser.UserID}]`);
        return true;
    } catch (error) {
        console.error('Roblox oturumu başlatılırken hata oluştu:', error);
        return false;
    }
}

// Bot hazır olduğunda
client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('| TAES | Turkish Armed Forces', { type: ActivityType.Playing });
    // Logger'a client'ı ata - BURADA HATA ALIYORDUK
    logger.setClient(client);
    
    // Roblox oturumunu başlat
    const robloxInitialized = await initializeRoblox();
    if (robloxInitialized) {
        console.log('Roblox entegrasyonu hazır!');
    } else {
        console.error('Roblox entegrasyonu başlatılamadı. Bot bazı işlevleri kullanamayabilir.');
    }
});

// Komut işleyici
client.on('interactionCreate', async interaction => {
    // Otomatik tamamlama
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(`Otomatik tamamlama hatası (${interaction.commandName}):`, error);
        }
        return;
    }

    // Slash komutları
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`Komut hatası (${interaction.commandName}):`, error);
        const errorMessage = `Komut yürütülürken bir hata oluştu: ${error.message}`;
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

// Discord'a bağlan
client.login(process.env.TOKEN);