import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function addZennSource() {
    // Create a topic for 'Tech' if not exists
    let { data: topic } = await supabase.from('topics').select('id').eq('keyword', 'Tech').single();

    if (!topic) {
        const { data: newTopic } = await supabase.from('topics').insert({ keyword: 'Tech' }).select().single();
        topic = newTopic;
    }

    if (!topic) {
        console.error('Failed to get or create topic');
        return;
    }

    // Insert Zenn RSS
    const { error } = await supabase.from('sources').insert({
        topic_id: topic.id,
        url: 'https://zenn.dev/feed',
        name: 'Zenn',
        type: 'rss',
        reliability_score: 100
    });

    if (error) console.error('Error adding source:', error);
    else console.log('Zenn source added successfully');
}

addZennSource();
