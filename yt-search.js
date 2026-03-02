// Simple YouTube search helper
const ytdl = require('ytdl-core');

async function searchYouTube(query) {
    try {
        const results = await ytdl.search(query, { limit: 1 });
        if (results && results.length > 0) {
            return {
                videoId: results[0].videoId,
                title: results[0].title
            };
        }
        return null;
    } catch (error) {
        console.error("Search error:", error);
        return null;
    }
}

module.exports = { searchYouTube };