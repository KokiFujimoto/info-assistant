import { GoogleGenerativeAI } from '@google/generative-ai';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.local if not in CI
if (!process.env.CI) {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
        const envConfig = fs.readFileSync(envPath, 'utf-8');
        envConfig.split('\n').forEach((line) => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
    }
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error('Error: GEMINI_API_KEY is not set');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

async function generateTweet() {
    try {
        // Get the latest commit message
        const commitMessage = execSync('git log -1 --pretty=%B').toString().trim();
        const commitHash = execSync('git log -1 --pretty=%h').toString().trim();

        console.log(`Analyzing commit: ${commitHash}`);
        console.log(`Message: ${commitMessage}`);

        // Generate tweet content using Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

        const prompt = `
        あなたはフレンドリーな広報担当エンジニアです。
        以下のコミットメッセージに基づいて、Twitter（X）に投稿するための親しみやすく魅力的なリリースツイートを作成してください。
        
        # コミットメッセージ
        ${commitMessage}
        
        # 制約事項
        - 日本語で記述してください
        - 140文字以内に収めてください
        - 堅苦しい「ですます調」ではなく、少しくだけた「〜しました！」「〜だよ！」のような親しみやすい口調で
        - 開発の楽しさやワクワク感を伝えるトーンで
        - 適切な絵文字（🚀, ✨, 🎉, 💪など）を多めに使用してください（2〜3個）
        - ハッシュタグ #InfoAssistant #個人開発 を末尾に追加してください
        - URLやリポジトリへのリンクは含めないでください
        - 出力はツイート本文のみにしてください
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const tweetText = response.text().trim();

        console.log('\n--- Generated Tweet ---');
        console.log(tweetText);
        console.log('-----------------------\n');

        // Create Twitter Intent URL
        const encodedText = encodeURIComponent(tweetText);
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;

        // Output to GitHub Actions Summary
        if (process.env.GITHUB_STEP_SUMMARY) {
            const summary = `
## 🚀 Tweet Draft Generated!

Gemini has created a tweet for the latest commit \`${commitHash}\`.

### 📝 Generated Content
> ${tweetText}

### 👇 Click to Tweet
[**Post to Twitter (Review & Edit)**](${intentUrl})
`;
            fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
        } else {
            console.log(`Tweet URL: ${intentUrl}`);
        }

    } catch (error) {
        console.error('Failed to generate tweet:', error);
        process.exit(1);
    }
}

generateTweet();
