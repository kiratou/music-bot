console.log("🎵 Music Bot Starting...");

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

const queue = new Map();

// Simple song database
const songs = {
    "shape of you": "JGwWNGJdvx8",
    "never gonna give you up": "dQw4w9WgXcQ",
    "despacito": "kJQP7kiw5Fk",
    "believer": "7wtfhZwyrcc"
};

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

        const videoId = songs[songName];
        
        if (videoId) {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            try {
                const songInfo = await ytdl.getInfo(videoUrl);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: videoUrl
                };

                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                const player = createAudioPlayer();
                const stream = ytdl(song.url, { filter: 'audioonly' });
                const resource = createAudioResource(stream);
                
                player.play(resource);
                connection.subscribe(player);

                message.reply(`🎵 Playing: **${song.title}**`);

                player.on(AudioPlayerStatus.Idle, () => {
                    connection.destroy();
                });

            } catch (error) {
                message.reply('❌ Error playing song');
            }
        } else {
            message.reply('❌ Try: shape of you, never gonna give you up, despacito, believer');
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