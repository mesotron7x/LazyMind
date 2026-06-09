-- 000001_init_schema
-- +migrate Up
-- Consolidated SQLite schema for LazyMind Desktop Mode.
-- Combines all PostgreSQL migrations into a single SQLite-compatible init.

CREATE TABLE IF NOT EXISTS acl_groups (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS acl_kbs (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    owner_id TEXT,
    visibility TEXT
);

CREATE TABLE IF NOT EXISTS acl_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT,
    resource_id TEXT,
    grantee_type TEXT,
    target_id TEXT,
    permission TEXT,
    created_by TEXT,
    created_at TEXT,
    expires_at TEXT
);

CREATE TABLE IF NOT EXISTS acl_user_groups (
    user_id TEXT NOT NULL,
    group_id TEXT NOT NULL,
    PRIMARY KEY (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS acl_visibility (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT,
    level TEXT
);

CREATE TABLE IF NOT EXISTS agent_thread_records (
    id TEXT NOT NULL PRIMARY KEY,
    thread_id TEXT NOT NULL,
    round_id TEXT NOT NULL DEFAULT '',
    task_id TEXT NOT NULL DEFAULT '',
    stream_kind TEXT NOT NULL,
    record_key TEXT NOT NULL,
    event_name TEXT NOT NULL DEFAULT '',
    payload_text TEXT NOT NULL DEFAULT '',
    raw_frame TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_thread_rounds (
    round_id TEXT NOT NULL PRIMARY KEY,
    thread_id TEXT NOT NULL,
    request_hash TEXT NOT NULL DEFAULT '',
    task_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'created',
    user_message TEXT NOT NULL DEFAULT '',
    assistant_message TEXT NOT NULL DEFAULT '',
    request_payload TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_threads (
    thread_id TEXT NOT NULL PRIMARY KEY,
    current_task_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'created',
    thread_payload TEXT NOT NULL DEFAULT '',
    last_message_request_hash TEXT NOT NULL DEFAULT '',
    create_user_id TEXT NOT NULL DEFAULT '',
    create_user_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_user_active_threads (
    user_id TEXT NOT NULL PRIMARY KEY,
    thread_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'creating',
    create_token TEXT NOT NULL DEFAULT '',
    lease_until TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_histories (
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
    create_time DATETIME NOT NULL,
    update_time DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
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
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    deleted_at DATETIME
);

CREATE TABLE IF NOT EXISTS dataset_members (
    id TEXT NOT NULL PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    tenant_member_id TEXT NOT NULL,
    role INTEGER NOT NULL,
    resource_id TEXT NOT NULL,
    name TEXT NOT NULL,
    create_time TEXT NOT NULL,
    update_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
    id TEXT NOT NULL PRIMARY KEY,
    kb_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    "desc" TEXT NOT NULL,
    cover_image TEXT NOT NULL,
    resource_uid TEXT NOT NULL,
    bucket_name TEXT NOT NULL,
    oss_path TEXT NOT NULL,
    dataset_info TEXT,
    dataset_state INTEGER NOT NULL,
    embedding_model TEXT NOT NULL,
    embedding_model_provider TEXT NOT NULL,
    share_type INTEGER NOT NULL,
    shared_at TEXT,
    tenant_id TEXT NOT NULL,
    is_demonstrate INTEGER NOT NULL DEFAULT 0,
    type INTEGER NOT NULL DEFAULT 1,
    ext TEXT,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS default_datasets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    dataset_name TEXT NOT NULL,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS default_model_providers (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'model',
    capabilities TEXT NOT NULL DEFAULT 'multi_group,custom_base_url,has_models',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS default_models (
    id TEXT NOT NULL PRIMARY KEY,
    default_model_provider_id TEXT NOT NULL,
    provider_name TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS default_prompts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt_id TEXT NOT NULL,
    prompt_name TEXT NOT NULL,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS documents (
    id TEXT NOT NULL PRIMARY KEY,
    lazyllm_doc_id TEXT NOT NULL DEFAULT '',
    dataset_id TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    p_id TEXT NOT NULL DEFAULT '',
    tags TEXT,
    file_id TEXT NOT NULL DEFAULT '',
    pdf_convert_result TEXT NOT NULL DEFAULT '',
    ext TEXT,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS multi_answers_chat_histories (
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

CREATE TABLE IF NOT EXISTS multi_answers_switches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status INTEGER NOT NULL DEFAULT 0,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS prompts (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS resource_session_snapshots (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT '',
    parent_skill_name TEXT NOT NULL DEFAULT '',
    skill_name TEXT NOT NULL DEFAULT '',
    file_ext TEXT NOT NULL DEFAULT '',
    relative_path TEXT NOT NULL DEFAULT '',
    snapshot_hash TEXT NOT NULL DEFAULT '',
    storage_path TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resource_suggestions (
    id TEXT NOT NULL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT '',
    resource_type TEXT NOT NULL,
    resource_key TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    parent_skill_name TEXT NOT NULL DEFAULT '',
    skill_name TEXT NOT NULL DEFAULT '',
    file_ext TEXT NOT NULL DEFAULT '',
    relative_path TEXT NOT NULL DEFAULT '',
    action TEXT NOT NULL,
    session_id TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    content TEXT,
    reason TEXT,
    full_content TEXT,
    status TEXT NOT NULL,
    invalid_reason TEXT,
    reviewer_id TEXT NOT NULL DEFAULT '',
    reviewer_name TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT,
    ext TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_resources (
    id TEXT NOT NULL PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    owner_user_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    parent_skill_name TEXT NOT NULL DEFAULT '',
    skill_name TEXT NOT NULL DEFAULT '',
    node_type TEXT NOT NULL,
    description TEXT,
    tags TEXT,
    file_ext TEXT NOT NULL DEFAULT 'md',
    relative_path TEXT NOT NULL,
    storage_path TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    draft_source_version INTEGER NOT NULL DEFAULT 0,
    draft_status TEXT NOT NULL DEFAULT '',
    draft_updated_at TEXT,
    auto_evo INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    update_status TEXT NOT NULL DEFAULT 'up_to_date',
    ext TEXT,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    content_size INTEGER NOT NULL DEFAULT 0,
    mime_type TEXT NOT NULL DEFAULT 'text/plain; charset=utf-8',
    draft_content TEXT NOT NULL DEFAULT '',
    auto_evo_apply_status TEXT NOT NULL DEFAULT 'idle',
    auto_evo_generation INTEGER NOT NULL DEFAULT 0,
    auto_evo_started_at TEXT,
    auto_evo_finished_at TEXT,
    auto_evo_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS skill_share_items (
    id TEXT NOT NULL PRIMARY KEY,
    share_task_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    target_user_name TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    target_relative_root TEXT NOT NULL DEFAULT '',
    target_storage_path TEXT NOT NULL DEFAULT '',
    accepted_at TEXT,
    rejected_at TEXT,
    target_root_skill_id TEXT NOT NULL DEFAULT '',
    error_message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_share_tasks (
    id TEXT NOT NULL PRIMARY KEY,
    source_user_id TEXT NOT NULL,
    source_user_name TEXT NOT NULL DEFAULT '',
    source_skill_id TEXT NOT NULL,
    source_category TEXT NOT NULL DEFAULT '',
    source_parent_skill_name TEXT NOT NULL DEFAULT '',
    source_relative_root TEXT NOT NULL DEFAULT '',
    source_storage_root TEXT NOT NULL DEFAULT '',
    message TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_memories (
    id TEXT NOT NULL PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    draft_content TEXT,
    draft_source_version INTEGER NOT NULL DEFAULT 0,
    draft_status TEXT NOT NULL DEFAULT '',
    draft_updated_at TEXT,
    ext TEXT,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    auto_evo INTEGER NOT NULL DEFAULT 1,
    auto_evo_apply_status TEXT NOT NULL DEFAULT 'idle',
    auto_evo_generation INTEGER NOT NULL DEFAULT 0,
    auto_evo_started_at TEXT,
    auto_evo_finished_at TEXT,
    auto_evo_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS system_user_preferences (
    id TEXT NOT NULL PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    content_hash TEXT NOT NULL DEFAULT '',
    version INTEGER NOT NULL DEFAULT 1,
    draft_content TEXT,
    draft_source_version INTEGER NOT NULL DEFAULT 0,
    draft_status TEXT NOT NULL DEFAULT '',
    draft_updated_at TEXT,
    ext TEXT,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    user_id TEXT NOT NULL DEFAULT '',
    auto_evo INTEGER NOT NULL DEFAULT 1,
    auto_evo_apply_status TEXT NOT NULL DEFAULT 'idle',
    auto_evo_generation INTEGER NOT NULL DEFAULT 0,
    auto_evo_started_at TEXT,
    auto_evo_finished_at TEXT,
    auto_evo_error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT NOT NULL PRIMARY KEY,
    lazyllm_task_id TEXT NOT NULL DEFAULT '',
    doc_id TEXT,
    kb_id TEXT,
    algo_id TEXT,
    dataset_id TEXT NOT NULL,
    task_type TEXT NOT NULL DEFAULT '',
    document_pid TEXT NOT NULL DEFAULT '',
    target_pid TEXT NOT NULL DEFAULT '',
    target_dataset_id TEXT NOT NULL DEFAULT '',
    display_name TEXT NOT NULL DEFAULT '',
    ext TEXT,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS upload_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    upload_state TEXT NOT NULL DEFAULT '',
    ext TEXT,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS uploaded_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upload_file_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    task_id TEXT NOT NULL DEFAULT '',
    document_id TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT '',
    ext TEXT,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_model_provider_group_models (
    id TEXT NOT NULL PRIMARY KEY,
    user_model_provider_id TEXT NOT NULL,
    user_model_provider_group_id TEXT NOT NULL,
    provider_name TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    model_type TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_model_provider_groups (
    id TEXT NOT NULL PRIMARY KEY,
    user_model_provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    base_url TEXT NOT NULL,
    api_key TEXT NOT NULL,
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    is_verified INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_model_providers (
    id TEXT NOT NULL PRIMARY KEY,
    default_model_provider_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'model',
    capabilities TEXT NOT NULL DEFAULT 'multi_group,custom_base_url,has_models',
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS user_personalization_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    updated_by TEXT NOT NULL DEFAULT '',
    updated_by_name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_selected_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    model_type TEXT NOT NULL,
    user_model_provider_group_model_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    share INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_selected_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL,
    user_model_provider_group_id TEXT NOT NULL,
    share INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS word_group_conflicts (
    id TEXT NOT NULL PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT '',
    word TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    group_ids TEXT NOT NULL DEFAULT '[]',
    create_user_id TEXT NOT NULL,
    message_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS words (
    id TEXT NOT NULL PRIMARY KEY,
    word TEXT NOT NULL,
    group_id TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'user',
    reference_info TEXT NOT NULL DEFAULT '',
    locked INTEGER NOT NULL DEFAULT 0,
    word_kind TEXT NOT NULL DEFAULT 'term',
    create_user_id TEXT NOT NULL,
    create_user_name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
);

-- Indexes

CREATE UNIQUE INDEX IF NOT EXISTS datasetmember_dataset_id_tenant_member_id_role ON dataset_members (dataset_id, tenant_member_id, role);
CREATE INDEX IF NOT EXISTS datasetmember_name ON dataset_members (name);
CREATE INDEX IF NOT EXISTS datasetmember_resource_id ON dataset_members (resource_id);
CREATE INDEX IF NOT EXISTS datasetmember_tenant_member_id ON dataset_members (tenant_member_id);

CREATE INDEX IF NOT EXISTS idx_acl_resource ON acl_rows (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_acl_visibility_resource_id ON acl_visibility (resource_id);

CREATE INDEX IF NOT EXISTS idx_agent_thread_records_round_stream_id ON agent_thread_records (round_id, stream_kind, id);
CREATE INDEX IF NOT EXISTS idx_agent_thread_records_thread_round_id ON agent_thread_records (thread_id, round_id);
CREATE INDEX IF NOT EXISTS idx_agent_thread_records_thread_stream_id ON agent_thread_records (thread_id, stream_kind, id);
CREATE INDEX IF NOT EXISTS idx_agent_thread_rounds_thread_id ON agent_thread_rounds (thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_agent_thread_rounds_thread_request_hash ON agent_thread_rounds (thread_id, request_hash);
CREATE INDEX IF NOT EXISTS idx_agent_threads_current_task_id ON agent_threads (current_task_id);
CREATE INDEX IF NOT EXISTS idx_agent_user_active_threads_status_lease ON agent_user_active_threads (status, lease_until);
CREATE INDEX IF NOT EXISTS idx_agent_user_active_threads_thread_id ON agent_user_active_threads (thread_id);

CREATE INDEX IF NOT EXISTS idx_chat_histories_conversation_id ON chat_histories (conversation_id);
CREATE INDEX IF NOT EXISTS idx_create_user_id ON datasets (create_user_id);
CREATE INDEX IF NOT EXISTS idx_datasets_kb_id ON datasets (kb_id);
CREATE INDEX IF NOT EXISTS idx_documents_dataset_id ON documents (dataset_id);
CREATE INDEX IF NOT EXISTS idx_documents_lazyllm_doc_id ON documents (lazyllm_doc_id);
CREATE INDEX IF NOT EXISTS idx_documents_p_id ON documents (p_id);
CREATE INDEX IF NOT EXISTS idx_multi_answers_chat_histories_conversation_id ON multi_answers_chat_histories (conversation_id);

CREATE INDEX IF NOT EXISTS idx_resource_session_snapshots_session_id ON resource_session_snapshots (session_id);
CREATE INDEX IF NOT EXISTS idx_resource_suggestions_list ON resource_suggestions (user_id, resource_type, status);
CREATE INDEX IF NOT EXISTS idx_resource_suggestions_session_id ON resource_suggestions (session_id);
CREATE INDEX IF NOT EXISTS idx_resource_uid ON datasets (resource_uid);
CREATE INDEX IF NOT EXISTS idx_skill_resources_owner_node_enabled ON skill_resources (owner_user_id, node_type, is_enabled, category);
CREATE INDEX IF NOT EXISTS idx_skill_share_items_target_user ON skill_share_items (share_task_id, target_user_id, status);
CREATE INDEX IF NOT EXISTS idx_skill_share_tasks_source_user ON skill_share_tasks (source_user_id);

CREATE INDEX IF NOT EXISTS idx_tasks_algo_id ON tasks (algo_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dataset_id ON tasks (dataset_id);
CREATE INDEX IF NOT EXISTS idx_tasks_doc_id ON tasks (doc_id);
CREATE INDEX IF NOT EXISTS idx_tasks_document_pid ON tasks (document_pid);
CREATE INDEX IF NOT EXISTS idx_tasks_kb_id ON tasks (kb_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lazyllm_task_id ON tasks (lazyllm_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_target_dataset_id ON tasks (target_dataset_id);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks (task_type);

CREATE INDEX IF NOT EXISTS idx_upload_sessions_dataset_id ON upload_sessions (dataset_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_document_id ON upload_sessions (document_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_task_id ON upload_sessions (task_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_upload_state ON upload_sessions (upload_state);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_dataset_id ON uploaded_files (dataset_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_document_id ON uploaded_files (document_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_status ON uploaded_files (status);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_task_id ON uploaded_files (task_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_tenant_id ON uploaded_files (tenant_id);

CREATE INDEX IF NOT EXISTS idx_user_model_provider_group_models_create_user_id ON user_model_provider_group_models (create_user_id);
CREATE INDEX IF NOT EXISTS idx_user_model_provider_group_models_provider ON user_model_provider_group_models (user_model_provider_id);
CREATE INDEX IF NOT EXISTS idx_user_model_provider_groups_create_user_id ON user_model_provider_groups (create_user_id);
CREATE INDEX IF NOT EXISTS idx_user_model_provider_groups_parent ON user_model_provider_groups (user_model_provider_id);
CREATE INDEX IF NOT EXISTS idx_user_model_providers_create_user_id ON user_model_providers (create_user_id);
CREATE INDEX IF NOT EXISTS idx_user_selected_models_user_id ON user_selected_models (user_id);

CREATE INDEX IF NOT EXISTS idx_word_column ON words (create_user_id, word);
CREATE INDEX IF NOT EXISTS idx_word_create_user_group_id ON words (create_user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_word_group_conflict_user_updated ON word_group_conflicts (create_user_id, updated_at) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uk_agent_thread_records_record_key ON agent_thread_records (thread_id, round_id, stream_kind, record_key);
CREATE UNIQUE INDEX IF NOT EXISTS uk_default_model_providers_name ON default_model_providers (name);
CREATE UNIQUE INDEX IF NOT EXISTS uk_default_models_provider_name ON default_models (default_model_provider_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uk_prompts_user_name ON prompts (create_user_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uk_resource_session_snapshots ON resource_session_snapshots (session_id, resource_type, resource_key);
CREATE UNIQUE INDEX IF NOT EXISTS uk_skill_resources_owner_relative_path ON skill_resources (owner_user_id, relative_path);
CREATE UNIQUE INDEX IF NOT EXISTS uk_system_memories_user_id ON system_memories (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_system_user_preferences_user_id ON system_user_preferences (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_upload_sessions_upload_id ON upload_sessions (upload_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_uploaded_files_upload_file_id ON uploaded_files (upload_file_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_model_provider_group_models_group_name ON user_model_provider_group_models (user_model_provider_group_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_model_providers_user_default_provider ON user_model_providers (create_user_id, default_model_provider_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_personalization_settings_user_id ON user_personalization_settings (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_selected_models_user_type ON user_selected_models (user_id, model_type);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_selected_providers_user_category ON user_selected_providers (user_id, category);
CREATE UNIQUE INDEX IF NOT EXISTS ukx_create_user_id_dataset_id ON default_datasets (create_user_id, dataset_id);
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_selected_models_shared_model ON user_selected_models (model_type) WHERE share = 1;
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_selected_providers_shared_category ON user_selected_providers (category) WHERE share = 1;
