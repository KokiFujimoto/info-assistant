import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchFeed, fetchWebPage } from '@/lib/fetcher';
import { analyzeArticle } from '@/lib/gemini';
import { sendSlackNotification } from '@/lib/slack';
import { isScrapingAllowed } from '@/lib/robots';
import { shouldSkipArticle } from '@/lib/recommendation';

// Allow this to run for up to 5 minutes on Vercel Pro (or default 10s on Hobby, so be careful)
export const maxDuration = 300;

export async function GET(request: Request) {
    // In production, verify a secret token to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // 1. Get all active sources
        const { data: sources, error: sourceError } = await supabase
            .from('sources')
            .select('*');

        if (sourceError || !sources) {
            return NextResponse.json({ error: 'Failed to fetch sources' }, { status: 500 });
        }

        let processedCount = 0;

        // 2. Process each source
        const logs: string[] = [`Found ${sources?.length} sources`];

        for (const source of sources) {
            let articles: any[] = [];
            logs.push(`Processing source: ${source.url} (${source.type})`);

            try {
                // Check robots.txt
                const allowed = await isScrapingAllowed(source.url, 'InfoAssistantBot');
                if (!allowed) {
                    logs.push(`Skipping ${source.url}: Disallowed by robots.txt`);
                    continue;
                }

                if (source.type === 'rss') {
                    articles = await fetchFeed(source.url);
                } else {
                    const article = await fetchWebPage(source.url);
                    if (article) articles = [article];
                }
                logs.push(`Fetched ${articles.length} articles from ${source.url}`);
            } catch (e) {
                logs.push(`Error fetching ${source.url}: ${e}`);
                continue;
            }

            // 3. Process each article
            for (const item of articles) {
                // Check if exists
                const { data: existing } = await supabase
                    .from('articles')
                    .select('id')
                    .eq('url', item.url)
                    .single();

                if (!existing) {
                    // New article found!
                    logs.push(`New article found: ${item.title}`);

                    // ...

                    // Comprehensive AI Analysis
                    const analysis = await analyzeArticle(item.title, item.content);

                    // Check recommendation engine
                    const recommendation = await shouldSkipArticle(item.title, analysis.summary, analysis.embedding);

                    if (recommendation.skip) {
                        logs.push(`Skipping article based on feedback: ${item.title} (${recommendation.reason})`);
                        // Option 1: Skip entirely
                        // continue; 

                        // Option 2: Save but mark as very low importance (so it doesn't show up prominently but is recorded)
                        analysis.importance_score = 10;
                        analysis.tags.push('Auto-Filtered');
                    }

                    // Save with all analysis fields
                    const { data: savedArticle, error: saveError } = await supabase.from('articles').insert({
                        source_id: source.id,
                        title: item.title,
                        url: item.url, // Assuming item.url is correct, not item.link as in diff
                        content: item.content.substring(0, 20000), // Limit storage for compliance
                        summary: analysis.summary,
                        published_at: item.publishedAt, // Assuming item.publishedAt is correct, not pubDate as in diff
                        importance_score: analysis.importance_score,
                        entities: analysis.entities,
                        sentiment: analysis.sentiment,
                        tags: analysis.tags,
                        embedding: analysis.embedding
                    })
                        .select('*, source:sources(name)') // Select source name for notification
                        .single();

                    if (saveError) {
                        console.error(`Failed to save article: ${item.title}`, saveError);
                        logs.push(`Error saving article ${item.title}: ${JSON.stringify(saveError)}`);
                        continue; // Continue to next article if save fails
                    } else {
                        processedCount++;
                        logs.push(`Saved with importance=${analysis.importance_score}, entities=${analysis.entities.length}`);
                        // Send Notification
                        await sendSlackNotification(savedArticle);
                    }
                } else {
                    // logs.push(`Article already exists: ${item.title}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            processed: processedCount,
            logs: logs
        });

    } catch (error) {
        console.error('Cron Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error }, { status: 500 });
    }
}
