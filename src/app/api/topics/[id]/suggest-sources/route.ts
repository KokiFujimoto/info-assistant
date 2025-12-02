import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { suggestRSSFeeds } from '@/lib/gemini';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const topicId = parseInt(id);

        // Fetch the topic to get the keyword
        const { data: topic, error } = await supabase
            .from('topics')
            .select('keyword')
            .eq('id', topicId)
            .single();

        if (error || !topic) {
            return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
        }

        // Get RSS feed suggestions from AI
        const suggestions = await suggestRSSFeeds(topic.keyword);

        return NextResponse.json({ suggestions });
    } catch (error) {
        console.error('Suggest Sources Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
