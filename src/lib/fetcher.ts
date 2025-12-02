import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
});

export type FetchedArticle = {
    title: string;
    url: string;
    content: string;
    publishedAt: Date;
};

export async function fetchFeed(url: string): Promise<FetchedArticle[]> {
    try {
        const feed = await parser.parseURL(url);
        return feed.items.map(item => ({
            title: item.title || 'No Title',
            url: item.link || '',
            content: item.contentSnippet || item.content || '',
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        }));
    } catch (error) {
        console.error(`Error fetching feed ${url}:`, error);
        return [];
    }
}

export async function fetchWebPage(url: string): Promise<FetchedArticle | null> {
    try {
        const res = await fetch(url);
        const html = await res.text();
        const $ = cheerio.load(html);

        // Simple extraction - can be improved
        const title = $('title').first().text();
        const content = $('article').text() || $('main').text() || $('body').text();

        return {
            title,
            url,
            content: content.replace(/\s+/g, ' ').trim().substring(0, 5000), // Truncate
            publishedAt: new Date(),
        };
    } catch (error) {
        console.error(`Error fetching page ${url}:`, error);
        return null;
    }
}
