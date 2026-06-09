-- 000004_chat_time_columns
-- +migrate Down

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS conversations_old (
    id TEXT NOT NULL PRIMARY KEY,
    display_name TEXT,
    channel_id TEXT NOT NULL DEFAULT 'default',
    search_config TEXT,
    application_id TEXT DEFAULT '',
    ext TEXT,
    model TEXT DEFAULT '',
    models TEXT,
    chat_times INTEGER NOT NULL DEFAULT 0,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

INSERT INTO conversations_old (
    id, display_name, channel_id, search_config, application_id, ext, model, models,
    chat_times, create_user_id, create_user_name, created_at, updated_at, deleted_at
)
SELECT
    id, display_name, channel_id, search_config, application_id, ext, model, models,
    chat_times, create_user_id, create_user_name, created_at, updated_at, deleted_at
FROM conversations;

DROP TABLE conversations;
ALTER TABLE conversations_old RENAME TO conversations;

CREATE TABLE IF NOT EXISTS chat_histories_old (
    id TEXT NOT NULL PRIMARY KEY,
    seq INTEGER NOT NULL,
    conversation_id TEXT NOT NULL,
    raw_content TEXT,
    retrieval_result TEXT,
    content TEXT,
    result TEXT,
    feed_back INTEGER DEFAULT 0,
    reason TEXT,
    expected_answer TEXT,
    ext TEXT,
    version TEXT DEFAULT '2.3',
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL
);

INSERT INTO chat_histories_old (
    id, seq, conversation_id, raw_content, retrieval_result, content, result,
    feed_back, reason, expected_answer, ext, version, create_time, update_time
)
SELECT
    id, seq, conversation_id, raw_content, retrieval_result, content, result,
    feed_back, reason, expected_answer, ext, version, create_time, update_time
FROM chat_histories;

DROP TABLE chat_histories;
ALTER TABLE chat_histories_old RENAME TO chat_histories;

CREATE TABLE IF NOT EXISTS multi_answers_chat_histories_old (
    id TEXT NOT NULL PRIMARY KEY,
    seq INTEGER NOT NULL,
    conversation_id TEXT NOT NULL,
    raw_content TEXT,
    retrieval_result TEXT,
    content TEXT,
    result TEXT,
    feed_back INTEGER DEFAULT 0,
    reason TEXT,
    ext TEXT,
    endpoint TEXT,
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL
);

INSERT INTO multi_answers_chat_histories_old (
    id, seq, conversation_id, raw_content, retrieval_result, content, result,
    feed_back, reason, ext, endpoint, create_time, update_time
)
SELECT
    id, seq, conversation_id, raw_content, retrieval_result, content, result,
    feed_back, reason, ext, endpoint, create_time, update_time
FROM multi_answers_chat_histories;

DROP TABLE multi_answers_chat_histories;
ALTER TABLE multi_answers_chat_histories_old RENAME TO multi_answers_chat_histories;

CREATE INDEX IF NOT EXISTS idx_chat_histories_conversation_id ON chat_histories (conversation_id);
CREATE INDEX IF NOT EXISTS idx_multi_answers_chat_histories_conversation_id ON multi_answers_chat_histories (conversation_id);

PRAGMA foreign_keys=ON;
