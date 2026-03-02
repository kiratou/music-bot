console.log("🚀 Starting Music Bot...");

require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('ytdl-core');

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.log("❌ No Discord token found!");
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

// DATABASE OF COMMON SONGS (PRE-TESTED WORKING URLs)
const songDatabase = {
    "shape of you": "https://www.youtube.com/watch?v=JGwWNGJdvx8",
    "never gonna give you up": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "let the world burn": "https://www.youtube.com/watch?v=rEelLqbQHCM",
    "despacito": "https://www.youtube.com/watch?v=kJQP7kiw5Fk",
    "believer": "https://www.youtube.com/watch?v=7wtfhZwyrcc",
    "senorita": "https://www.youtube.com/watch?v=Pkh8UtuejGw",
    "bad guy": "https://www.youtube.com/watch?v=DyDfgMOUjCI",
    "old town road": "https://www.youtube.com/watch?v=r7qovpFAGrQ",
    "dance monkey": "https://www.youtube.com/watch?v=ij0vNvYc6-w",
    "someone like you": "https://www.youtube.com/watch?v=hLQl3WQQoQ0",
    "hello": "https://www.youtube.com/watch?v=YQHsXMglC9A",
    "rolling in the deep": "https://www.youtube.com/watch?v=rYEDA3JcQqw",
    "uptown funk": "https://www.youtube.com/watch?v=OPf0YbXqDm0",
    "see you again": "https://www.youtube.com/watch?v=RgKAFK5djSk",
    "closer": "https://www.youtube.com/watch?v=PT2_F-1esPk",
    "love yourself": "https://www.youtube.com/watch?v=oyEuk8j8imI",
    "sorry": "https://www.youtube.com/watch?v=fRh_vgS2dFE",
    "what do you mean": "https://www.youtube.com/watch?v=DK_0jXPuIr0",
    "starboy": "https://www.youtube.com/watch?v=34Na4j8AVgA",
    "the hills": "https://www.youtube.com/watch?v=yzTuBuRdAyA",
    "can't feel my face": "https://www.youtube.com/watch?v=qsI5Lkfc4_4",
    "earfquake": "https://www.youtube.com/watch?v=B6Sg77-M4v0",
    "godzilla": "https://www.youtube.com/watch?v=CKj1dwIxIlY"
};

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

        const songName = args.join(' ').toLowerCase();
        if (!songName) {
            return message.reply('❌ Please provide a song name!');
        }

        // Check if it's already a URL
        if (songName.includes('youtube.com') || songName.includes('youtu.be')) {
            // Handle URL directly
            try {
                const songInfo = await ytdl.getInfo(songName);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: songName
                };
                await playSong(message, song, voiceChannel);
            } catch (error) {
                message.reply('❌ Invalid YouTube URL');
            }
            return;
        }

        // Check database for the song
        let foundUrl = null;
        let foundTitle = songName;

        // Look for exact match or partial match
        for (const [key, url] of Object.entries(songDatabase)) {
            if (songName.includes(key) || key.includes(songName)) {
                foundUrl = url;
                foundTitle = key;
                break;
            }
        }

        if (foundUrl) {
            // Found in database
            const searchingMsg = await message.reply(`🎵 Found: **${foundTitle}**\n🔍 Preparing to play...`);
            
            try {
                const songInfo = await ytdl.getInfo(foundUrl);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: foundUrl
                };
                await playSong(message, song, voiceChannel);
                searchingMsg.edit(`🎵 Now playing: **${song.title}**`);
            } catch (error) {
                searchingMsg.edit('❌ Error playing the song. Trying another source...');
                
                // Try with a direct search as fallback
                try {
                    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`;
                    message.reply(`⚠️ Please use this link: ${searchUrl}\nThen use !play with the URL`);
                } catch (e) {
                    message.reply('❌ Could not play the song');
                }
            }
        } else {
            // Not in database, give search link
            const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(songName)}`;
            message.reply(`🔍 Couldn't find "${songName}" in my database.\n🔗 Search here: ${searchUrl}\nThen use **!play [YouTube URL]**`);
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

    if (command === 'help') {
        message.reply(`
**Music Bot Commands:**
!play [song name] - Play a song
!play [YouTube URL] - Play from URL
!skip - Skip current song
!stop - Stop and leave
!queue - Show queue
!help - Show this message

**Popular songs in database:**
${Object.keys(songDatabase).slice(0, 10).map(s => `• ${s}`).join('\n')}
        `);
    }
});

async function playSong(message, song, voiceChannel) {
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
                playNext(message.guild.id);
            }, 1000);
            
        } catch (err) {
            console.error("Connection error:", err);
            queue.delete(message.guild.id);
            throw err;
        }
    } else {
        serverQueue.songs.push(song);
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
            console.error("Player error:", error);
            serverQueue.songs.shift();
            playNext(guildId);
        });

    } catch (error) {
        console.error("Play error:", error);
        serverQueue.songs.shift();
        playNext(guildId);
    }
}

client.login(token);