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
    client.user.setActivity('!play', { type: 'LISTENING' });
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

        const songName = args.join(' ');
        if (!songName) {
            return message.reply('❌ Give me a song name!');
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

                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });
                
                queueConstruct.connection = connection;
                playSong(message.guild.id, queueConstruct.s