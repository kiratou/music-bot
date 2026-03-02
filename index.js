require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const queue = new Map();

client.once('ready', () => {
    console.log('✅ Bot is online!');
    client.user.setActivity('!play [song]', { type: 'LISTENING' });
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
            return message.reply('❌ Please provide a song name or URL!');
        }

        try {
            const songInfo = await ytdl.getInfo(songName);
            const song = {
                title: songInfo.videoDetails.title,
                url: songInfo.videoDetails.video_url
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
                    playSong(message.guild.id, queueConstruct.songs[0]);
                    
                    message.reply(`🎵 Playing: **${song.title}**`);
                } catch (err) {
                    queue.delete(message.guild.id);
                    return message.reply('❌ Error joining voice channel!');
                }
            } else {
                serverQueue.songs.push(song);
                return message.reply(`✅ **${song.title}** added to queue!`);
            }
        } catch (error) {
            message.reply('❌ Error playing song! Make sure it\'s a valid YouTube URL');
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
        serverQueue.connection.destroy();
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
!play [song] - Play a song
!skip - Skip current song
!stop - Stop and leave
!queue - Show queue
!help - Show this message
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
            quality: 'lowestaudio'
        });
        const resource = createAudioResource(stream);
        
        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);
        
        serverQueue.player.on(AudioPlayerStatus.Playing, () => {
            serverQueue.textChannel.send(`🎵 Now playing: **${song.title}**`);
        });

        serverQueue.player.on(AudioPlayerStatus.Idle, () => {
            serverQueue.songs.shift();
            playSong(guildId, serverQueue.songs[0]);
        });

        serverQueue.player.on('error', error => {
            console.error(error);
            serverQueue.songs.shift();
            playSong(guildId, serverQueue.songs[0]);
        });

    } catch (error) {
        console.error(error);
        serverQueue.songs.shift();
        playSong(guildId, serverQueue.songs[0]);
    }
}

// Login with token
const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.log('❌ No token provided! Add DISCORD_TOKEN in Railway variables');
    process.exit(1);
}

client.login(token);