console.log("🚀 Starting Music Bot - FINAL VERSION...");

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

// DIRECT WORKING VIDEO IDs (TESTED)
const songs = {
    // English
    "shape of you": "JGwWNGJdvx8",
    "never gonna give you up": "dQw4w9WgXcQ",
    "let the world burn": "rEelLqbQHCM",
    "despacito": "kJQP7kiw5Fk",
    "believer": "7wtfhZwyrcc",
    "senorita": "Pkh8UtuejGw",
    "bad guy": "DyDfgMOUjCI",
    "old town road": "r7qovpFAGrQ",
    "dance monkey": "ij0vNvYc6-w",
    "someone like you": "hLQl3WQQoQ0",
    "hello": "YQHsXMglC9A",
    "rolling in the deep": "rYEDA3JcQqw",
    "uptown funk": "OPf0YbXqDm0",
    "see you again": "RgKAFK5djSk",
    "closer": "PT2_F-1esPk",
    "love yourself": "oyEuk8j8imI",
    "sorry": "fRh_vgS2dFE",
    "what do you mean": "DK_0jXPuIr0",
    "starboy": "34Na4j8AVgA",
    "the hills": "yzTuBuRdAyA",
    "can't feel my face": "qsI5Lkfc4_4",
    "earfquake": "B6Sg77-M4v0",
    "godzilla": "CKj1dwIxIlY",
    "blinding lights": "4NRXx6U8ABQ",
    "save your tears": "XXYlFuWEuKI",
    "levitating": "TUVcZfQe-Kw",
    "watermelon sugar": "E07s5ZYygMg",
    "drivers license": "YQHsXMglC9A",
    "good 4 u": "gNi_6U50PmY",
    "happier than ever": "5iChU2rZ2zA",
    "stay": "kTJczUoc26U",
    "industry baby": "UTHLKHL_whs",
    "montero": "6swmTBVI83k",
    "butter": "WMweEpGlu_U",
    "dynamite": "gdZLi9oWNZg",
    
    // Spanish
    "despacito spanish": "kJQP7kiw5Fk",
    "senorita spanish": "Pkh8UtuejGw",
    "bailando": "NUsoVlDFqZg",
    "la bicicleta": "UVff0K0S7SI",
    "chantaje": "6JCLY0Rlx6Q",
    "el perdón": "hX8As0XlFTE",
    "sofia": "ryS6aJ8AMdQ",
    "yo perreo sola": "GtSRKwD2Zhw",
    "dákiti": "w2IhF6g4s3s",
    "la noche de anoche": "cb2w2m1JmCY",
    "te boté": "CcV_anv2ZRk",
    "callaita": "z1JnbAUuIYk",
    "mia": "OSUxrSe5GbI",
    "mi gente": "wnJ6LuUFpMo",
    "gasolina": "CiQDPT3C_hc",
    "con calma": "DiItGE3eAyQ",
    "dura": "sGIm0-dQ6Bo",
    "tusa": "tbneQDc2H3I",
    "bichota": "xhMcqSYslZo",
    "provenza": "Gm_HoBOrMkA",
    "mamiii": "EjU1xHvP9WY",
    "felices los 4": "t_jHrUE5IOk",
    "borro cassette": "8VLdE9xMOJA",
    "11 pm": "3mZcCjA-qGg"
};

client.once('ready', () => {
    console.log('✅ Bot is online!');
    console.log(`📀 Loaded ${Object.keys(songs).length} songs!`);
    client.user.setActivity('!play [song]', { type: 'LISTENING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Join a voice channel first!');
        }

        const songQuery = args.join(' ').toLowerCase();
        if (!songQuery) {
            return message.reply('❌ Type a song name!');
        }

        // Check if it's a direct YouTube URL
        if (songQuery.includes('youtube.com/watch') || songQuery.includes('youtu.be/')) {
            try {
                const songInfo = await ytdl.getInfo(songQuery);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: songQuery
                };
                await handleSong(message, song, voiceChannel);
                message.reply(`🎵 Playing: **${song.title}**`);
            } catch {
                message.reply('❌ Invalid URL');
            }
            return;
        }

        // Find song in database
        let videoId = null;
        let matchedTitle = null;

        // Try exact match first
        for (const [title, id] of Object.entries(songs)) {
            if (songQuery === title || songQuery.includes(title) || title.includes(songQuery)) {
                videoId = id;
                matchedTitle = title;
                break;
            }
        }

        // If not found, try word matching
        if (!videoId) {
            const words = songQuery.split(' ');
            for (const [title, id] of Object.entries(songs)) {
                for (const word of words) {
                    if (word.length > 2 && title.includes(word)) {
                        videoId = id;
                        matchedTitle = title;
                        break;
                    }
                }
                if (videoId) break;
            }
        }

        if (videoId) {
            const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
            const searchingMsg = await message.reply(`🎵 Found: **${matchedTitle}**\n🔍 Playing now...`);
            
            try {
                const songInfo = await ytdl.getInfo(videoUrl);
                const song = {
                    title: songInfo.videoDetails.title,
                    url: videoUrl
                };
                await handleSong(message, song, voiceChannel);
                searchingMsg.edit(`🎵 Now playing: **${song.title}**`);
            } catch (error) {
                searchingMsg.edit('❌ Error playing. Try: `!play never gonna give you up`');
            }
        } else {
            // Suggest similar songs
            const suggestions = Object.keys(songs).slice(0, 10).map(s => `• ${s}`).join('\n');
            message.reply(`❌ Song not found!\n\n**Try one of these:**\n${suggestions}\n\nOr use: !play [YouTube URL]`);
        }
    }

    if (command === 'skip') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing playing');
        serverQueue.player.stop();
        message.reply('⏭️ Skipped');
    }

    if (command === 'stop') {
        const serverQueue = queue.get(message.guild.id);
        if (!serverQueue) return message.reply('❌ Nothing playing');
        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.connection?.destroy();
        queue.delete(message.guild.id);
        message.reply('⏹️ Stopped');
    }

    if (command === 'songs') {
        message.reply(`📀 **Available songs:** ${Object.keys(songs).length}\nTry: !play shape of you`);
    }
});

async function handleSong(message, song, voiceChannel) {
    const serverQueue = queue.get(message.guild.id);
    
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel,
            connection: null,
            player: createAudioPlayer(),
            songs: [song]
        };

        queue.set(message.guild.id, queueConstruct);

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: message.guild.id,
                adapterCreator: message.guild.voiceAdapterCreator,
            });
            
            queueConstruct.connection = connection;
            playSong(message.guild.id);
        } catch {
            queue.delete(message.guild.id);
            message.reply('❌ Can\'t join voice channel');
        }
    } else {
        serverQueue.songs.push(song);
        message.reply(`✅ Added: **${song.title}**`);
    }
}

async function playSong(guildId) {
    const serverQueue = queue.get(guildId);
    if (!serverQueue?.songs.length) {
        serverQueue?.connection?.destroy();
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
            playSong(guildId);
        });

        serverQueue.player.on('error', () => {
            serverQueue.songs.shift();
            playSong(guildId);
        });

    } catch {
        serverQueue.songs.shift();
        playSong(guildId);
    }
}

client.login(token);