console.log("🎵 Music Bot Starting...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.log("❌ No token found!");
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

client.on('ready', () => {
    console.log('✅ Bot is online!');
    console.log(`Logged in as: ${client.user.tag}`);
    client.user.setActivity('!play [song]', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Test command
    if (command === 'ping') {
        return message.reply('Pong! 🏓');
    }

    // Play command
    if (command === 'play') {
        // Check if user is in voice channel
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ You need to be in a voice channel!');
        }

        const songName = args.join(' ');
        if (!songName) {
            return message.reply('❌ Please provide a song name!');
        }

        const searchingMsg = await message.reply(`🔍 Searching for **${songName}**...`);

        try {
            let videoUrl = songName;
            
            // If it's not a URL, use a direct working video for testing
            if (!songName.includes('youtube.com') && !songName.includes('youtu.be')) {
                // Use a working video ID based on song name
                const workingVideos = {
                    'shape of you': 'JGwWNGJdvx8',
                    'never gonna give you up': 'dQw4w9WgXcQ',
                    'despacito': 'kJQP7kiw5Fk',
                    'believer': '7wtfhZwyrcc',
                    'senorita': 'Pkh8UtuejGw'
                };
                
                const videoId = workingVideos[songName.toLowerCase()];
                if (videoId) {
                    videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                } else {
                    return searchingMsg.edit('❌ Song not found. Try: shape of you, never gonna give you up, despacito, believer');
                }
            }

            // Get song info
            const songInfo = await ytdl.getInfo(videoUrl);
            const song = {
                title: songInfo.videoDetails.title,
                url: videoUrl
            };

            // Join voice channel
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            // Create audio player
            const player = createAudioPlayer();
            
            // Create audio stream
            const stream = ytdl(song.url, { 
                filter: 'audioonly',
                quality: 'lowestaudio',
                highWaterMark: 1 << 25
            });
            
            const resource = createAudioResource(stream);
            
            // Play the song
            player.play(resource);
            connection.subscribe(player);

            // Update message
            await searchingMsg.edit(`🎵 Now playing: **${song.title}**`);

            // When song ends
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
                message.channel.send('⏹️ Song ended');
            });

            // Handle errors
            player.on('error', error => {
                console.error('Player error:', error);
                connection.destroy();
                message.channel.send('❌ Error playing song');
            });

        } catch (error) {
            console.error('Play error:', error);
            searchingMsg.edit('❌ Error playing song. Make sure you have the required packages installed.');
        }
    }

    // Stop command
    if (command === 'stop') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('⏹️ Stopped playing');
        } else {
            message.reply('❌ Not playing anything');
        }
    }

    // Help command
    if (command === 'help') {
        message.reply(`
**Music Bot Commands:**
!ping - Test if bot works
!play [song] - Play a song
!stop - Stop playing
!help - Show this menu

**Working songs:**
• shape of you
• never gonna give you up
• despacito
• believer
• senorita
        `);
    }
});

client.login(token);