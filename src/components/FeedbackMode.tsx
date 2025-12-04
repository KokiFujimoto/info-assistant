'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SwipeableCard } from './SwipeableCard';
import { X, Heart, RotateCcw, CheckCircle } from 'lucide-react';

type Article = {
    id: number;
    title: string;
    summary: string;
    url: string;
    source?: {
        name: string;
    };
    tags?: string[];
    importance_score?: number;
};

type Props = {
    articles: Article[];
    onClose: () => void;
    onFeedback: (articleId: number, isInterested: boolean) => void;
};

export const FeedbackMode = ({ articles: initialArticles, onClose, onFeedback }: Props) => {
    const [articles, setArticles] = useState<Article[]>(initialArticles);
    const [history, setHistory] = useState<{ id: number, isInterested: boolean }[]>([]);

    // Only show top 3 cards for performance
    const visibleArticles = articles.slice(0, 3);

    const handleSwipe = (direction: 'left' | 'right') => {
        if (articles.length === 0) return;

        const currentArticle = articles[0];
        const isInterested = direction === 'right';

        // Optimistic update
        setHistory(prev => [...prev, { id: currentArticle.id, isInterested }]);
        setArticles(prev => prev.slice(1));

        // Call parent handler
        onFeedback(currentArticle.id, isInterested);
    };

    const handleUndo = () => {
        // Not implemented in this version as it requires complex state management with parent
        // But UI placeholder is good
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-sm p-4">
            <div className="w-full max-w-md relative h-[600px] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="text-white">
                        <h2 className="text-xl font-bold">記事の振り分け</h2>
                        <p className="text-slate-400 text-sm">残り {articles.length} 件</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Card Stack */}
                <div className="relative flex-1 w-full">
                    <AnimatePresence>
                        {visibleArticles.map((article, index) => (
                            <SwipeableCard
                                key={article.id}
                                article={article}
                                onSwipe={handleSwipe}
                                className={index === 0 ? 'z-30' : index === 1 ? 'z-20 transform scale-95 translate-y-4 opacity-50' : 'z-10 transform scale-90 translate-y-8 opacity-20'}
                            />
                        ))}
                    </AnimatePresence>

                    {articles.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                            <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-6">
                                <CheckCircle className="w-10 h-10" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">完了！</h3>
                            <p className="text-slate-400 mb-8">すべての記事を振り分けました。</p>
                            <button
                                onClick={onClose}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-xl font-medium transition"
                            >
                                ダッシュボードに戻る
                            </button>
                        </div>
                    )}
                </div>

                {/* Controls */}
                {articles.length > 0 && (
                    <div className="mt-8 flex items-center justify-center gap-6">
                        <button
                            onClick={() => handleSwipe('left')}
                            className="w-14 h-14 bg-[#1e293b] border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-500 hover:bg-red-500/10 transition shadow-lg"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="text-slate-500 text-sm font-medium">
                            スワイプで選択
                        </div>

                        <button
                            onClick={() => handleSwipe('right')}
                            className="w-14 h-14 bg-[#1e293b] border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-green-500 hover:border-green-500 hover:bg-green-500/10 transition shadow-lg"
                        >
                            <Heart className="w-6 h-6 fill-current" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
