console.log("🚀 Starting Spotify-Powered Music Bot (UNLIMITED SONGS)...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const SpotifyWebApi = require('spotify-web-api-node');
const axios = require('axios');

const token = process.env.DISCORD_TOKEN;
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;

if (!token) {
    console.log("❌ No Discord token found!");
    process.exit(1);
}

// Initialize Spotify API
const spotifyApi = new SpotifyWebApi({
    clientId: spotifyClientId,
    clientSecret: spotifyClientSecret
});

// Get Spotify access token
async function refreshSpotifyToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        spotifyApi.setAccessToken(data.body['access_token']);
        console.log('✅ Spotify API connected - UNLIMITED SONGS!');
        return true;
    } catch (error) {
        console.log('⚠️ Spotify API connection failed, using fallback search');
        return false;
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

// Search Spotify for tracks
async function searchSpotify(query) {
    try {
        const result = await spotifyApi.searchTracks(query, { limit: 5 });
        if (result.body.tracks.items.length > 0) {
            return result.body.tracks.items.map(track => ({
                name: track.name,
                artist: track.artists[0].name,
                album: track.album.name,
                popularity: track.popularity,
                spotifyUrl: track.external_urls.spotify,
                // Create YouTube search query
                youtubeQuery: `${track.artists[0].name} ${track.name} official audio`
            }));
        }
        return [];
    } catch (error) {
        console.error("Spotify search error:", error);
        return [];
    }
}

// Search YouTube (fallback)
async function searchYouTube(query) {
    try {
        // This is a simplified version - in production you'd use YouTube API
        const searchQuery = encodeURIComponent(query);
        const response = await axios.get(`https://www.youtube.com/results?search_query=${searchQuery}`);
        
        // Extract first video ID (simplified - use proper parsing in production)
        const videoId = extractVideoId(response.data);
        
        if (videoId) {
            return {
                title: query,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
        }
        return null;
    } catch (error) {
        console.error("YouTube search error:", error);
        return null;
    }
}

// Simple video ID extractor (you'll need a proper one)
function extractVideoId(html) {
    // This is a placeholder - use a proper YouTube search library
    const match = html.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

client.once('ready', async () => {
    console.log('✅ Bot is online!');
    console.log(`Logged in as: ${client.user.tag}`);
    
    // Connect to Spotify
    await refreshSpotifyToken();
    
    client.user.setActivity('!play [any song]', { type: 'LISTENING' });
    console.log('🎵 UNLIMITED SONGS available!');
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

        const query = args.join(' ');
        if (!query) {
            return message.reply('❌ Please provide a song name!');
        }

        const searchingMsg = await message.reply(`🔍 Searching for **${query}**...`);

        try {
            // Check if it's a direct YouTube URL
            if (query.includes('youtube.com/') || query.includes('youtu.be/')) {
                const songInfo = await ytdl.getInfo(query);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: query
                };
                await addToQueue(message, song, voiceChannel);
                return searchingMsg.edit(`🎵 Added to queue: **${song.title}**`);
            }

            // Search Spotify first
            const spotifyResults = await searchSpotify(query);
            
            if (spotifyResults.length > 0) {
                // Show multiple results
                let resultList = '**Multiple results found:**\n';
                spotifyResults.slice(0, 3).forEach((track, index) => {
                    resultList += `${index + 1}. **${track.name}** by ${track.artist}\n`;
                });
                resultList += `\nType \`!play [number]\` to select`;
                
                // Store results temporarily
                message.client.tempResults = {
                    results: spotifyResults,
                    voiceChannel: voiceChannel,
                    originalMessage: message
                };
                
                return searchingMsg.edit(resultList);
            }

            // If no Spotify results, try YouTube directly
            const youtubeResult = await searchYouTube(query);
            if (youtubeResult) {
                const songInfo = await ytdl.getInfo(youtubeResult.url);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: youtubeResult.url
                };
                await addToQueue(message, song, voiceChannel);
                return searchingMsg.edit(`🎵 **Now playing:** ${song.title}`);
            }

            searchingMsg.edit('❌ No results found!');
        } catch (error) {
            console.error(error);
            searchingMsg.edit('❌ Error playing song!');
        }
    }

    // Handle number selection from search results
    if (command.match(/^[1-3]$/) && message.client.tempResults) {
        const index = parseInt(command) - 1;
        const temp = message.client.tempResults;
        
        if (temp.results[index]) {
            const selected = temp.results[index];
            const searchingMsg = await message.reply(`🔍 Playing **${selected.name}**...`);
            
            // Search YouTube for the selected track
            const youtubeQuery = `${selected.artist} ${selected.name} official audio`;
            const youtubeResult = await searchYouTube(youtubeQuery);
            
            if (youtubeResult) {
                try {
                    const songInfo = await ytdl.getInfo(youtubeResult.url);
                    const song = {
                        title: songInfo.videoDetails.title,
                        url: youtubeResult.url
                    };
                    await addToQueue(message, song, temp.voiceChannel);
                    searchingMsg.edit(`🎵 **Now playing:** ${song.title}`);
                } catch {
                    searchingMsg.edit('❌ Error playing selected song');
                }
            }
            
            delete message.client.tempResults;
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

    if (command === 'pause') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing is playing!');
        serverQueue.player.pause();
        message.reply('⏸️ Paused');
    }

    if (command === 'resume') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing is playing!');
        serverQueue.player.unpause();
        message.reply('▶️ Resumed');
    }

    if (command === 'queue') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || serverQueue.songs.length === 0) {
            return message.reply('📪 Queue is empty!');
        }

        let queueList = '**Current Queue:**\n';
        serverQueue.songs.forEach((song, index) => {
            queueList += `${index + 1}. ${song.title}\n`;
        });
        message.reply(queueList);
    }

    if (command === 'popular') {
        try {
            const result = await spotifyApi.getPlaylistTracks('37i9dQZF1DXcBWIGoYBM5M'); // Today's Top Hits
            let popularList = '**🔥 Today\'s Top Hits:**\n';
            result.body.items.slice(0, 10).forEach((item, index) => {
                const track = item.track;
                popularList += `${index + 1}. **${track.name}** - ${track.artists[0].name}\n`;
            });
            message.reply(popularList);
        } catch {
            message.reply('❌ Could not fetch popular songs');
        }
    }

    if (command === 'help') {
        message.reply(`
**🎵 UNLIMITED SONGS Music Bot**

**Commands:**
!play [song] - Search and play ANY song
!skip - Skip current song
!stop - Stop and leave
!pause - Pause music
!resume - Resume music
!queue - Show queue
!popular - Show today's top hits
!help - Show this message

**Features:**
✅ Search ANY song by name
✅ Spotify integration
✅ UNLIMITED songs
✅ Works like Rythm
✅ Multiple results

**Examples:**
!play shape of you
!play despacito
!play bohemian rhapsody
!play any song you want!
        `);
    }
});

async function addToQueue(message, song, voiceChannel) {
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
            playNext(message.guild.id);
        } catch (err) {
            queue.delete(message.guild.id);
            throw err;
        }
    } else {
        serverQueue.songs.push(song);
        message.channel.send(`✅ **Added to queue:** ${song.title}`);
    }
}

async function playNext(guildId) {
    const serverQueue = queue.get(guildId);

    if (!serverQueue || serverQueue.songs.length === 0) {
        if (serverQueue && serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        queue.delete(guildId);
        return;
    }

    const song = serverQueue.songs[0];

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
            playNext(guildId);
        });

        serverQueue.player.on('error', (error) => {
            console.error(error);
            serverQueue.songs.shift();
            playNext(guildId);
        });

    } catch (error) {
        console.error(error);
        serverQueue.songs.shift();
        playNext(guildId);
    }
}

// Refresh Spotify token every hour
setInterval(refreshSpotifyToken, 3600000);

client.login(token);