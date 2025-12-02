import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function summarizeText(text: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
    const prompt = `
    Summarize the following text in Japanese. 
    Focus on the key facts, insights, and implications.
    Keep it concise (around 200-300 characters).
    
    Text:
    ${text.substring(0, 10000)} // Limit input length
  `;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error('Summarization Error:', error);
        return 'Summary unavailable.';
    }
}

export async function generateEmbedding(text: string): Promise<number[]> {
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });

    try {
        const result = await model.embedContent(text);
        return result.embedding.values;
    } catch (error) {
        console.error('Embedding Error:', error);
        return [];
    }
}

export type ArticleAnalysis = {
    summary: string;
    importance_score: number;
    entities: Array<{ type: string; name: string }>;
    sentiment: 'positive' | 'neutral' | 'negative';
    tags: string[];
    embedding: number[];
};

export async function analyzeArticle(title: string, content: string): Promise<ArticleAnalysis> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

    const analysisPrompt = `
あなたは情報分析エージェントです。以下の記事を分析してください。

# タイトル
${title}

# 本文
${content.substring(0, 10000)}

# 指示
以下のJSON形式で出力してください（JSONのみ、他の説明は不要）:

{
  "summary": "記事の要約（日本語、200-300文字）",
  "importance_score": 0-100の整数（新規性・影響度・緊急性を考慮。50=平均的、80以上=非常に重要、30以下=あまり重要でない）,
  "entities": [
    {"type": "person", "name": "人名"},
    {"type": "organization", "name": "組織・企業名"},
    {"type": "technology", "name": "技術・製品名"},
    {"type": "event", "name": "イベント・出来事"}
  ],
  "sentiment": "positive" または "neutral" または "negative",
  "tags": ["カテゴリ1", "カテゴリ2"]（最大5つ）
}

重要度スコアの基準:
- 90-100: 市場を動かす重大ニュース（例: 大企業倒産、法規制変更、革新的技術発表）
- 70-89: 業界に大きな影響（例: 大型M&A、重要人事、新製品発表）
- 50-69: 通常のニュース
- 30-49: 小規模な更新
- 0-29: ほぼ影響なし
`;

    try {
        const result = await model.generateContent(analysisPrompt);
        const response = await result.response;
        const text = response.text();

        // Clean JSON response
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const analysis = JSON.parse(jsonStr);

        // Generate embedding for similarity search
        const embedding = await generateEmbedding(`${title}\n${analysis.summary}`);

        return {
            summary: analysis.summary || 'Summary unavailable',
            importance_score: Math.max(0, Math.min(100, analysis.importance_score || 50)),
            entities: Array.isArray(analysis.entities) ? analysis.entities : [],
            sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment)
                ? analysis.sentiment
                : 'neutral',
            tags: Array.isArray(analysis.tags) ? analysis.tags.slice(0, 5) : [],
            embedding
        };
    } catch (error) {
        console.error('Article Analysis Error:', error);
        // Fallback to basic analysis
        const summary = await summarizeText(content);
        const embedding = await generateEmbedding(`${title}\n${summary}`);

        return {
            summary,
            importance_score: 50,
            entities: [],
            sentiment: 'neutral',
            tags: [],
            embedding
        }
    }
}

export type RSSFeedSuggestion = {
    name: string;
    url: string;
    description: string;
    type: 'rss' | 'web';
};

export async function suggestRSSFeeds(keyword: string): Promise<RSSFeedSuggestion[]> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

    const prompt = `
あなたは情報収集のエキスパートです。以下のキーワードに関連する日本語の情報源を3-5件提案してください。

# キーワード
${keyword}

# 指示
- 実在する信頼性の高い日本語の情報源のみを推奨してください
- 以下の2種類の情報源を提案できます：
  1. RSSフィード: 自動的に複数記事を取得できるフィード（Yahoo!ニュース、Google News、ブログRSSなど）
  2. ウェブページ: 定期的にチェックする価値のあるページ（企業のお知らせページ、ニュースセクション、公式サイトなど）
- 各情報源について、名前、URL、簡単な説明、タイプを提供してください
- 以下のJSON形式で出力してください（JSONのみ、他の説明は不要）:

[
  {
    "name": "情報源の名前",
    "url": "https://example.com/feed.rss または https://example.com/news",
    "description": "この情報源の説明（1行、30文字以内）",
    "type": "rss" または "web"
  }
]

注意: 
- URLは必ず実在するURLを指定してください
- RSSフィードの場合は type を "rss" に、通常のウェブページの場合は "web" にしてください
- RSSフィードが利用可能な場合は優先的に推奨してください
`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Clean JSON response
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const suggestions = JSON.parse(jsonStr);

        return Array.isArray(suggestions) ? suggestions.slice(0, 5) : [];
    } catch (error) {
        console.error('RSS Feed Suggestion Error:', error);
        return [];
    }
}
