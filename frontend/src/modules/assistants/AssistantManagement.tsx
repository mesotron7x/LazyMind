import { useCallback, useEffect, useState } from "react";
import { Avatar, Button, Empty, List, Space, Spin, Tag, Typography, message } from "antd";
import { CheckCircleOutlined, SyncOutlined, UserSwitchOutlined } from "@ant-design/icons";
import { Navigate } from "react-router-dom";
import {
  type DesktopAssistantInfo,
  isDesktopMode,
  syncDesktopAssistantAuth,
} from "@/utils/desktop";
import "./index.scss";

const { Paragraph, Text, Title } = Typography;

export default function AssistantManagement() {
  const desktopMode = isDesktopMode();
  const [assistants, setAssistants] = useState<DesktopAssistantInfo[]>([]);
  const [currentAssistant, setCurrentAssistant] =
    useState<DesktopAssistantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [switchingId, setSwitchingId] = useState("");

  const loadAssistants = useCallback(async () => {
    const api = window.lazymind;
    if (!desktopMode || !api) return;

    setLoading(true);
    try {
      const [list, current] = await Promise.all([
        api.getAssistantList(),
        api.getCurrentAssistant(),
      ]);
      setAssistants(list || []);
      setCurrentAssistant(current);
      if (current?.id) {
        syncDesktopAssistantAuth(current);
      }
    } catch (error) {
      console.error("Failed to load assistants:", error);
      message.error("助手列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [desktopMode]);

  useEffect(() => {
    void loadAssistants();
  }, [loadAssistants]);

  useEffect(() => {
    const api = window.lazymind;
    if (!desktopMode || !api) return;
    return api.onAssistantChange((assistant) => {
      if (!assistant?.id) return;
      setCurrentAssistant(assistant);
      syncDesktopAssistantAuth(assistant);
    });
  }, [desktopMode]);

  const handleSwitchAssistant = async (assistant: DesktopAssistantInfo) => {
    const api = window.lazymind;
    if (!api) return;
    if (assistant.id === currentAssistant?.id) return;

    setSwitchingId(assistant.id);
    try {
      await api.setCurrentAssistant(assistant.id);
      const current = await api.getCurrentAssistant();
      const nextAssistant = current?.id ? current : assistant;
      setCurrentAssistant(nextAssistant);
      syncDesktopAssistantAuth(nextAssistant);
      message.success(`已切换到 ${nextAssistant.displayName || nextAssistant.username}`);
    } catch (error) {
      console.error("Failed to switch assistant:", error);
      message.error("助手切换失败");
    } finally {
      setSwitchingId("");
    }
  };

  if (!desktopMode) {
    return <Navigate to="/agent/chat" replace />;
  }

  return (
    <div className="assistant-management-page">
      <div className="assistant-management-toolbar">
        <div>
          <Title level={2} className="assistant-management-title">
            助手管理
          </Title>
          <Paragraph className="assistant-management-subtitle">
            选择当前智能助手。不同助手会使用各自的对话、知识库和记忆上下文。
          </Paragraph>
        </div>
        <Button
          icon={<SyncOutlined />}
          onClick={loadAssistants}
          loading={loading}
        >
          刷新
        </Button>
      </div>

      <Spin spinning={loading}>
        {assistants.length ? (
          <List
            className="assistant-management-list"
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
            dataSource={assistants}
            renderItem={(assistant) => {
              const isCurrent = assistant.id === currentAssistant?.id;

              return (
                <List.Item>
                  <div
                    className={`assistant-management-item${
                      isCurrent ? " is-current" : ""
                    }`}
                  >
                    <div className="assistant-management-item-header">
                      <Avatar size={44} className="assistant-management-avatar">
                        {assistant.avatar || <UserSwitchOutlined />}
                      </Avatar>
                      <div className="assistant-management-meta">
                        <Text strong className="assistant-management-name">
                          {assistant.displayName || assistant.username}
                        </Text>
                        <Text type="secondary" className="assistant-management-username">
                          {assistant.username}
                        </Text>
                      </div>
                    </div>
                    <Paragraph
                      className="assistant-management-description"
                      ellipsis={{ rows: 3 }}
                    >
                      {assistant.description || "这个助手还没有描述。"}
                    </Paragraph>
                    <div className="assistant-management-footer">
                      {isCurrent ? (
                        <Tag icon={<CheckCircleOutlined />} color="success">
                          当前助手
                        </Tag>
                      ) : (
                        <span />
                      )}
                      <Button
                        type={isCurrent ? "default" : "primary"}
                        disabled={isCurrent}
                        loading={switchingId === assistant.id}
                        onClick={() => handleSwitchAssistant(assistant)}
                      >
                        {isCurrent ? "正在使用" : "切换"}
                      </Button>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty description="暂无可用助手" />
        )}
      </Spin>

      {currentAssistant ? (
        <Space className="assistant-management-current" size={8}>
          <CheckCircleOutlined />
          <span>
            当前智能助手：{currentAssistant.displayName || currentAssistant.username}
          </span>
        </Space>
      ) : null}
    </div>
  );
}
