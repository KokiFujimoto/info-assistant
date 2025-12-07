import { NextResponse } from 'next/server';
import { createServerSupabase, requireAuth } from '@/lib/getServerUser';

export async function POST(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const { articleId, isInterested } = await request.json();

        if (!articleId || typeof isInterested !== 'boolean') {
            return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // Save feedback with user_id
        const { error } = await supabase
            .from('article_feedback')
            .insert({
                article_id: articleId,
                is_interested: isInterested,
                user_id: user!.id
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
