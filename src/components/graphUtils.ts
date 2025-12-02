export type Node = {
    id: string;
    group: string; // 'article' | 'topic' | 'person' | 'organization' | 'technology' | 'event' | 'location'
    val: number; // Size
    name: string;
    color?: string;
    importance?: number; // For articles
    isEntitySet?: boolean; // Custom flag for Venn diagram style
    visible?: boolean; // Visibility flag for filtering
};

export type Link = {
    source: string;
    target: string;
    value?: number;
    visible?: boolean; // Visibility flag for filtering
};

export type GraphData = {
    nodes: Node[];
    links: Link[];
};

// Obsidian-like colors
export const COLORS = {
    background: '#0b0e14', // Deep dark background
    text: '#dadada',
    node: {
        article: '#94a3b8', // Default article
        article_important: '#ef4444', // High importance
        topic: '#6366f1', // Indigo
        person: '#f59e0b', // Amber
        organization: '#10b981', // Emerald
        technology: '#06b6d4', // Cyan
        event: '#a855f7', // Purple
        location: '#ec4899', // Pink
        other: '#64748b' // Slate
    },
    link: 'rgba(255, 255, 255, 0.2)' // More transparent to reduce clutter
};

type Filters = {
    articles: boolean;
    topics: boolean;
    entities: boolean;
};

export function generateGraphData(
    topics: any[],
    articles: any[],
    filters: Filters,
    linkDistance: number
): GraphData {
    const nodes: Node[] = [];
    const links: Link[] = [];
    const nodeIds = new Set<string>();

    // Helper to add node if unique
    const addNode = (node: Node) => {
        if (!nodeIds.has(node.id)) {
            nodes.push(node);
            nodeIds.add(node.id);
        }
    };

    // 1. Add Topics - always generate, control visibility with filter
    topics.forEach(t => {
        addNode({
            id: `topic-${t.id}`,
            group: 'topic',
            val: 8,
            name: t.keyword || 'No Keyword',
            color: COLORS.node.topic,
            visible: filters.topics // Visibility controlled by filter
        });
    });

    // 2. Add Articles - always generate, control visibility with filter
    articles.forEach(a => {
        const isImportant = (a.importance_score || 0) >= 80;
        addNode({
            id: `article-${a.id}`,
            group: isImportant ? 'article_important' : 'article',
            val: 5,
            name: a.title || 'No Title',
            color: isImportant ? COLORS.node.article_important : COLORS.node.article,
            importance: a.importance_score,
            visible: filters.articles // Visibility controlled by filter
        });

        // Link Article to Topic - always create links
        if (a.source?.topic_id) {
            links.push({
                source: `topic-${a.source.topic_id}`,
                target: `article-${a.id}`
            });
        }
    });

    // 3. Add Entities as Sets - always generate, control visibility with filter
    // First, count articles per entity to filter out sparse ones
    const entityCounts = new Map<string, number>();
    articles.forEach(a => {
        if (a.entities && Array.isArray(a.entities)) {
            a.entities.forEach((e: any) => {
                if (!e.name) return;
                const entityId = `entity-${e.name}-${e.type}`;
                entityCounts.set(entityId, (entityCounts.get(entityId) || 0) + 1);
            });
        }
    });

    articles.forEach(a => {
        if (a.entities && Array.isArray(a.entities)) {
            a.entities.forEach((e: any) => {
                if (!e.name) return; // Skip invalid entities

                const entityId = `entity-${e.name}-${e.type}`;

                // Only show entities with at least 3 articles
                if ((entityCounts.get(entityId) || 0) < 3) return;

                // Determine color based on type
                let color = COLORS.node.other;
                if (e.type === 'Person') color = COLORS.node.person;
                if (e.type === 'Organization') color = COLORS.node.organization;
                if (e.type === 'technology') color = COLORS.node.technology;
                if (e.type === 'event') color = COLORS.node.event;
                if (e.type === 'location') color = COLORS.node.location;

                // Dynamic size based on link distance to ensure containment
                // Radius should be > linkDistance to contain the connected nodes
                // Increased multiplier from 2.5 to 3.5 for more spacing
                const radius = Math.max(150, linkDistance * 2.0);

                addNode({
                    id: entityId,
                    group: e.type,
                    val: radius,
                    name: e.name,
                    color: color,
                    isEntitySet: true, // Flag for custom rendering
                    visible: filters.entities // Visibility controlled by filter
                });

                // Link Article to Entity (for physics only, always hidden visually)
                links.push({
                    source: `article-${a.id}`,
                    target: entityId,
                    visible: false // Always hidden for visual consistency
                });
            });
        }
    });

    // 4. Create article-to-article links based on shared entities
    // Build a map of entity to articles
    const entityToArticles = new Map<string, string[]>();
    articles.forEach(a => {
        if (a.entities && Array.isArray(a.entities)) {
            a.entities.forEach((e: any) => {
                if (!e.name) return;
                const entityId = `entity-${e.name}-${e.type}`;

                // Only consider entities with at least 3 articles (same threshold as entity display)
                if ((entityCounts.get(entityId) || 0) < 3) return;

                if (!entityToArticles.has(entityId)) {
                    entityToArticles.set(entityId, []);
                }
                entityToArticles.get(entityId)!.push(`article-${a.id}`);
            });
        }
    });

    // Create links between articles that share common entities
    const articlePairs = new Set<string>(); // To avoid duplicate links
    entityToArticles.forEach((articleIds, entityId) => {
        // For each entity, link all pairs of articles that share it
        for (let i = 0; i < articleIds.length; i++) {
            for (let j = i + 1; j < articleIds.length; j++) {
                const pairKey = [articleIds[i], articleIds[j]].sort().join('-');
                if (!articlePairs.has(pairKey)) {
                    articlePairs.add(pairKey);
                    links.push({
                        source: articleIds[i],
                        target: articleIds[j],
                        // Article-to-article links are always visible (for consistency)
                        // Their visibility is controlled by the article nodes themselves
                    });
                }
            }
        }
    });

    // Calculate link visibility based on connected nodes
    links.forEach(link => {
        // Skip if already explicitly set to false (e.g., entity links)
        if (link.visible === false) return;

        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);

        // Link is visible only if both connected nodes are visible
        link.visible = (sourceNode?.visible !== false) && (targetNode?.visible !== false);
    });

    return { nodes, links };
}
