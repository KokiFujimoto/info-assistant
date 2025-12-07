import { NextResponse } from 'next/server';
import { createServerSupabase, requireAuth } from '@/lib/getServerUser';

export async function GET(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const topicId = searchParams.get('topicId');

        const supabase = await createServerSupabase();

        // Get sources for user's topics only
        let query = supabase
            .from('sources')
            .select('*, topics!inner(keyword, user_id)')
            .eq('topics.user_id', user!.id);

        if (topicId) {
            query = query.eq('topic_id', topicId);
        }

        const { data: sources, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Failed to fetch sources', details: error }, { status: 500 });
        }

        return NextResponse.json({ sources });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const { topicId, url, name, type } = await request.json();

        if (!topicId || !url) {
            return NextResponse.json({ error: 'Topic ID and URL are required' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // Verify topic belongs to user
        const { data: topic, error: topicError } = await supabase
            .from('topics')
            .select('id')
            .eq('id', topicId)
            .eq('user_id', user!.id)
            .single();

        if (topicError || !topic) {
            return NextResponse.json({ error: 'Topic not found or access denied' }, { status: 403 });
        }

        let finalUrl = url;
        let finalType = type || 'website';
        let finalName = name;

        // Auto-discover RSS if type is website
        if (finalType === 'website') {
            try {
                const res = await fetch(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                });
                const html = await res.text();

                // Simple regex to find RSS/Atom links
                const rssMatch = html.match(/<link[^>]+type=["']application\/(rss\+xml|atom\+xml)["'][^>]+href=["']([^"']+)["']/i);

                if (rssMatch && rssMatch[2]) {
                    let foundRssUrl = rssMatch[2];
                    // Handle relative URLs
                    if (foundRssUrl.startsWith('/')) {
                        const u = new URL(url);
                        foundRssUrl = `${u.protocol}//${u.host}${foundRssUrl}`;
                    } else if (!foundRssUrl.startsWith('http')) {
                        const u = new URL(url);
                        foundRssUrl = `${u.protocol}//${u.host}/${foundRssUrl}`;
                    }

                    console.log(`Auto-discovered RSS: ${foundRssUrl} from ${url}`);
                    finalUrl = foundRssUrl;
                    finalType = 'rss';
                }

                // Try to get title if name is missing
                if (!finalName) {
                    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
                    if (titleMatch && titleMatch[1]) {
                        finalName = titleMatch[1].trim();
                    }
                }

            } catch (e) {
                console.log('Error during RSS discovery:', e);
            }
        }

        const { data: source, error } = await supabase
            .from('sources')
            .insert({
                topic_id: topicId,
                url: finalUrl,
                name: finalName || new URL(finalUrl).hostname,
                type: finalType,
                reliability_score: 100
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: 'Failed to add source', details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true, source });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
