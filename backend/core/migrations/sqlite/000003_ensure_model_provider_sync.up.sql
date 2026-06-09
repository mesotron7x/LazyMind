CREATE UNIQUE INDEX IF NOT EXISTS uk_user_model_providers_user_default_provider
  ON user_model_providers (create_user_id, default_model_provider_id);

