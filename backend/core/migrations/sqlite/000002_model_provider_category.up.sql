ALTER TABLE default_model_providers
  ADD COLUMN category TEXT NOT NULL DEFAULT 'model';

ALTER TABLE default_model_providers
  ADD COLUMN capabilities TEXT NOT NULL DEFAULT 'multi_group,custom_base_url,has_models';

ALTER TABLE user_model_providers
  ADD COLUMN category TEXT NOT NULL DEFAULT 'model';

ALTER TABLE user_model_providers
  ADD COLUMN capabilities TEXT NOT NULL DEFAULT 'multi_group,custom_base_url,has_models';

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

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_selected_providers_user_category
  ON user_selected_providers (user_id, category);

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_selected_providers_shared_category
  ON user_selected_providers (category) WHERE share = 1;
