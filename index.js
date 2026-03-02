console.log("🚀 Starting Music Bot with YouTube Search...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const token = process.env.DISCORD_TOKEN;
const youtubeKey = process.env.YOUTUBE_API_KEY;

if (!token) {
    console.log("❌ No Discord token found!");
    process.exit(1);
}

if (!youtubeKey) {
    console.log("❌ No YouTube API key found!");
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

const queue = new Map();

// Function to search YouTube using API
async function searchYouTube(query) {
    try {
        const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(query)}&key=${youtubeKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.items && data.items.length > 0) {
            const videoId = data.items[0].id.videoId;
            return `https://www.youtube.com/watch?v=${videoId}`;
        }
        return null;
    } catch (error) {
        console.error("YouTube search error:", error);
        return null;
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

    // Play command
    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ You need to be in a voice channel!');
        }

        const songName = args.join(' ');
        if (!songName) {
            return message.reply('❌ Please provide a song name!');
        }

        // Show searching message
        const searchingMsg = await message.reply(`🔍 Searching for "${songName}"...`);

        try {
            // Search for the video
            let videoUrl;
            
            // Check if it's already a URL
            if (songName.includes('youtube.com') || songName.includes('youtu.be')) {
                videoUrl = songName;
            } else {
                // Search using YouTube API
                videoUrl = await searchYouTube(songName);
                if (!videoUrl) {
                    return searchingMsg.edit('❌ No results found!');
                }
            }

            // Get video info
            const songInfo = await ytdl.getInfo(videoUrl, {
                requestOptions: {
                    headers: {
                        cookie: 'YSC=wBQ9qX8qY6w; PREF=f1=50000000&gl=US&hl=en',
                        'x-youtube-identity-token': 'QUFFLUhqbWg2bjFtYkJ1Z1lXdkJxQ1JjZ2FvNnN0Z0J1Zz0='
                    }
                }
            });
            
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
                    
                    // Small delay to ensure connection is ready
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
            searchingMsg.edit('❌ Error playing song! Try again with a different song.');
        }
    }

    // Skip command
    if (command === 'skip') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing is playing!');
        serverQueue.player.stop();
        message.reply('⏭️ Skipped!');
    }

    // Stop command
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

    // Queue command
    if (command === 'queue') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue || serverQueue.songs.length === 0) {
            return message.reply('❌ Queue is empty!');
        }

        let queueList = '**Queue:**\n';
        serverQueue.songs.forEach((song, index) => {
            queueList += `${index + 1}. ${song.title}\n`;
        });
        message.reply(queueList);
    }

    // Help command
    if (command === 'help') {
        message.reply(`
**Music Bot Commands:**
!play [song name] - Play a song
!skip - Skip current song
!stop - Stop and leave
!queue - Show queue
!help - Show this message

Examples:
!play shape of you
!play never gonna give you up
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
        // Create stream with more compatible options
        const stream = ytdl(song.url, {
            filter: 'audioonly',
            quality: 'lowestaudio',
            highWaterMark: 1 << 25,
            requestOptions: {
                headers: {
                    cookie: 'YSC=wBQ9qX8qY6w; PREF=f1=50000000&gl=US&hl=en',
                    'x-youtube-identity-token': 'QUFFLUhqbWg2bjFtYkJ1Z1lXdkJxQ1JjZ2FvNnN0Z0J1Zz0='
                }
            }
        });
        
        const resource = createAudioResource(stream);
        
        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);
        
        serverQueue.player.on(AudioPlayerStatus.Playing, () => {
            console.log(`Playing: ${song.title}`);
        });

        serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            console.log("Song ended, playing next...");
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