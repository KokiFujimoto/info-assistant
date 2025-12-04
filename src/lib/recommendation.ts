import { supabase } from '@/lib/supabase';
import { generateEmbedding } from '@/lib/gemini';

// Threshold for similarity (0-1). If similarity is higher than this, we consider it "similar".
// 0.8 is usually a good starting point for high similarity.
const SIMILARITY_THRESHOLD = 0.85;

/**
 * Checks if an article should be skipped based on user's negative feedback history.
 * Returns true if the article is too similar to something the user disliked.
 */
export async function shouldSkipArticle(
    title: string,
    summary: string,
    embedding: number[]
): Promise<{ skip: boolean; reason?: string }> {
    try {
        // 1. Get recent "Not Interested" feedback with embeddings
        // We need to join with articles table to get embeddings
        const { data: dislikedArticles, error } = await supabase
            .from('article_feedback')
            .select(`
                article_id,
                articles (
                    title,
                    embedding
                )
            `)
            .eq('is_interested', false)
            .order('created_at', { ascending: false })
            .limit(20); // Check against last 20 disliked items for performance

        if (error || !dislikedArticles) {
            console.error('Error fetching feedback history:', error);
            return { skip: false };
        }

        // 2. Calculate similarity with each disliked article
        for (const item of dislikedArticles) {
            const dislikedArticle = item.articles;
            // @ts-ignore
            if (!dislikedArticle || !dislikedArticle.embedding) continue;

            // @ts-ignore
            const similarity = cosineSimilarity(embedding, dislikedArticle.embedding);

            if (similarity > SIMILARITY_THRESHOLD) {
                // @ts-ignore
                return {
                    skip: true,
                    // @ts-ignore
                    reason: `Similar to disliked article: "${dislikedArticle.title}" (Similarity: ${similarity.toFixed(2)})`
                };
            }
        }

        return { skip: false };

    } catch (error) {
        console.error('Recommendation Error:', error);
        return { skip: false };
    }
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
