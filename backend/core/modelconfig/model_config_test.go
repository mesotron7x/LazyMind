package modelconfig

import "testing"

func TestBuildLLMConfigUsesCanonicalSiliconFlowSource(t *testing.T) {
	config := BuildLLMConfig([]SelectedRuntimeModel{
		{
			ModelType:    "llm",
			ProviderName: "SiliconFlow",
			ModelName:    "Qwen/Qwen2.5-7B-Instruct",
			BaseURL:      "https://api.siliconflow.cn/v1/",
			APIKey:       "sk-test",
		},
	})

	llm, ok := config["llm"].(map[string]any)
	if !ok {
		t.Fatalf("expected llm config, got %#v", config)
	}
	if llm["source"] != "siliconflow" {
		t.Fatalf("expected canonical siliconflow source, got %#v", llm["source"])
	}
	if llm["model"] != "Qwen/Qwen2.5-7B-Instruct" {
		t.Fatalf("unexpected model: %#v", llm["model"])
	}
}
