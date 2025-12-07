-- 既存データをtest@example.comユーザーに割り当てる移行スクリプト

-- 1. test@example.comのuser_idを取得して変数に設定
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- test@example.comのuser_idを取得
    SELECT id INTO target_user_id FROM auth.users WHERE email = 'test@example.com';
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User test@example.com not found';
    END IF;
    
    -- 2. 既存のトピックにuser_idを設定
    UPDATE topics SET user_id = target_user_id WHERE user_id IS NULL;
    
    -- 3. 既存の既読状態にuser_idを設定
    UPDATE article_read_status SET user_id = target_user_id WHERE user_id IS NULL;
    
    -- 4. 既存のフィードバックにuser_idを設定
    UPDATE article_feedback SET user_id = target_user_id WHERE user_id IS NULL;
    
    RAISE NOTICE 'Successfully assigned all data to user: %', target_user_id;
END $$;

-- 確認クエリ
SELECT 'topics' as table_name, COUNT(*) as count FROM topics WHERE user_id IS NOT NULL
UNION ALL
SELECT 'article_read_status', COUNT(*) FROM article_read_status WHERE user_id IS NOT NULL
UNION ALL
SELECT 'article_feedback', COUNT(*) FROM article_feedback WHERE user_id IS NOT NULL;
