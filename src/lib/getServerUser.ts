import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * サーバー側でSupabaseクライアントを作成（認証情報付き）
 */
export async function createServerSupabase() {
    const cookieStore = await cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // Server Component の場合は無視（読み取りのみ）
                    }
                },
            },
        }
    );
}

/**
 * 現在のユーザーを取得（認証必須のAPIで使用）
 * @returns ユーザー情報またはnull
 */
export async function getServerUser() {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

/**
 * 認証必須のAPIで使用するユーザーID取得
 * ユーザーが未認証の場合はエラーレスポンスを返す
 */
export async function requireAuth() {
    const user = await getServerUser();
    if (!user) {
        return { error: 'Unauthorized', user: null };
    }
    return { error: null, user };
}
