console.log("Starting bot...");

try {
    const token = process.env.DISCORD_TOKEN;
    
    if (!token) {
        console.log("ERROR: No DISCORD_TOKEN found in environment variables!");
        console.log("Go to Railway → Variables → Add DISCORD_TOKEN");
        process.exit(1);
    }
    
    console.log("Token found, length:", token.length);
    console.log("Attempting to login...");
    
    const { Client, GatewayIntentBits } = require('discord.js');
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    
    client.once('ready', () => {
        console.log("✅ SUCCESS! Bot is online!");
        console.log(`Bot username: ${client.user.tag}`);
    });
    
    client.on('error', (error) => {
        console.log("❌ Client error:", error.message);
    });
    
    client.login(token).then(() => {
        console.log("Login function completed successfully");
    }).catch(error => {
        console.log("❌ Login failed:", error.message);
    });
    
} catch (error) {
    console.log("❌ Critical error:", error.message);
}