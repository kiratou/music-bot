console.log("🚀 TEST BOT STARTING...");
console.log("Current time:", new Date().toString());

// Check environment variables
const token = process.env.DISCORD_TOKEN;
if (token) {
    console.log("✅ DISCORD_TOKEN found!");
    console.log("Token length:", token.length);
    console.log("Token first 5 chars:", token.substring(0, 5) + "...");
} else {
    console.log("❌ DISCORD_TOKEN NOT FOUND!");
    console.log("Please add DISCORD_TOKEN in Railway Variables");
}

const youtubeKey = process.env.YOUTUBE_API_KEY;
if (youtubeKey) {
    console.log("✅ YOUTUBE_API_KEY found!");
} else {
    console.log("❌ YOUTUBE_API_KEY NOT FOUND!");
}

console.log("✅ Test complete!");