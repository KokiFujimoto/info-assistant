import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServerSupabase, requireAuth } from '@/lib/getServerUser';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET() {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const supabase = await createServerSupabase();
        const { data: topics, error } = await supabase
            .from('topics')
            .select('*')
            .eq('user_id', user!.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching topics:', error);
            return NextResponse.json({ error: 'Failed to fetch topics', details: error }, { status: 500 });
        }

        return NextResponse.json({ topics });
    } catch (error) {
        console.error('Server Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const { keyword } = await request.json();

        if (!keyword) {
            return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // 1. Save Topic with user_id
        const { data: topic, error: topicError } = await supabase
            .from('topics')
            .insert({ keyword, user_id: user!.id })
            .select()
            .single();

        if (topicError) {
            console.error('Topic Error:', topicError);
            return NextResponse.json({ error: 'Failed to save topic', details: topicError }, { status: 500 });
        }

        // 2. AI Agent: Discover Sources
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-001' });
        const prompt = `
      User wants to track: "${keyword}".
      Suggest 5 reliable RSS feeds or website URLs to track this topic.
      Prioritize RSS feeds over plain websites.
      Return ONLY a JSON array of objects with "url", "name", and "type" (rss or website).
      Example: [{"url": "https://example.com/feed", "name": "Example Tech", "type": "rss"}]
    `;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const candidates = JSON.parse(jsonStr);

            // 3. Validate & Save Sources
            const validSources = [];

            for (const candidate of candidates) {
                try {
                    const res = await fetch(candidate.url, {
                        method: 'HEAD',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        }
                    });

                    if (res.ok || res.status === 405) {
                        validSources.push({
                            topic_id: topic.id,
                            url: candidate.url,
                            name: candidate.name,
                            type: candidate.type,
                            reliability_score: 80
                        });
                    }
                } catch (e) {
                    console.log(`Validation failed for ${candidate.url}:`, e);
                }

                if (validSources.length >= 3) break;
            }

            if (validSources.length > 0) {
                await supabase.from('sources').insert(validSources);
            } else {
                console.warn('No valid sources found for topic:', keyword);

                // Fallback: Use Google News RSS
                const googleNewsUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ja&gl=JP&ceid=JP:ja`;

                console.log('Using fallback source:', googleNewsUrl);

                await supabase.from('sources').insert({
                    topic_id: topic.id,
                    url: googleNewsUrl,
                    name: 'Google News',
                    type: 'rss',
                    reliability_score: 90
                });
            }

        } catch (aiError) {
            console.error('AI Error:', aiError);
        }

        return NextResponse.json({ success: true, topic });

    } catch (error) {
        console.error('Server Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
