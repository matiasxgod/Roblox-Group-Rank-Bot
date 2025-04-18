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

const commands = [ // Slash Commands
    new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Change the rank of a specified person.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Changes the rank of the person.')
                .addStringOption(option =>
                    option.setName('person')
                        .setDescription('The person whose rank you want to change.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('rank')
                        .setDescription('The rank you want to assign to the person.')
                        .setRequired(true)
                        .setAutocomplete(true)) 
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the rank change')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('promote')
                .setDescription('Promotes the person, increasing their rank by one level.')
                .addStringOption(option =>
                    option.setName('person')
                        .setDescription('The person you want to promote.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the promotion')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('demote')
                .setDescription('Demotes the person, decreasing their rank by one level.')
                .addStringOption(option =>
                    option.setName('person')
                        .setDescription('The person you want to demote.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('The reason for the demotion')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('query')
                .setDescription('Query the rank of a person')
                .addStringOption(option =>
                    option.setName('person')
                        .setDescription('The person whose rank you want to know.')
                        .setRequired(true)))
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(DISCORD_TOKEN);

(async () => {
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );
        console.log('Commands successfully registered!');
    } catch (error) {
        console.error(error);
    }
})();

async function getCsrfToken() { // CSRF Token
    try {
        const authResponse = await axios.get(
            "https://users.roblox.com/v1/users/authenticated",
            {
                headers: { Cookie: `.ROBLOSECURITY=${ROBLOX_COOKIE}` },
            },
        );

        if (!authResponse.data.id) {
            console.error("Invalid ROBLOX_COOKIE! Please get a new cookie.");
            return null;
        }

        console.log("ROBLOX_COOKIE verified, getting CSRF Token...");

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

        console.error("Could not get CSRF Token.");
        return null;
    } catch (error) {
        console.error(`CSRF Token fetching failed: ${error.message}`);
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
            console.log("Rate limit error, waiting for 1 second...");
            await delay(1000);
            return getUserIdFromUsername(username);
        } else {
            console.error(`Could not get user ID: ${error.message}`);
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
        console.error(`Could not fetch rank information: ${error.message}`);
        return null;
    }
}

const ALLOWED_ROLES = ["Ranking", ""];

async function getUserRole(userId) {
    try {
        const response = await axios.get(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
        const userGroup = response.data.data.find((group) => group.group.id === parseInt(ROBLOX_GROUP_ID));
        if (userGroup) {
            return userGroup.role; 
        }
        return null;
    } catch (error) {
        console.error(`Could not fetch user role: ${error.message}`);
        return null;
    }
}

async function changeRank(userId, rankInput, interaction, reason, isDemotion = false) { // Change Rank
    const userHasPermission = interaction.member.roles.cache.some(role =>
        ALLOWED_ROLES.includes(role.name)
    );

    if (!userHasPermission) {
        await interaction.deferReply();
        return interaction.editReply("You do not have permission to use this command. Only specific roles can use this command.");
    }

    if (interaction.replied || interaction.deferred) {
        return;
    }

    await interaction.deferReply();

    const csrfToken = await getCsrfToken();
    if (!csrfToken) {
        return interaction.editReply("Could not obtain CSRF Token.");
    }

    const newRole = await getRoleByInput(rankInput);
    if (!newRole) {
        return interaction.editReply("No valid rank found.");
    }

    let username = "Unknown";
    let currentRoleRank = 0;
    let userIdFinal = userId;

    try {
        const userInfo = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        if (userInfo.data && userInfo.data.name) {
            username = userInfo.data.name;
        }
    } catch (error) {
        console.error(`Could not fetch username: ${error.message}`);
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
        console.error(`Could not fetch current rank: ${error.message}`);
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
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** has been promoted to **${newRole.name}**!`;
            } else if (currentRoleRank > newRole.rank) {
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** has been demoted to **${newRole.name}**!`;
            } else {
                statusMessage = `**${userFullInfo.name} (${userFullInfo.id})** is already at the **${newRole.name}** rank.`;
            }

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('Rank Change')
                .setDescription(statusMessage)
                .addFields(
                    { name: 'Reason', value: reason },
                    { name: 'Performed by:', value: `<@${interaction.user.id}>` }
                )
                .setFooter({ text: 'Provided by @matiasxgod' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            return true;
        } else {
            console.error(`Rank change failed. Status: ${response.status}`);
            return interaction.editReply("Rank change operation failed.");
        }
    } catch (error) {
        console.error(`Error Code: ${error.response?.status || "Unknown"}`);
        return interaction.editReply("An error occurred, operation failed.");
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
        console.error(`Could not fetch user information: ${error.message}`);
        return { name: "Unknown", id: "Unknown" };
    }
}

async function autocompleteRoles(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const roleNames = await getRoleNames();
    const filteredRoles = roleNames.filter(role =>
        role.toLowerCase().includes(focusedOption.value.toLowerCase())
    );

    await interaction.respond(
        filteredRoles.map(role => ({ name: role, value: role }))
    );
}

client.on('interactionCreate', async (interaction) => { // Commands
    if (interaction.isAutocomplete()) {
        if (interaction.commandName === 'rank') {
            const subcommand = interaction.options.getSubcommand();
            if (subcommand === 'set') {
                await autocompleteRoles(interaction);
            }
        }
    }

    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'rank') {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const username = interaction.options.getString('person');
            const rankInput = interaction.options.getString('rank');
            const reason = interaction.options.getString('reason');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`User "${username}" not found.`);
                }
            }

            const success = await changeRank(userId, rankInput, interaction, reason);
            if (!success) {
                return interaction.reply('Rank change operation failed.');
            }
        }

        if (subcommand === 'promote') {
            const username = interaction.options.getString('person');
            const reason = interaction.options.getString('reason');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`User "${username}" not found.`);
                }
            }

            const currentRole = await getUserRole(userId);
            if (!currentRole) {
                return interaction.reply(`Could not fetch role information for user "${username}".`);
            }

            const nextRank = currentRole.rank + 1;
            const success = await changeRank(userId, nextRank, interaction, reason);
            if (!success) {
                return interaction.reply('Rank promotion operation failed.');
            }
        }

        if (subcommand === 'demote') {
            const username = interaction.options.getString('person');
            const reason = interaction.options.getString('reason');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`User "${username}" not found.`);
                }
            }

            const currentRole = await getUserRole(userId);
            if (!currentRole) {
                return interaction.reply(`Could not fetch role information for user "${username}".`);
            }

            const nextRank = currentRole.rank - 1;
            const success = await changeRank(userId, nextRank, interaction, reason, true);
            if (!success) {
                return interaction.reply('Rank demotion operation failed.');
            }
        }

        if (subcommand === 'query') {
            const username = interaction.options.getString('person');

            let userId = username;
            if (isNaN(userId)) {
                userId = await getUserIdFromUsername(username);
                if (!userId) {
                    return interaction.reply(`User "${username}" not found.`);
                }
            }

            const currentRole = await getUserRole(userId);
            if (!currentRole) {
                return interaction.reply(`Could not fetch role information for user "${username}".`);
            }

            const userFullInfo = await getUserFullInfo(userId);

            const embed = new EmbedBuilder()
                .setColor('#00FF00') 
                .setTitle('Rank Query')
                .setDescription(`**${userFullInfo.name} (${userFullInfo.id})**'s rank: **${currentRole.name}**`)
                .setFooter({ text: 'Provided by @matiasxgod' })
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
        console.error(`Could not fetch roles: ${error.message}`);
        return [];
    }
}

client.login(DISCORD_TOKEN);
