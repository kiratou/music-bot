console.log("🎵 FIXED MUSIC BOT STARTING...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.log("❌ No token!");
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
    console.log('✅ BOT IS ONLINE!');
    console.log(`Logged in as: ${client.user.tag}`);
    client.user.setActivity('!play shape of you', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'ping') {
        return message.reply('Pong! 🏓');
    }

    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Join a voice channel!');
        }

        const songName = args.join(' ').toLowerCase();
        if (!songName) {
            return message.reply('❌ Type a song name!');
        }

        // DIRECT WORKING VIDEO IDS
        const videoIds = {
            'shape of you': 'JGwWNGJdvx8',
            'never gonna give you up': 'dQw4w9WgXcQ',
            'despacito': 'kJQP7kiw5Fk',
            'believer': '7wtfhZwyrcc'
        };

        const videoId = videoIds[songName];
        
        if (!videoId) {
            return message.reply('❌ Try: shape of you, never gonna give you up, despacito, believer');
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

        try {
            await message.reply('🔍 Connecting...');

            // Join voice channel
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });

            // Get song info
            const songInfo = await ytdl.getInfo(videoUrl);
            
            // Create audio stream
            const stream = ytdl(videoUrl, { 
                filter: 'audioonly',
                quality: 'lowestaudio'
            });
            
            const player = createAudioPlayer();
            const resource = createAudioResource(stream);
            
            player.play(resource);
            connection.subscribe(player);

            message.channel.send(`🎵 Now playing: **${songInfo.videoDetails.title}**`);

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
                message.channel.send('✅ Playback finished');
            });

        } catch (error) {
            console.error(error);
            message.reply('❌ Error playing song');
        }
    }

    if (command === 'stop') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('⏹️ Stopped');
        }
    }
});

client.login(token);