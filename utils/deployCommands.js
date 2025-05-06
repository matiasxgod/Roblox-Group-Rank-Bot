const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const deployCommands = async () => {
    const commands = [];
    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    // Komut dosyalarını toplama
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[UYARI] ${filePath} komut dosyasında "data" veya "execute" özelliği eksik.`);
        }
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log(`${commands.length} slash komut kaydediliyor...`);

        // Bot'un ID'si ve sunucu ID'sini kullanarak komutları kaydedin
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log(`${data.length} slash komut başarıyla kaydedildi.`);
        return true;
    } catch (error) {
        console.error(`Slash komutları kaydederken hata oluştu: ${error}`);
        return false;
    }
};

module.exports = { deployCommands };

// Eğer bu dosya doğrudan çalıştırılıyorsa, komutları kaydet
if (require.main === module) {
    deployCommands()
        .then(() => console.log('Komut kaydı tamamlandı.'))
        .catch(error => console.error('Komut kaydı hatası:', error));
}