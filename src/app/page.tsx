'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { KnowledgeGraph } from '@/components/KnowledgeGraph';
import { AutoRefresher } from '@/components/AutoRefresher';
import { FeedbackMode } from '@/components/FeedbackMode';
import { SwipeableArticleCard } from '@/components/SwipeableArticleCard';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

function getImportanceBadge(score: number) {
  if (score >= 80) return { color: 'bg-red-500', label: '重要', icon: '🔥' };
  if (score >= 60) return { color: 'bg-orange-500', label: '注目', icon: '⚡' };
  if (score >= 40) return { color: 'bg-blue-500', label: '通常', icon: '📰' };
  return { color: 'bg-gray-500', label: '低', icon: '📄' };
}

function getSentimentIcon(sentiment: string) {
  if (sentiment === 'positive') return '😊';
  if (sentiment === 'negative') return '😟';
  return '😐';
}

export default function Home() {
  const [articles, setArticles] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [readArticles, setReadArticles] = useState<Set<number>>(new Set());
  const [fadingOut, setFadingOut] = useState<Set<number>>(new Set()); // Articles being faded out
  const [filterMode, setFilterMode] = useState<'unread' | 'read' | 'all'>('unread');
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'importance' | 'date'>('importance'); // Default to importance
  const [selectedTag, setSelectedTag] = useState<string | null>(null); // Tag or Entity filter
  const [isFeedbackMode, setIsFeedbackMode] = useState(false);
  const [articleFeedback, setArticleFeedback] = useState<Map<number, boolean>>(new Map()); // articleId -> isInterested

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch articles
    const { data: articlesData } = await supabase
      .from('articles')
      .select('id, title, url, summary, published_at, importance_score, sentiment, tags, entities, source:sources(topic_id)')
      .order('published_at', { ascending: false });

    // Fetch topics
    const { data: topicsData } = await supabase.from('topics').select('*');

    // Fetch read status
    const { data: readStatus } = await supabase.from('article_read_status').select('article_id');

    // Fetch feedback
    const { data: feedbackData } = await supabase.from('article_feedback').select('article_id, is_interested').order('created_at', { ascending: false });

    // Create map of article_id to latest feedback
    const feedbackMap = new Map<number, boolean>();
    feedbackData?.forEach((fb: any) => {
      if (!feedbackMap.has(fb.article_id)) {
        feedbackMap.set(fb.article_id, fb.is_interested);
      }
    });

    setArticles(articlesData || []);
    setTopics(topicsData || []);
    setReadArticles(new Set(readStatus?.map((r: any) => r.article_id) || []));
    setArticleFeedback(feedbackMap);
  };

  const toggleReadStatus = async (articleId: number) => {
    const isRead = readArticles.has(articleId);

    if (isRead) {
      // Mark as unread
      await fetch(`/api/read-status?articleId=${articleId}`, { method: 'DELETE' });
      setReadArticles(prev => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    } else {
      // Mark as read
      // 1. Mark as fading out (triggers CSS animation)
      setFadingOut(prev => new Set(prev).add(articleId));

      // 2. Update read status (shows checkmark)
      setReadArticles(prev => new Set(prev).add(articleId));

      // 3. API call
      await fetch('/api/read-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId })
      });

      // 4. Wait for animation (0.7s for smooth fade)
      await new Promise(resolve => setTimeout(resolve, 700));

      // 5. Remove from fading state (will be filtered out of unread view)
      setFadingOut(prev => {
        const next = new Set(prev);
        next.delete(articleId);
        return next;
      });
    }
  };

  // Filter and sort articles
  let filteredArticles = articles.filter(article => {
    // Keep fading articles visible during animation
    if (fadingOut.has(article.id) && filterMode === 'unread') return true;

    // 1. Read/Unread Filter
    if (filterMode === 'unread' && readArticles.has(article.id)) return false;
    if (filterMode === 'read' && !readArticles.has(article.id)) return false;

    // 2. Tag/Entity Filter
    if (selectedTag) {
      const hasTag = article.tags?.includes(selectedTag);
      const hasEntity = article.entities?.some((e: any) => e.name === selectedTag);
      if (!hasTag && !hasEntity) return false;
    }

    return true;
  });

  // Sort by importance (desc) then date (desc), or date (desc) then importance (desc)
  if (sortBy === 'importance') {
    filteredArticles = filteredArticles.sort((a, b) => {
      const importanceDiff = (b.importance_score || 50) - (a.importance_score || 50);
      if (importanceDiff !== 0) return importanceDiff;
      return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
    });
  } else {
    filteredArticles = filteredArticles.sort((a, b) => {
      const dateDiff = new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.importance_score || 50) - (a.importance_score || 50);
    });
  }

  // Pagination
  const totalPages = Math.ceil(filteredArticles.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedArticles = filteredArticles.slice(startIndex, startIndex + pageSize);

  const stats = {
    total: articles.length,
    unread: articles.length - readArticles.size,
    read: readArticles.size,
    important: articles.filter(a => a.importance_score >= 80).length
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterMode, pageSize, sortBy]);

  const handleFeedback = async (articleId: number, isInterested: boolean) => {
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, isInterested })
      });

      // Update feedback state immediately for visual feedback
      setArticleFeedback(prev => {
        const newMap = new Map(prev);
        newMap.set(articleId, isInterested);
        return newMap;
      });

      // Mark as read to clear from queue
      if (!readArticles.has(articleId)) {
        toggleReadStatus(articleId);
      }
    } catch (error) {
      console.error('Error sending feedback:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      <AutoRefresher />
      <div className="p-6">
        {/* Header */}
        <header className="mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">こんにちは、Userさん</h1>
            <p className="text-slate-400">最新のインテリジェンスフィードをチェックしましょう。</p>
          </div>
        </header>

        {/* Topic Overview */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">追跡中のトピック</h2>
            <a href="/topics" className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              管理
            </a>
          </div>
          {topics && topics.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic: any) => (
                <a
                  key={topic.id}
                  href={`/topics?id=${topic.id}`}
                  className={`block p-4 rounded-xl border transition ${topic.is_active !== false
                    ? 'bg-[#1e293b] border-slate-700/50 hover:border-indigo-500/50'
                    : 'bg-slate-900/50 border-slate-800/50 opacity-60'
                    }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-white">{topic.keyword}</h3>
                    {topic.is_active === false && (
                      <span className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded">無効</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {stats.total > 0 ? `${articles.filter((a: any) => a.source?.topic_id === topic.id).length} 件の記事` : '記事を収集中...'}
                  </p>
                </a>
              ))}
            </div>
          ) : (
            <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">トピックが未設定です</h3>
              <p className="text-slate-400 mb-4">関心のあるトピックを追加して、AIが自動でニュースを収集します。</p>
              <a href="/topics" className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2 rounded-lg font-medium transition">
                トピックを追加
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
              </a>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Feed */}
          <div className="lg:col-span-2 space-y-6">
            {/* Active Filter Display */}
            {selectedTag && (
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm text-slate-400">フィルタ中:</span>
                <button
                  onClick={() => setSelectedTag(null)}
                  className="flex items-center gap-1 bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm hover:bg-indigo-500/30 transition group"
                >
                  #{selectedTag}
                  <svg className="w-4 h-4 opacity-60 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-semibold text-white">フィード</h2>
                <div className="flex items-center gap-2 bg-[#1e293b] rounded-lg p-1">
                  <button
                    onClick={() => setFilterMode('unread')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${filterMode === 'unread' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    未読 ({stats.unread})
                  </button>
                  <button
                    onClick={() => setFilterMode('read')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${filterMode === 'read' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    既読 ({stats.read})
                  </button>
                  <button
                    onClick={() => setFilterMode('all')}
                    className={`px-4 py-2 rounded text-sm font-medium transition ${filterMode === 'all' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                  >
                    すべて ({stats.total})
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {/* Sort selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">並び順:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'importance' | 'date')}
                    className="bg-[#1e293b] text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value="importance">重要度順</option>
                    <option value="date">新着順</option>
                  </select>
                </div>

                {/* Page size selector */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400">表示件数:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-[#1e293b] text-white border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  >
                    <option value={10}>10件</option>
                    <option value={15}>15件</option>
                    <option value={20}>20件</option>
                    <option value={50}>50件</option>
                  </select>
                </div>
              </div>
            </div>

            {paginatedArticles.length === 0 ? (
              <div className="text-center py-20 bg-[#1e293b] rounded-2xl border border-slate-700/50">
                <p className="text-slate-400 mb-4">
                  {filterMode === 'unread' && '未読記事がありません。'}
                  {filterMode === 'read' && '既読記事がありません。'}
                  {filterMode === 'all' && '記事がつかめていません。トピックを追加してみてください！'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {paginatedArticles.map((article: any) => {
                    const badge = getImportanceBadge(article.importance_score || 50);
                    const isRead = readArticles.has(article.id);
                    const isFading = fadingOut.has(article.id);
                    const feedbackState = articleFeedback.has(article.id) ? articleFeedback.get(article.id) : null;

                    return (
                      <SwipeableArticleCard
                        key={article.id}
                        article={article}
                        badge={badge}
                        isRead={isRead}
                        isFading={isFading}
                        feedbackState={feedbackState ?? null}
                        onToggleRead={() => toggleReadStatus(article.id)}
                        onFeedback={(isInterested) => handleFeedback(article.id, isInterested)}
                        onTagClick={setSelectedTag}
                        getSentimentIcon={getSentimentIcon}
                      />
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-700">
                    <div className="text-sm text-slate-400">
                      {startIndex + 1} - {Math.min(startIndex + pageSize, filteredArticles.length)} / {filteredArticles.length}件
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 bg-[#1e293b] text-white rounded-lg disabled:opacity-30 hover:bg-slate-800 transition"
                      >
                        前へ
                      </button>
                      <span className="text-sm text-slate-400">
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 bg-[#1e293b] text-white rounded-lg disabled:opacity-30 hover:bg-slate-800 transition"
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Stats & Graph */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-[#1e293b] border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                </div>
                <div>
                  <div className="text-xl font-bold">{stats.total}</div>
                  <div className="text-xs text-slate-400">記事総数</div>
                </div>
              </div>
              <div className="bg-[#1e293b] border border-indigo-500/30 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                  <div className="text-xl font-bold">{stats.unread}</div>
                  <div className="text-xs text-slate-400">未読記事</div>
                </div>
              </div>
              <div className="bg-[#1e293b] border border-red-500/30 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                </div>
                <div>
                  <div className="text-xl font-bold">{stats.important}</div>
                  <div className="text-xs text-slate-400">重要記事</div>
                </div>
              </div>
            </div>

            {/* Graph */}
            <div>
              <KnowledgeGraph topics={topics || []} articles={articles || []} />
              <div className="mt-2 text-right">
                <a href="/graph" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-end gap-1 transition">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
                  全画面で見る
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
