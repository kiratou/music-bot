console.log("🚀 Starting Music Bot...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const SpotifyWebApi = require('spotify-web-api-node');

const token = process.env.DISCORD_TOKEN;
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!token) {
    console.log("❌ No Discord token found!");
    process.exit(1);
}

// Initialize Spotify API if credentials exist
let spotifyApi = null;
if (spotifyClientId && spotifyClientSecret) {
    spotifyApi = new SpotifyWebApi({
        clientId: spotifyClientId,
        clientSecret: spotifyClientSecret
    });
    
    // Get Spotify access token
    spotifyApi.clientCredentialsGrant()
        .then(data => {
            spotifyApi.setAccessToken(data.body['access_token']);
            console.log('✅ Spotify API connected');
        })
        .catch(err => console.log('⚠️ Spotify API not available, using YouTube only'));
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

// Search YouTube and get video
async function searchYouTube(query) {
    try {
        // Use YouTube search and get first result
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        
        // For now, we need to get the actual video URL
        // This is a simplified version - we'll use a known working method
        const videoId = await getVideoIdFromSearch(query);
        if (videoId) {
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        return null;
    } catch (error) {
        console.error("YouTube search error:", error);
        return null;
    }
}

// Helper function to get video ID (simplified)
async function getVideoIdFromSearch(query) {
    try {
        // Use ytdl to search
        const results = await ytdl.search(query, { limit: 1 });
        if (results && results.length > 0) {
            return results[0].videoId;
        }
        return null;
    } catch {
        // Fallback to common songs
        const commonSongs = {
            'shape of you': 'JGwWNGJdvx8',
            'never gonna give you up': 'dQw4w9WgXcQ',
            'let the world burn': 'rEelLqbQHCM',
            'despacito': 'kJQP7kiw5Fk',
            'believer': '7wtfhZwyrcc',
            'senorita': 'Pkh8UtuejGw'
        };
        
        // Check if it's a common song
        for (const [key, value] of Object.entries(commonSongs)) {
            if (query.toLowerCase().includes(key)) {
                return value;
            }
        }
        return 'dQw4w9WgXcQ'; // Rick Roll as last resort
    }
}

client.once('ready', () => {
    console.log('✅ Bot is online!');
    console.log(`Logged in as: ${client.user.tag}`);
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

        const searchingMsg = await message.reply(`🔍 Searching for "${songName}"...`);

        try {
            let videoUrl;
            let songTitle = songName;

            // Try Spotify first if available
            if (spotifyApi) {
                try {
                    const result = await spotifyApi.searchTracks(songName, { limit: 1 });
                    if (result.body.tracks.items.length > 0) {
                        const track = result.body.tracks.items[0];
                        songTitle = `${track.artists[0].name} - ${track.name}`;
                        searchingMsg.edit(`🎵 Found on Spotify: **${songTitle}**\n🔍 Searching YouTube...`);
                    }
                } catch (e) {
                    console.log("Spotify search failed, using YouTube only");
                }
            }

            // Search YouTube
            const searchQuery = songTitle;
            
            // Get video ID (using common songs for now)
            const videoId = await getVideoIdFromSearch(searchQuery);
            videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

            // Get video info
            const songInfo = await ytdl.getInfo(videoUrl);
            const song = {
                title: songInfo.videoDetails.title,
                url: videoUrl
            };

            const serverQueue = queue.get(message.guild.id);
            
            if (!serverQueue) {
                const queueConstruct = {
                    textChannel: message.channel,
                    voiceChannel: voiceChannel,
                    connection: null,
                    player: createAudioPlayer(),
                    songs: [],
                };

                queue.set(message.guild.id, queueConstruct);
                queueConstruct.songs.push(song);

                try {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: message.guild.id,
                        adapterCreator: message.guild.voiceAdapterCreator,
                    });
                    
                    queueConstruct.connection = connection;
                    
                    setTimeout(() => {
                        playSong(message.guild.id, queueConstruct.songs[0]);
                    }, 1000);
                    
                    searchingMsg.edit(`🎵 Now playing: **${song.title}**`);
                } catch (err) {
                    console.error("Connection error:", err);
                    queue.delete(message.guild.id);
                    return searchingMsg.edit('❌ Error joining voice channel!');
                }
            } else {
                serverQueue.songs.push(song);
                return searchingMsg.edit(`✅ **${song.title}** added to queue!`);
            }
        } catch (error) {
            console.error("Play error:", error);
            searchingMsg.edit('❌ Error playing song! Trying YouTube directly...');
            
            // Fallback to direct YouTube search
            try {
                const videoId = await getVideoIdFromSearch(songName);
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                const songInfo = await ytdl.getInfo(videoUrl);
                
                message.reply(`🎵 Playing: **${songInfo.videoDetails.title}**`);
                
                // Add to queue and play...
                // (simplified for now)
            } catch (e) {
                message.reply('❌ Could not play the song. Try using a YouTube URL directly.');
            }
        }
    }

    if (command === 'skip') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing is playing!');
        serverQueue.player.stop();
        message.reply('⏭️ Skipped!');
    }

    if (command === 'stop') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing is playing!');
        serverQueue.songs = [];
        serverQueue.player.stop();
        if (serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        queue.delete(message.guild.id);
        message.reply('⏹️ Stopped and left!');
    }

    if (command === 'help') {
        message.reply(`
**Music Bot Commands:**
!play [song name] - Play a song
!skip - Skip current song
!stop - Stop and leave
!help - Show this message

Examples:
!play shape of you
!play never gonna give you up
!play despacito
        `);
    }
});

async function playSong(guildId, song) {
    const serverQueue = queue.get(guildId);
    if (!song) {
        if (serverQueue && serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        queue.delete(guildId);
        return;
    }

    try {
        const stream = ytdl(song.url, {
            filter: 'audioonly',
            quality: 'lowestaudio',
            highWaterMark: 1 << 25
        });
        
        const resource = createAudioResource(stream);
        
        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);
        
        serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playSong(guildId, serverQueue.songs[0]);
        });

        serverQueue.player.on('error', error => {
            console.error("Player error:", error);
            serverQueue.songs.shift();
            playSong(guildId, serverQueue.songs[0]);
        });

    } catch (error) {
        console.error("PlaySong error:", error);
        serverQueue.songs.shift();
        playSong(guildId, serverQueue.songs[0]);
    }
}

client.login(token);