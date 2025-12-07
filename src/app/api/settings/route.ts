import { NextResponse } from 'next/server';
import { createServerSupabase, requireAuth } from '@/lib/getServerUser';

export async function GET() {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const supabase = await createServerSupabase();
        const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('id', `notification_settings_${user!.id}`)
            .single();

        if (error) {
            // If not found, return default
            if (error.code === 'PGRST116') {
                return NextResponse.json({
                    slack_webhook_url: '',
                    min_importance: 80,
                    keywords: []
                });
            }
            throw error;
        }

        return NextResponse.json(data.value);
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { error: authError, user } = await requireAuth();
        if (authError) {
            return NextResponse.json({ error: authError }, { status: 401 });
        }

        const body = await request.json();

        // Validate body
        if (typeof body.min_importance !== 'number' || body.min_importance < 0 || body.min_importance > 100) {
            return NextResponse.json({ error: 'Invalid min_importance' }, { status: 400 });
        }

        const supabase = await createServerSupabase();
        const { error } = await supabase
            .from('settings')
            .upsert({
                id: `notification_settings_${user!.id}`,
                value: body,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving settings:', error);
        return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }
}
