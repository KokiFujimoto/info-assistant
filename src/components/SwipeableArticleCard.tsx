'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useTransform, PanInfo } from 'framer-motion';

type Article = {
    id: number;
    title: string;
    summary: string;
    url: string;
    published_at: string;
    importance_score?: number;
    sentiment?: string;
    tags?: string[];
    entities?: { name: string; type: string }[];
};

type Props = {
    article: Article;
    badge: { color: string; label: string; icon: string };
    isRead: boolean;
    isFading: boolean;
    feedbackState?: boolean | null; // null = no feedback, true = interested, false = not interested
    onToggleRead: () => void;
    onFeedback: (isInterested: boolean) => void;
    onTagClick: (tag: string) => void;
    getSentimentIcon: (sentiment: string) => string;
};

export const SwipeableArticleCard = ({
    article,
    badge,
    isRead,
    isFading,
    feedbackState,
    onToggleRead,
    onFeedback,
    onTagClick,
    getSentimentIcon,
}: Props) => {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-10, 10]);
    const leftOpacity = useTransform(x, [-150, -50, 0], [1, 0.5, 0]);
    const rightOpacity = useTransform(x, [0, 50, 150], [0, 0.5, 1]);

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (offset > 100 || velocity > 300) {
            // Swipe right -> interested
            await onFeedback(true);
            x.set(0);
        } else if (offset < -100 || velocity < -300) {
            // Swipe left -> not interested
            await onFeedback(false);
            x.set(0);
        } else {
            x.set(0);
        }
    };

    return (
        <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            style={{ x, rotate }}
            onDragEnd={handleDragEnd}
            className={`relative bg-[#1e293b] border ${article.importance_score && article.importance_score >= 80 ? 'border-red-500/50' : 'border-slate-700/50'
                } rounded-2xl hover:border-indigo-500/50 group ${isRead && !isFading ? 'opacity-85' : ''
                } ${isFading ? 'animate-fadeOut' : 'transition'
                } cursor-grab active:cursor-grabbing`}
            whileTap={{ scale: 0.98 }}
        >
            {/* Swipe indicators */}
            <>
                <motion.div
                    style={{ opacity: leftOpacity }}
                    className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
                >
                    <div className="bg-red-500 text-white p-3 rounded-full shadow-lg">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                </motion.div>

                <motion.div
                    style={{ opacity: rightOpacity }}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
                >
                    <div className="bg-orange-500 text-white p-3 rounded-full shadow-lg">
                        <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
                        </svg>
                    </div>
                </motion.div>
            </>
            <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleRead}
                            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition ${isRead ? 'bg-green-500 border-green-500' : 'border-slate-600 hover:border-indigo-500'
                                }`}
                            title={isRead ? '未読にする' : '既読にする'}
                        >
                            {isRead && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>

                        <span className={`${badge.color} text-white text-xs px-2 py-1 rounded-full font-medium`}>
                            {badge.icon} {badge.label} {article.importance_score || 50}/100
                        </span>
                        {article.sentiment && (
                            <span className="text-xl" title={article.sentiment}>
                                {getSentimentIcon(article.sentiment)}
                            </span>
                        )}

                        {/* Feedback status icon for read articles */}
                        {isRead && feedbackState !== null && feedbackState !== undefined && (
                            <span className="flex items-center gap-1" title={feedbackState ? '興味あり' : '興味なし'}>
                                {feedbackState ? (
                                    <svg className="w-5 h-5 fill-orange-400" viewBox="0 0 24 24">
                                        <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                )}
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-slate-500">
                        {new Date(article.published_at).toLocaleDateString('ja-JP')}
                    </span>
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-white mb-3 group-hover:text-indigo-400 transition">
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
                        {article.title}
                        <svg className="w-4 h-4 opacity-0 group-hover:opacity-100 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </h3>

                {/* Summary */}
                {article.summary && (
                    <p className="text-slate-300 text-sm mb-4 leading-relaxed">
                        {article.summary}
                    </p>
                )}

                {/* Tags and Entities */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {article.tags && article.tags.length > 0 && article.tags.map((tag: string, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => onTagClick(tag)}
                            className="bg-indigo-500/10 text-indigo-300 text-xs px-3 py-1 rounded-full border border-indigo-500/20 hover:bg-indigo-500/20 transition"
                        >
                            #{tag}
                        </button>
                    ))}
                    {article.entities && article.entities.slice(0, 3).map((entity: any, idx: number) => (
                        <button
                            key={idx}
                            onClick={() => onTagClick(entity.name)}
                            className="bg-purple-500/10 text-purple-300 text-xs px-3 py-1 rounded-full border border-purple-500/20 hover:bg-purple-500/20 transition"
                            title={entity.type}
                        >
                            {entity.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Footer with feedback buttons - show for both read and unread */}
            <div className="border-t border-slate-700/50 bg-slate-800/30 px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 text-xs text-slate-500">
                        {!isRead ? 'スワイプまたはボタンで振り分け' : '既読記事の振り分けを変更'}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={async () => {
                                await onFeedback(false);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition group ${feedbackState === false
                                ? 'bg-red-500/20 text-red-300 border border-red-500/50'
                                : 'bg-slate-700/50 hover:bg-red-500/20 text-slate-300 hover:text-red-400'
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span className="text-sm font-medium">興味なし</span>
                        </button>
                        <button
                            onClick={async () => {
                                await onFeedback(true);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition group ${feedbackState === true
                                ? 'bg-orange-500/20 text-orange-300 border border-orange-500/50'
                                : 'bg-slate-700/50 hover:bg-orange-500/20 text-slate-300 hover:text-orange-400'
                                }`}
                        >
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                                <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
                            </svg>
                            <span className="text-sm font-medium">興味あり</span>
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};
