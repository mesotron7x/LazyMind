import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SyncOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { Navigate } from "react-router-dom";
import {
  type DesktopAssistantInfo,
  isDesktopMode,
  syncDesktopAssistantAuth,
} from "@/utils/desktop";
import "./index.scss";

const { Paragraph, Text, Title } = Typography;
const DEFAULT_ASSISTANT_USERNAME = "astronomer";

interface AssistantFormValues {
  username: string;
  displayName?: string;
  avatar?: string;
  description?: string;
}

type ModalMode = "create" | "edit";

function normalizeAssistantPayload(values: AssistantFormValues) {
  const username = values.username.trim();
  return {
    username,
    displayName: values.displayName?.trim() || username,
    avatar: values.avatar?.trim() || "🤖",
    description: values.description?.trim() || "",
  };
}

export default function AssistantManagement() {
  const desktopMode = isDesktopMode();
  const [form] = Form.useForm<AssistantFormValues>();
  const [assistants, setAssistants] = useState<DesktopAssistantInfo[]>([]);
  const [currentAssistant, setCurrentAssistant] =
    useState<DesktopAssistantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [switchingId, setSwitchingId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [editingAssistant, setEditingAssistant] =
    useState<DesktopAssistantInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const api = desktopMode ? window.lazymind : undefined;

  const currentAssistantId = currentAssistant?.id || "";
  const assistantCount = assistants.length;
  const existingUsernames = useMemo(
    () => new Set(assistants.map((assistant) => assistant.username)),
    [assistants],
  );

  const loadAssistants = useCallback(async () => {
    if (!desktopMode || !api) return;

    setLoading(true);
    try {
      const [list, current] = await Promise.all([
        api.getAssistantList(),
        api.getCurrentAssistant(),
      ]);
      const nextList = list || [];
      const nextCurrent = current?.id ? current : nextList[0] || null;

      setAssistants(nextList);
      setCurrentAssistant(nextCurrent);
      if (nextCurrent?.id) {
        syncDesktopAssistantAuth(nextCurrent);
      }
    } catch (error) {
      console.error("Failed to load assistants:", error);
      message.error("助手列表加载失败");
    } finally {
      setLoading(false);
    }
  }, [api, desktopMode]);

  useEffect(() => {
    void loadAssistants();
  }, [loadAssistants]);

  useEffect(() => {
    if (!desktopMode || !api) return;
    return api.onAssistantChange((assistant) => {
      if (!assistant?.id) return;
      setCurrentAssistant(assistant);
      syncDesktopAssistantAuth(assistant);
    });
  }, [api, desktopMode]);

  const openCreateModal = () => {
    setModalMode("create");
    setEditingAssistant(null);
    form.setFieldsValue({
      username: "",
      displayName: "",
      avatar: "🤖",
      description: "",
    });
    setModalOpen(true);
  };

  const openEditModal = (assistant: DesktopAssistantInfo) => {
    setModalMode("edit");
    setEditingAssistant(assistant);
    form.setFieldsValue({
      username: assistant.username,
      displayName: assistant.displayName || assistant.username,
      avatar: assistant.avatar || "🤖",
      description: assistant.description || "",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingAssistant(null);
    setSubmitting(false);
    form.resetFields();
  };

  const handleSubmitAssistant = async () => {
    if (!api) return;

    try {
      const values = await form.validateFields();
      const payload = normalizeAssistantPayload(values);
      setSubmitting(true);

      if (modalMode === "create") {
        const created = await api.createAssistant(payload);
        setCurrentAssistant(created);
        syncDesktopAssistantAuth(created);
        message.success(`已创建并切换到 ${created.displayName || created.username}`);
      } else if (editingAssistant?.id) {
        const updated = await api.updateAssistant(editingAssistant.id, {
          displayName: payload.displayName,
          avatar: payload.avatar,
          description: payload.description,
        });
        if (updated.id === currentAssistantId) {
          setCurrentAssistant(updated);
          syncDesktopAssistantAuth(updated);
        }
        message.success("助手信息已更新");
      }

      closeModal();
      await loadAssistants();
    } catch (error: any) {
      if (error?.errorFields) return;
      console.error("Failed to save assistant:", error);
      message.error(
        modalMode === "create" ? "助手创建失败" : "助手更新失败",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAssistant = async (assistant: DesktopAssistantInfo) => {
    if (!api) return;
    if (assistant.id === currentAssistantId) return;

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

  const handleDeleteAssistant = async (assistant: DesktopAssistantInfo) => {
    if (!api) return;

    setDeletingId(assistant.id);
    try {
      await api.deleteAssistant(assistant.id);
      const [list, current] = await Promise.all([
        api.getAssistantList(),
        api.getCurrentAssistant(),
      ]);
      setAssistants(list || []);
      setCurrentAssistant(current);
      if (current?.id) {
        syncDesktopAssistantAuth(current);
      }
      message.success("助手已删除");
    } catch (error) {
      console.error("Failed to delete assistant:", error);
      message.error("助手删除失败");
    } finally {
      setDeletingId("");
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
        <Space wrap>
          <Button
            icon={<SyncOutlined />}
            onClick={loadAssistants}
            loading={loading}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建助手
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        {assistants.length ? (
          <List
            className="assistant-management-list"
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 3, xl: 3, xxl: 4 }}
            dataSource={assistants}
            renderItem={(assistant) => {
              const isCurrent = assistant.id === currentAssistantId;
              const isDefault = assistant.username === DEFAULT_ASSISTANT_USERNAME;
              const deleteDisabled = isDefault || assistantCount <= 1;

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
                      <Space className="assistant-management-actions" size={4}>
                        <Tooltip title="编辑助手">
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            aria-label="编辑助手"
                            onClick={() => openEditModal(assistant)}
                          />
                        </Tooltip>
                        <Tooltip
                          title={
                            deleteDisabled
                              ? "默认助手或最后一个助手不能删除"
                              : "删除助手"
                          }
                        >
                          <Popconfirm
                            title="删除助手"
                            description={`确认删除 ${assistant.displayName || assistant.username}？`}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            disabled={deleteDisabled}
                            onConfirm={() => handleDeleteAssistant(assistant)}
                          >
                            <Button
                              type="text"
                              danger
                              disabled={deleteDisabled}
                              loading={deletingId === assistant.id}
                              icon={<DeleteOutlined />}
                              aria-label="删除助手"
                            />
                          </Popconfirm>
                        </Tooltip>
                      </Space>
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

      <Modal
        title={modalMode === "create" ? "新建助手" : "编辑助手"}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSubmitAssistant}
        confirmLoading={submitting}
        okText={modalMode === "create" ? "创建" : "保存"}
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <Form.Item
            name="username"
            label="用户名"
            rules={[
              { required: true, message: "请输入用户名" },
              { max: 64, message: "用户名不能超过 64 个字符" },
              {
                pattern: /^[a-zA-Z0-9_.-]+$/,
                message: "仅支持字母、数字、下划线、点和短横线",
              },
              {
                validator: (_, value) => {
                  if (
                    modalMode === "create" &&
                    value &&
                    existingUsernames.has(String(value).trim())
                  ) {
                    return Promise.reject(new Error("用户名已存在"));
                  }
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input
              disabled={modalMode === "edit"}
              placeholder="例如 writer"
            />
          </Form.Item>
          <Form.Item
            name="displayName"
            label="显示名称"
            rules={[{ max: 80, message: "显示名称不能超过 80 个字符" }]}
          >
            <Input placeholder="例如 写作助手" />
          </Form.Item>
          <Form.Item
            name="avatar"
            label="头像"
            rules={[{ max: 16, message: "头像不能超过 16 个字符" }]}
          >
            <Input placeholder="🤖" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ max: 500, message: "描述不能超过 500 个字符" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="描述这个助手适合处理的任务。"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
