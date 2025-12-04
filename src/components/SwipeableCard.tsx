'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'framer-motion';
import { X, Heart, ExternalLink } from 'lucide-react';

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
    article: Article;
    onSwipe: (direction: 'left' | 'right') => void;
    className?: string;
};

export const SwipeableCard = ({ article, onSwipe, className = '' }: Props) => {
    const controls = useAnimation();
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-25, 25]);
    const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

    // Background color indicators
    const rightOpacity = useTransform(x, [0, 150], [0, 1]);
    const leftOpacity = useTransform(x, [-150, 0], [1, 0]);

    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleDragEnd = async (event: any, info: PanInfo) => {
        const offset = info.offset.x;
        const velocity = info.velocity.x;

        if (offset > 100 || velocity > 500) {
            await controls.start({ x: 500, opacity: 0, transition: { duration: 0.2 } });
            onSwipe('right');
        } else if (offset < -100 || velocity < -500) {
            await controls.start({ x: -500, opacity: 0, transition: { duration: 0.2 } });
            onSwipe('left');
        } else {
            controls.start({ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } });
        }
    };

    return (
        <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            style={{ x, rotate, opacity }}
            animate={controls}
            onDragEnd={handleDragEnd}
            className={`absolute top-0 left-0 w-full h-full cursor-grab active:cursor-grabbing ${className}`}
            whileTap={{ scale: 1.02 }}
        >
            <div className="relative w-full h-full bg-[#1e293b] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                {/* Overlay Indicators */}
                <motion.div
                    style={{ opacity: rightOpacity }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent to-red-500/20 z-10 pointer-events-none flex items-center justify-end pr-10"
                >
                    <div className="bg-red-500 text-white p-4 rounded-full shadow-lg transform rotate-12 border-4 border-white">
                        <Heart className="w-12 h-12 fill-current" />
                    </div>
                </motion.div>

                <motion.div
                    style={{ opacity: leftOpacity }}
                    className="absolute inset-0 bg-gradient-to-l from-transparent to-slate-500/20 z-10 pointer-events-none flex items-center justify-start pl-10"
                >
                    <div className="bg-slate-500 text-white p-4 rounded-full shadow-lg transform -rotate-12 border-4 border-white">
                        <X className="w-12 h-12" />
                    </div>
                </motion.div>

                {/* Content */}
                <div className="flex-1 p-8 flex flex-col pointer-events-none">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full font-medium">
                            {article.source?.name || 'Unknown Source'}
                        </span>
                        {article.importance_score && (
                            <span className={`text-xs px-3 py-1 rounded-full font-medium ${article.importance_score >= 80 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'
                                }`}>
                                Score: {article.importance_score}
                            </span>
                        )}
                    </div>

                    <h2 className="text-2xl font-bold text-white mb-6 leading-snug">
                        {article.title}
                    </h2>

                    <p className="text-slate-300 text-base leading-relaxed flex-1 overflow-hidden text-ellipsis">
                        {article.summary}
                    </p>

                    <div className="mt-6 flex flex-wrap gap-2">
                        {article.tags?.slice(0, 3).map((tag, i) => (
                            <span key={i} className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Footer Actions (Clickable) */}
                <div className="p-6 border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-sm pointer-events-auto">
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full py-3 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl transition text-sm font-medium"
                        onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                    >
                        記事を読む <ExternalLink className="w-4 h-4" />
                    </a>
                </div>
            </div>
        </motion.div>
    );
};
