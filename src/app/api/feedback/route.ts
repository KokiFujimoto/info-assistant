import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { articleId, isInterested } = await request.json();

        if (!articleId || typeof isInterested !== 'boolean') {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        // Save feedback
        const { error } = await supabase
            .from('article_feedback')
            .insert({
                article_id: articleId,
                is_interested: isInterested
            });

        if (error) {
            console.error('Error saving feedback:', error);
            return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Feedback API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
