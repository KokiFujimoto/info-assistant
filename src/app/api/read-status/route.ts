import { NextResponse } from 'next/server';
import { createServerSupabase, requireAuth } from '@/lib/getServerUser';

export async function POST(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const { articleId } = await request.json();

        if (!articleId) {
            return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        // Insert or update read status with user_id
        const { error } = await supabase
            .from('article_read_status')
            .upsert({
                article_id: articleId,
                read_at: new Date().toISOString(),
                user_id: user!.id
            }, { onConflict: 'article_id,user_id' });

        if (error) {
            return NextResponse.json({ error: 'Failed to mark as read', details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const articleId = searchParams.get('articleId');

        if (!articleId) {
            return NextResponse.json({ error: 'Article ID is required' }, { status: 400 });
        }

        const supabase = await createServerSupabase();

        const { error } = await supabase
            .from('article_read_status')
            .delete()
            .eq('article_id', articleId)
            .eq('user_id', user!.id);

        if (error) {
            return NextResponse.json({ error: 'Failed to mark as unread', details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
