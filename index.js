require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log('✅ Bot is online!');
    console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
    }
    
    if (message.content === '!hello') {
        message.reply(`Hello ${message.author.username}!`);
    }
});

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.log('❌ No token found! Add DISCORD_TOKEN in Railway variables');
    process.exit(1);
}

client.login(token);