console.log("BOT STARTING...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
console.log("Token exists:", token ? "YES" : "NO");

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] 
});

client.once('ready', () => {
    console.log("✅ BOT IS ONLINE!");
});

client.on('messageCreate', (message) => {
    if (message.content === '!test') {
        message.reply('Bot works! 🎉');
    }
});

client.login(token);