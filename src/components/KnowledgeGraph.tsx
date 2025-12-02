'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { forceCollide } from 'd3-force';

import { generateGraphData, COLORS, Node, Link } from './graphUtils';

// Dynamically import to avoid SSR issues with canvas
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

export function KnowledgeGraph({ topics, articles, className = "h-[600px]" }: { topics: any[], articles: any[], className?: string }) {
    const [width, setWidth] = useState(800);
    const [height, setHeight] = useState(600);
    const containerRef = useRef<HTMLDivElement>(null);
    const fgRef = useRef<any>(null);

    // Controls state
    const [showControls, setShowControls] = useState(false);
    const [filters, setFilters] = useState({
        articles: true,
        topics: true,
        entities: true
    });
    const [physics, setPhysics] = useState({
        charge: -80, // Stronger repulsion to spread clusters
        linkDistance: 60 // Slightly longer distance
    });

    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.clientWidth);
            setHeight(containerRef.current.clientHeight);
        }

        // Resize observer
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                setWidth(entry.contentRect.width);
                setHeight(entry.contentRect.height);
            }
        });

        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    // Update physics when controls change
    useEffect(() => {
        if (fgRef.current) {
            fgRef.current.d3Force('charge').strength(physics.charge);
            fgRef.current.d3Force('link').distance(physics.linkDistance);

            // Add collision force to prevent entity nodes from overlapping
            // This keeps entity circles separated while allowing articles to cluster
            fgRef.current.d3Force('collide', forceCollide()
                .radius((node: any) => {
                    // Apply collision only to entity nodes (sets)
                    if (node.isEntitySet) {
                        return node.val * 0.4; // Allow significant overlap but prevent total collapse
                    }
                    return 0; // No collision for articles
                })
                .strength(0.7) // Moderate strength to allow some flexibility
            );

            fgRef.current.d3ReheatSimulation();
        }
    }, [physics]);

    // Generate Graph Data
    const data = useMemo(() => {
        return generateGraphData(topics, articles, filters, physics.linkDistance);
    }, [topics, articles, filters, physics.linkDistance]);

    return (
        <div ref={containerRef} className={`w-full ${className} bg-[#0b0e14] rounded-2xl border border-slate-800 overflow-hidden shadow-2xl relative group`}>

            {/* Header / Title */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="text-slate-200 font-medium text-sm bg-black/50 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                    Knowledge Graph
                </h3>
            </div>

            {/* Controls Toggle */}
            <button
                onClick={() => setShowControls(!showControls)}
                className="absolute top-4 right-4 z-50 p-2 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 rounded-lg backdrop-blur-md transition border border-white/10"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>

            {/* Control Panel */}
            {showControls && (
                <div className="absolute top-16 right-4 z-50 w-64 bg-[#1a1d24]/90 backdrop-blur-xl border border-slate-700/50 rounded-xl p-4 shadow-2xl text-xs text-slate-300 animate-fadeIn">
                    <div className="space-y-4">
                        {/* Filters */}
                        <div>
                            <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                                フィルタ
                            </h4>
                            <div className="space-y-2">
                                <label className="flex items-center justify-between cursor-pointer hover:text-white transition">
                                    <span>トピック</span>
                                    <input type="checkbox" checked={filters.topics} onChange={e => setFilters({ ...filters, topics: e.target.checked })} className="accent-indigo-500" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer hover:text-white transition">
                                    <span>記事</span>
                                    <input type="checkbox" checked={filters.articles} onChange={e => setFilters({ ...filters, articles: e.target.checked })} className="accent-slate-500" />
                                </label>
                                <label className="flex items-center justify-between cursor-pointer hover:text-white transition">
                                    <span>エンティティ</span>
                                    <input type="checkbox" checked={filters.entities} onChange={e => setFilters({ ...filters, entities: e.target.checked })} className="accent-emerald-500" />
                                </label>
                            </div>
                        </div>

                        <div className="h-px bg-slate-700/50 my-2"></div>

                        {/* Physics */}
                        <div>
                            <h4 className="font-semibold text-slate-100 mb-2 flex items-center gap-2">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                グラフの形
                            </h4>
                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span>広がり</span>
                                        <span>{Math.abs(physics.charge)}</span>
                                    </div>
                                    <input
                                        type="range" min="5" max="100"
                                        value={Math.abs(physics.charge)}
                                        onChange={e => setPhysics({ ...physics, charge: -Number(e.target.value) })}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span>線の長さ</span>
                                        <span>{physics.linkDistance}</span>
                                    </div>
                                    <input
                                        type="range" min="10" max="200"
                                        value={physics.linkDistance}
                                        onChange={e => setPhysics({ ...physics, linkDistance: Number(e.target.value) })}
                                        className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-700/50 my-2"></div>

                        {/* Legend */}
                        <div>
                            <h4 className="font-semibold text-slate-100 mb-2">凡例</h4>
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500"></span>トピック</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>重要記事</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span>人物</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>組織</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500"></span>技術</div>
                                <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span>イベント</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ForceGraph2D
                ref={fgRef}
                graphData={data}
                width={width}
                height={height}
                nodeAutoColorBy="group"
                nodeCanvasObject={(node: any, ctx, globalScale) => {
                    // Skip rendering if node is not visible (filtered out)
                    if (node.visible === false) return;

                    const label = node.name || '';

                    if (node.isEntitySet) {
                        // --- Entity Set Rendering (Venn Diagram Style) ---
                        const color = node.color || COLORS.node.other;

                        // Draw large semi-transparent circle
                        ctx.beginPath();
                        ctx.arc(node.x || 0, node.y || 0, node.val, 0, 2 * Math.PI, false);
                        ctx.fillStyle = color;
                        ctx.globalAlpha = 0.08; // Very transparent to prevent muddy look
                        ctx.fill();
                        ctx.globalAlpha = 1.0; // Reset alpha

                        // Draw label in center - Clearer style
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'; // Brighter for readability
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        // Slightly larger than articles
                        ctx.font = `${16 / globalScale}px Inter, sans-serif`;
                        ctx.fillText(label, node.x || 0, node.y || 0);

                    } else {
                        // --- Standard Node Rendering (Articles & Topics) ---
                        const fontSize = 12 / globalScale; // Reverted to original size
                        ctx.font = `${fontSize}px Inter, sans-serif`;

                        // 1. Draw node circle (No glow)
                        const color = node.color || COLORS.node.other;
                        ctx.beginPath();
                        ctx.arc(node.x || 0, node.y || 0, node.val || 4, 0, 2 * Math.PI, false);
                        ctx.fillStyle = color;
                        ctx.fill();

                        // Add white border for better visibility
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                        ctx.lineWidth = 1 / globalScale;
                        ctx.stroke();

                        // 2. Draw Label (Truncated)
                        const maxLength = 10;
                        const truncatedLabel = label.length > maxLength
                            ? label.substring(0, maxLength) + '...'
                            : label;

                        ctx.fillStyle = COLORS.text;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle'; // Center vertically

                        // Only show label if zoom level is HIGH or node is a TOPIC
                        // Hiding article labels by default to reduce clutter
                        if (globalScale > 2.5 || node.group === 'topic') {
                            // Draw text background for readability
                            const textWidth = ctx.measureText(truncatedLabel).width;
                            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2);

                            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                            ctx.fillRect(
                                (node.x || 0) - bckgDimensions[0] / 2,
                                (node.y || 0) + (node.val || 4) + 2,
                                bckgDimensions[0],
                                bckgDimensions[1]
                            );

                            ctx.fillStyle = COLORS.text;
                            ctx.fillText(truncatedLabel, node.x || 0, (node.y || 0) + (node.val || 4) + 2 + fontSize / 2);
                        }
                    }
                }}
                linkColor={() => COLORS.link} // Restore visible links
                linkVisibility={(link: any) => link.visible !== false} // Hide links when nodes are filtered
                backgroundColor={COLORS.background}
                nodeRelSize={4}
                linkWidth={1} // Restore visible width
                linkDirectionalParticles={2}
                linkDirectionalParticleSpeed={0.002}
                linkDirectionalParticleWidth={3}
                linkDirectionalParticleColor={() => '#6ee7b7'}
                onNodeClick={node => {
                    console.log('Node clicked:', node);
                }}
                onLinkClick={link => {
                    console.log('Link clicked:', link);
                }}
            />
        </div>
    );
}
