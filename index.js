console.log("🚀 STARTING BOT...");
console.log("Time: " + new Date().toString());

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const token = process.env.DISCORD_TOKEN;
console.log("Token exists:", token ? "✅ YES" : "❌ NO");

if (!token) {
    console.log("❌ FATAL: No Discord token found!");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.once('ready', () => {
    console.log("✅ BOT IS ONLINE!");
    console.log(`Logged in as: ${client.user.tag}`);
});

client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
        message.reply('Pong! 🏓');
        console.log("Ping command used");
    }
});

client.login(token)
    .then(() => console.log("✅ Login successful"))
    .catch(err => console.log("❌ Login error:", err.message));

console.log("✅ Bot code loaded, waiting for events...");