console.log("🚀 Starting Spotify Music Bot...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const SpotifyWebApi = require('spotify-web-api-node');

const token = process.env.DISCORD_TOKEN;
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!token || !spotifyClientId || !spotifyClientSecret) {
    console.log("❌ Missing credentials!");
    process.exit(1);
}

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret
});

// Get Spotify access token
async function getSpotifyToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('✅ Spotify API connected');
    } catch (error) {
        console.error('❌ Spotify API error:', error);
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const queue = new Map();

// Search Spotify and get track info
async function searchSpotify(query) {
    try {
        const result = await spotifyApi.searchTracks(query, { limit: 1 });
        if (result.body.tracks.items.length > 0) {
            const track = result.body.tracks.items[0];
            return {
                title: `${track.artists[0].name} - ${track.name}`,
                artist: track.artists[0].name,
                songName: track.name,
                spotifyUrl: track.external_urls.spotify
            };
        }
        return null;
    } catch (error) {
        console.error("Spotify search error:", error);
        return null;
    }
}

// Search YouTube as fallback
async function searchYouTube(query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        return { youtubeUrl: searchUrl };
    } catch (error) {
        return null;
    }
}

client.once('ready', async () => {
    console.log('✅ Bot is online!');
    console.log(`Logged in as: ${client.user.tag}`);
    await getSpotifyToken();
    client.user.setActivity('!play [song name]', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ You need to be in a voice channel!');
        }

        const songName = args.join(' ');
        if (!songName) {
            return message.reply('❌ Please provide a song name!');
        }

        const searchingMsg = await message.reply(`🔍 Searching for "${songName}" on Spotify...`);

        try {
            // Search Spotify
            const spotifyResult = await searchSpotify(songName);
            
            if (spotifyResult) {
                // Search YouTube with Spotify info
                const youtubeQuery = `${spotifyResult.artist} - ${spotifyResult.songName} audio`;
                searchingMsg.edit(`🎵 Found: **${spotifyResult.title}**\n🔍 Searching YouTube...`);
                
                // For now, we'll use a note about Spotify
                searchingMsg.edit(`🎵 Found on Spotify: **${spotifyResult.title}**\n⚠️ Playing YouTube version (Spotify requires premium for playback)`);
                
                // Search YouTube
                const searchQuery = `${spotifyResult.artist} ${spotifyResult.songName} official audio`;
                const youtubeSearch = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
                
                // You'll need to implement YouTube playback here
                message.reply(`Found: ${spotifyResult.title}\nYouTube search: ${youtubeSearch}`);
            } else {
                searchingMsg.edit('❌ Song not found on Spotify');
            }
        } catch (error) {
            console.error("Play error:", error);
            searchingMsg.edit('❌ Error playing song!');
        }
    }

    if (command === 'help') {
        message.reply(`
**Spotify Music Bot:**
!play [song] - Search Spotify and play
!skip - Skip song
!stop - Stop and leave
!queue - Show queue
        `);
    }
});

client.login(token);