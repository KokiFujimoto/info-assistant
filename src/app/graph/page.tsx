'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';
import Link from 'next/link';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default function GraphPage() {
    const [articles, setArticles] = useState<any[]>([]);
    const [topics, setTopics] = useState<any[]>([]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        // Fetch articles (fetch more for graph view)
        const { data: articlesData } = await supabase
            .from('articles')
            .select('id, title, url, summary, published_at, importance_score, sentiment, tags, entities, source:sources(topic_id)')
            .order('published_at', { ascending: false })
            .limit(100); // Fetch more for better visualization

        // Fetch topics
        const { data: topicsData } = await supabase.from('topics').select('*');

        setArticles(articlesData || []);
        setTopics(topicsData || []);
    };

    return (
        <div className="w-screen h-screen bg-[#0b0e14] flex flex-col overflow-hidden">
            {/* Header */}
            <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-[#0b0e14]/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-slate-400 hover:text-white transition flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        ダッシュボードに戻る
                    </Link>
                    <h1 className="text-xl font-bold text-white border-l border-slate-700 pl-4">
                        インテリジェンス・グラフ
                    </h1>
                </div>
                <div className="text-sm text-slate-500">
                    {articles.length} 記事 / {topics.length} トピック
                </div>
            </header>

            {/* Main Content (Full Screen Graph) */}
            <div className="flex-1 relative">
                {/* Override KnowledgeGraph container style to fill parent */}
                <div className="absolute inset-0 [&>div]:!h-full [&>div]:!rounded-none [&>div]:!border-none">
                    <KnowledgeGraph topics={topics} articles={articles} />
                </div>
            </div>
        </div>
    );
}
