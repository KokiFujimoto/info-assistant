
import { test, describe, it } from 'node:test';
import assert from 'node:assert';
import { generateGraphData } from './graphUtils';

describe('Knowledge Graph Logic', () => {
    const mockTopics = [
        { id: 1, keyword: 'Topic A' }
    ];

    const mockArticles = [
        {
            id: 1,
            title: 'Article 1',
            importance_score: 90,
            source: { topic_id: 1 },
            entities: [
                { name: 'Entity A', type: 'Person' },
                { name: 'Entity B', type: 'Organization' }
            ]
        },
        {
            id: 2,
            title: 'Article 2',
            importance_score: 50,
            source: { topic_id: 1 },
            entities: [
                { name: 'Entity A', type: 'Person' }
            ]
        },
        {
            id: 3,
            title: 'Article 3',
            importance_score: 60,
            source: { topic_id: 1 },
            entities: [
                { name: 'Entity A', type: 'Person' }
            ]
        },
        {
            id: 4,
            title: 'Article 4',
            importance_score: 70,
            source: { topic_id: 1 },
            entities: [
                { name: 'Entity B', type: 'Organization' }
            ]
        }
    ];

    const filters = {
        articles: true,
        topics: true,
        entities: true
    };

    it('should filter out entities with fewer than 3 articles', () => {
        const data = generateGraphData(mockTopics, mockArticles, filters, 60);

        // Entity A has 3 articles -> Should be present
        const entityA = data.nodes.find(n => n.id === 'entity-Entity A-Person');
        assert.ok(entityA, 'Entity A should be present (3 articles)');

        // Entity B has 2 articles -> Should be filtered out
        const entityB = data.nodes.find(n => n.id === 'entity-Entity B-Organization');
        assert.strictEqual(entityB, undefined, 'Entity B should be filtered out (2 articles)');
    });

    it('should calculate entity node size based on link distance', () => {
        const linkDistance = 100;
        const data = generateGraphData(mockTopics, mockArticles, filters, linkDistance);

        const entityA = data.nodes.find(n => n.id === 'entity-Entity A-Person');
        assert.ok(entityA);

        // Expected size: max(150, 100 * 2.0) = 200
        assert.strictEqual(entityA?.val, 200, 'Entity size should be linkDistance * 2.0');
    });

    it('should set isEntitySet flag for entity nodes', () => {
        const data = generateGraphData(mockTopics, mockArticles, filters, 60);
        const entityA = data.nodes.find(n => n.id === 'entity-Entity A-Person');
        assert.strictEqual(entityA?.isEntitySet, true, 'Entity node should have isEntitySet flag');
    });

    it('should generate links between articles and entities', () => {
        const data = generateGraphData(mockTopics, mockArticles, filters, 60);

        // Article 1 -> Entity A
        const link1 = data.links.find(l => l.source === 'article-1' && l.target === 'entity-Entity A-Person');
        assert.ok(link1, 'Link between Article 1 and Entity A should exist');

        // Article 4 -> Entity B (Entity B is hidden, so link should NOT exist)
        // Wait, if entity is hidden, link is also not created in the loop
        const link4 = data.links.find(l => l.source === 'article-4' && l.target === 'entity-Entity B-Organization');
        assert.strictEqual(link4, undefined, 'Link to hidden entity should not exist');
    });

    it('should set visible flag based on filters', () => {
        const filtersAllOff = {
            articles: false,
            topics: false,
            entities: false
        };
        const data = generateGraphData(mockTopics, mockArticles, filtersAllOff, 60);

        // All nodes should exist but be invisible
        const topicNode = data.nodes.find(n => n.group === 'topic');
        assert.ok(topicNode, 'Topic node should exist');
        assert.strictEqual(topicNode?.visible, false, 'Topic node should be invisible when filter is off');

        const articleNode = data.nodes.find(n => n.group === 'article' || n.group === 'article_important');
        assert.ok(articleNode, 'Article node should exist');
        assert.strictEqual(articleNode?.visible, false, 'Article node should be invisible when filter is off');

        const entityNode = data.nodes.find(n => n.isEntitySet);
        assert.ok(entityNode, 'Entity node should exist');
        assert.strictEqual(entityNode?.visible, false, 'Entity node should be invisible when filter is off');
    });

    it('should keep all nodes when toggling filters', () => {
        const filtersOn = { articles: true, topics: true, entities: true };
        const filtersOff = { articles: false, topics: false, entities: false };

        const dataOn = generateGraphData(mockTopics, mockArticles, filtersOn, 60);
        const dataOff = generateGraphData(mockTopics, mockArticles, filtersOff, 60);

        // Same number of nodes should exist regardless of filter state
        assert.strictEqual(dataOn.nodes.length, dataOff.nodes.length, 'Number of nodes should be the same regardless of filters');
    });

    it('should hide links when connected nodes are invisible', () => {
        const filtersArticlesOff = {
            articles: false,
            topics: true,
            entities: true
        };
        const data = generateGraphData(mockTopics, mockArticles, filtersArticlesOff, 60);

        // All links should be invisible when articles are hidden
        // because all links involve articles (article-topic, article-entity)
        const invisibleLinks = data.links.filter(l => l.visible === false);
        assert.ok(invisibleLinks.length > 0, 'Some links should be invisible when articles filter is off');

        // Verify that all links are invisible (since all links connect to articles)
        const allLinksInvisible = data.links.every(l => l.visible === false);
        assert.strictEqual(allLinksInvisible, true, 'All links should be invisible when articles are hidden');
    });

    it('should create links between articles sharing common entities', () => {
        const data = generateGraphData(mockTopics, mockArticles, filters, 60);

        // Articles 1, 2, 3 all share Entity A (Person)
        // So they should be linked to each other
        const article1to2 = data.links.find(l =>
            (l.source === 'article-1' && l.target === 'article-2') ||
            (l.source === 'article-2' && l.target === 'article-1')
        );
        assert.ok(article1to2, 'Articles 1 and 2 should be linked (share Entity A)');

        const article1to3 = data.links.find(l =>
            (l.source === 'article-1' && l.target === 'article-3') ||
            (l.source === 'article-3' && l.target === 'article-1')
        );
        assert.ok(article1to3, 'Articles 1 and 3 should be linked (share Entity A)');

        const article2to3 = data.links.find(l =>
            (l.source === 'article-2' && l.target === 'article-3') ||
            (l.source === 'article-3' && l.target === 'article-2')
        );
        assert.ok(article2to3, 'Articles 2 and 3 should be linked (share Entity A)');
    });

    it('should show article-to-article links regardless of entity filter', () => {
        const filtersEntitiesOff = {
            articles: true,
            topics: true,
            entities: false
        };
        const data = generateGraphData(mockTopics, mockArticles, filtersEntitiesOff, 60);

        // Article-to-article links should still exist and be visible
        const articleToArticleLinks = data.links.filter(l =>
            l.source.startsWith('article-') &&
            l.target.startsWith('article-') &&
            l.visible !== false
        );

        assert.ok(articleToArticleLinks.length > 0, 'Article-to-article links should exist even when entities are hidden');
    });
});
