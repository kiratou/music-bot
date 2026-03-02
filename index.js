console.log("🚀 Simple Music Bot Starting...");

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

// Simple song database (TESTED WORKING URLs)
const songs = {
    "shape of you": "JGwWNGJdvx8",
    "never gonna give you up": "dQw4w9WgXcQ",
    "despacito": "kJQP7kiw5Fk",
    "believer": "7wtfhZwyrcc",
    "senorita": "Pkh8UtuejGw"
};

client.once('ready', () => {
    console.log('✅ Bot is online!');
    client.user.setActivity('!play shape of you', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Join a voice channel!');
        }

        const songName = args.join(' ').toLowerCase();
        if (!songName) {
            return message.reply('❌ Type a song name!');
        }

        // Find song
        const videoId = songs[songName];
        
        if (videoId) {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            try {
                const songInfo = await ytdl.getInfo(videoUrl);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: videoUrl
                };

                // Create queue
                const serverQueue = {
                    textChannel: message.channel,
                    voiceChannel: voiceChannel,
                    connection: null,
                    player: createAudioPlayer(),
                    songs: [song]
                };

                queue.set(message.guild.id, serverQueue);

                // Join voice channel
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                serverQueue.connection = connection;

                // Play song
                const stream = ytdl(song.url, { filter: 'audioonly' });
                const resource = createAudioResource(stream);
                
                serverQueue.player.play(resource);
                connection.subscribe(serverQueue.player);

                message.reply(`🎵 Playing: **${song.title}**`);

                serverQueue.player.on(AudioPlayerStatus.Idle, () => {
                    queue.delete(message.guild.id);
                    connection.destroy();
                });

            } catch (error) {
                message.reply('❌ Error playing song');
            }
        } else {
            message.reply('❌ Song not found. Try: shape of you, never gonna give you up, despacito, believer, senorita');
        }
    }

    if (command === 'stop') {
        const serverQueue = queue.get(message.guild.id);
        if (serverQueue) {
            serverQueue.player.stop();
            serverQueue.connection.destroy();
            queue.delete(message.guild.id);
            message.reply('⏹️ Stopped');
        }
    }
});

client.login(token);