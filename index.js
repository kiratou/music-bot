console.log("🎵 Simple Music Bot Starting...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on('ready', () => {
    console.log('✅ Bot is online!');
    client.user.setActivity('!ping', { type: 'PLAYING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        return message.reply('Pong! 🏓');
    }

    if (command === 'play') {
        message.reply('⚠️ Music feature needs packages. Please wait while I fix it...');
    }
});

client.login(token);