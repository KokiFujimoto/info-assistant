'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/auth';

type Topic = {
    id: number;
    keyword: string;
    is_active: boolean;
    created_at: string;
};

type Source = {
    id: number;
    topic_id: number;
    name: string;
    url: string;
    type: string;
};

type SuggestedSource = {
    name: string;
    url: string;
    description: string;
    type: 'rss' | 'web';
};

function TopicsPageContent() {
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const [topics, setTopics] = useState<Topic[]>([]);
    const [sources, setSources] = useState<Source[]>([]);
    const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
    const [newTopicKeyword, setNewTopicKeyword] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isAddingTopic, setIsAddingTopic] = useState(false);
    const [isAddingSource, setIsAddingSource] = useState(false);
    const [suggestedSources, setSuggestedSources] = useState<SuggestedSource[]>([]);
    const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user]);

    const fetchData = async () => {
        if (!user) return;

        try {
            // Fetch topics for this user directly from Supabase
            const { data: topicsData, error: topicsError } = await supabase
                .from('topics')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (topicsError) {
                console.error('Error fetching topics:', topicsError);
            } else {
                setTopics(topicsData || []);

                // Check if there's a topic ID in the URL
                const topicIdParam = searchParams.get('id');
                if (topicIdParam) {
                    const topicId = parseInt(topicIdParam);
                    if (topicsData && topicsData.find((t: Topic) => t.id === topicId)) {
                        setSelectedTopicId(topicId);
                    } else if (topicsData && topicsData.length > 0) {
                        setSelectedTopicId(topicsData[0].id);
                    }
                } else if (topicsData && topicsData.length > 0) {
                    setSelectedTopicId(topicsData[0].id);
                }
            }

            // Get user's topic IDs
            const userTopicIds = topicsData?.map(t => t.id) || [];

            // Fetch sources for user's topics
            if (userTopicIds.length > 0) {
                const { data: sourcesData, error: sourcesError } = await supabase
                    .from('sources')
                    .select('*')
                    .in('topic_id', userTopicIds);

                if (sourcesError) {
                    console.error('Error fetching sources:', sourcesError);
                } else {
                    setSources(sourcesData || []);
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddTopic = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTopicKeyword.trim() || !user) return;

        setIsAddingTopic(true);
        try {
            // Insert topic directly to Supabase
            const { data: topic, error } = await supabase
                .from('topics')
                .insert({ keyword: newTopicKeyword, user_id: user.id })
                .select()
                .single();

            if (error) {
                console.error('Error adding topic:', error);
                alert('追加に失敗しました。');
            } else {
                setTopics([topic, ...topics]);
                setNewTopicKeyword('');
                setSelectedTopicId(topic.id);

                // Trigger AI source discovery via API
                fetch('/api/topics/discover-sources', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ topicId: topic.id, keyword: newTopicKeyword }),
                }).catch(console.error);
            }
        } catch (error) {
            console.error('Error adding topic:', error);
        } finally {
            setIsAddingTopic(false);
        }
    };

    const handleToggleTopic = async (id: number, currentState: boolean) => {
        try {
            const { error } = await supabase
                .from('topics')
                .update({ is_active: !currentState })
                .eq('id', id);

            if (error) {
                console.error('Error toggling topic:', error);
                alert('更新に失敗しました。');
            } else {
                setTopics(topics.map(t => t.id === id ? { ...t, is_active: !currentState } : t));
            }
        } catch (error) {
            console.error('Error toggling topic:', error);
        }
    };

    const handleDeleteTopic = async (id: number) => {
        if (!confirm('このトピックを削除しますか？関連する情報源も削除されます。')) return;

        try {
            const { error } = await supabase
                .from('topics')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting topic:', error);
                alert('削除に失敗しました。');
            } else {
                setTopics(topics.filter(t => t.id !== id));
                setSources(sources.filter(s => s.topic_id !== id));
                if (selectedTopicId === id) {
                    setSelectedTopicId(topics[0]?.id || null);
                }
            }
        } catch (error) {
            console.error('Error deleting topic:', error);
        }
    };

    const handleAddSource = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedTopicId || !newSourceUrl) return;

        setIsAddingSource(true);
        try {
            const { data: source, error } = await supabase
                .from('sources')
                .insert({
                    topic_id: selectedTopicId,
                    url: newSourceUrl,
                    name: new URL(newSourceUrl).hostname,
                    type: newSourceUrl.includes('/feed') || newSourceUrl.includes('/rss') ? 'rss' : 'web'
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding source:', error);
                alert('追加に失敗しました。');
            } else {
                setSources([...sources, source]);
                setNewSourceUrl('');
            }
        } catch (error) {
            console.error('Error adding source:', error);
        } finally {
            setIsAddingSource(false);
        }
    };

    const handleDeleteSource = async (id: number) => {
        if (!confirm('この情報源を削除しますか？')) return;

        try {
            const { error } = await supabase
                .from('sources')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting source:', error);
                alert('削除に失敗しました。');
            } else {
                setSources(sources.filter(s => s.id !== id));
            }
        } catch (error) {
            console.error('Error deleting source:', error);
        }
    };

    const handleFetchSuggestions = async () => {
        if (!selectedTopicId) return;

        setIsFetchingSuggestions(true);
        try {
            const res = await fetch(`/api/topics/${selectedTopicId}/suggest-sources`, { credentials: 'include' });
            if (res.ok) {
                const { suggestions } = await res.json();
                setSuggestedSources(suggestions || []);
                setShowSuggestions(true);
            } else {
                alert('提案の取得に失敗しました。');
            }
        } catch (error) {
            console.error('Error fetching suggestions:', error);
        } finally {
            setIsFetchingSuggestions(false);
        }
    };

    const handleAddSuggestedSource = async (suggestion: SuggestedSource) => {
        if (!selectedTopicId) return;

        try {
            const { data: source, error } = await supabase
                .from('sources')
                .insert({
                    topic_id: selectedTopicId,
                    url: suggestion.url,
                    name: suggestion.name,
                    type: suggestion.type
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding source:', error);
                alert('追加に失敗しました。');
            } else {
                setSources([...sources, source]);
                setSuggestedSources(suggestedSources.filter(s => s.url !== suggestion.url));
            }
        } catch (error) {
            console.error('Error adding suggested source:', error);
        }
    };

    const selectedTopic = topics.find(t => t.id === selectedTopicId);
    const filteredSources = sources.filter(s => s.topic_id === selectedTopicId);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-10">
                <h1 className="text-3xl font-bold text-white mb-2">トピック管理</h1>
                <p className="text-slate-400">関心のあるトピックと情報源を設定して、AIが自動でニュースを収集します。</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left: Topic List */}
                <div className="lg:col-span-1 space-y-4">
                    <h2 className="text-lg font-semibold text-white mb-4">トピック一覧</h2>

                    {/* Add Topic Form */}
                    <form onSubmit={handleAddTopic} className="space-y-2 mb-6">
                        <input
                            type="text"
                            value={newTopicKeyword}
                            onChange={(e) => setNewTopicKeyword(e.target.value)}
                            placeholder="新しいトピック"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                            type="submit"
                            disabled={isAddingTopic}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isAddingTopic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            追加
                        </button>
                    </form>

                    {/* Topic List */}
                    <div className="space-y-2">
                        {topics.map(topic => (
                            <div key={topic.id} className="group">
                                <button
                                    onClick={() => setSelectedTopicId(topic.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg transition flex items-center justify-between ${selectedTopicId === topic.id
                                        ? 'bg-teal-600 text-white'
                                        : topic.is_active
                                            ? 'bg-[#1e293b] text-slate-300 hover:bg-slate-800'
                                            : 'bg-slate-900/50 text-slate-500 hover:bg-slate-800/50'
                                        }`}
                                >
                                    <span className={!topic.is_active ? 'line-through' : ''}>{topic.keyword}</span>
                                    {!topic.is_active && <span className="text-xs opacity-60">無効</span>}
                                </button>
                            </div>
                        ))}
                        {topics.length === 0 && (
                            <div className="text-center text-slate-600 text-sm py-4">
                                トピックがありません
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Topic Details & Sources */}
                <div className="lg:col-span-3">
                    {selectedTopic ? (
                        <div className="space-y-6">
                            {/* Topic Header */}
                            <div className="bg-[#1e293b] border-2 border-teal-600 rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-2xl font-bold text-white">{selectedTopic.keyword}</h2>
                                    <div className="flex items-center gap-3">
                                        {/* Toggle Switch */}
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <span className="text-sm text-slate-400">
                                                {selectedTopic.is_active ? '情報収集中' : '停止中'}
                                            </span>
                                            <div
                                                onClick={() => handleToggleTopic(selectedTopic.id, selectedTopic.is_active)}
                                                className={`relative w-12 h-6 rounded-full transition ${selectedTopic.is_active ? 'bg-teal-600' : 'bg-slate-700'
                                                    }`}
                                            >
                                                <div
                                                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${selectedTopic.is_active ? 'translate-x-6' : ''
                                                        }`}
                                                />
                                            </div>
                                        </label>
                                        <button
                                            onClick={() => handleDeleteTopic(selectedTopic.id)}
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition"
                                            title="削除"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-sm text-slate-500">
                                    作成日: {new Date(selectedTopic.created_at).toLocaleDateString('ja-JP')}
                                </p>
                            </div>

                            {/* Sources Section */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">情報源</h3>

                                {/* Add Source Form */}
                                <form onSubmit={handleAddSource} className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-4 mb-4">
                                    <div className="flex gap-3">
                                        <input
                                            type="url"
                                            value={newSourceUrl}
                                            onChange={(e) => setNewSourceUrl(e.target.value)}
                                            placeholder="URLを入力 (例: https://example.com/feed)"
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500"
                                            required
                                        />
                                        <button
                                            type="submit"
                                            disabled={isAddingSource}
                                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {isAddingSource ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                                            追加
                                        </button>
                                    </div>
                                </form>

                                {/* Suggest Sources Button */}
                                <button
                                    onClick={handleFetchSuggestions}
                                    disabled={isFetchingSuggestions}
                                    className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-4 py-3 rounded-xl font-medium transition flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
                                >
                                    {isFetchingSuggestions ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            AI が提案を生成中...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5 h-5" />
                                            おすすめの情報源を表示
                                        </>
                                    )}
                                </button>

                                {/* Suggested Sources */}
                                {showSuggestions && suggestedSources.length > 0 && (
                                    <div className="bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border border-purple-500/30 rounded-xl p-4 mb-4">
                                        <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            AI が提案する情報源
                                        </h4>
                                        <div className="space-y-2">
                                            {suggestedSources.map((suggestion, idx) => (
                                                <div key={idx} className="bg-[#1e293b] border border-purple-500/20 rounded-lg p-3 flex items-center justify-between hover:border-purple-500/40 transition">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h5 className="font-medium text-white text-sm">{suggestion.name}</h5>
                                                            <span className={`text-xs px-2 py-0.5 rounded ${suggestion.type === 'rss' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                                {suggestion.type === 'rss' ? 'RSS' : 'WEB'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-slate-400 mb-1">{suggestion.description}</p>
                                                        <a href={suggestion.url} target="_blank" rel="noopener noreferrer" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                                                            {suggestion.url} <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                    <button
                                                        onClick={() => handleAddSuggestedSource(suggestion)}
                                                        className="ml-3 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        追加
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Source List */}
                                <div className="space-y-3">
                                    {filteredSources.length === 0 ? (
                                        <div className="text-center py-8 text-slate-500 bg-[#1e293b] rounded-xl border border-slate-700/50">
                                            このトピックには情報源が登録されていません。
                                        </div>
                                    ) : (
                                        filteredSources.map(source => (
                                            <div key={source.id} className="bg-[#1e293b] border border-slate-700/50 rounded-xl p-4 flex items-center justify-between group hover:border-indigo-500/30 transition">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${source.type === 'rss' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
                                                        }`}>
                                                        {source.type === 'rss' ? 'RSS' : 'WEB'}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-medium text-white">{source.name || 'No Name'}</h4>
                                                        <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 hover:text-indigo-400 flex items-center gap-1">
                                                            {source.url} <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteSource(source.id)}
                                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition opacity-0 group-hover:opacity-100"
                                                    title="削除"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-500 bg-[#1e293b] rounded-xl border border-slate-700/50">
                            左側からトピックを選択してください
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function TopicsPage() {
    return (
        <ProtectedRoute>
            <Suspense fallback={
                <div className="p-8 max-w-7xl mx-auto">
                    <div className="flex items-center justify-center min-h-[50vh]">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                    </div>
                </div>
            }>
                <TopicsPageContent />
            </Suspense>
        </ProtectedRoute>
    );
}
