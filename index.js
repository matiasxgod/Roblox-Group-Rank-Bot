const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { deployCommands } = require('./utils/deployCommands');
require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Komutları yükle
client.commands = new Map();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Komutları Discord'a kaydet
deployCommands();

// Bot hazır olduğunda
client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
});

// Komut işleme
client.on('interactionCreate', async interaction => {
    if (interaction.isAutocomplete()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        
        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    }
    
    if (!interaction.isCommand()) return;
    
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    
    try {
        await command.execute(interaction, client);
    } catch (error) {
        console.error(error);
        try {
            const reply = { content: 'Komut çalıştırılırken bir hata oluştu!', ephemeral: true };
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(reply);
            } else {
                await interaction.reply(reply);
            }
        } catch (e) {
            console.error('Hata bildirimi gönderilemedi:', e);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);