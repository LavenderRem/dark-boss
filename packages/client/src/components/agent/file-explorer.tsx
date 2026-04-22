/**
 * 文件浏览器组件
 * 左侧文件树 + 右侧文件内容/Diff 查看器
 */
import { useState, useCallback } from 'react';
import { Tree, Empty, Spin, Typography, Space, Tag, Tabs, Table } from 'antd';
import { FolderOutlined, FileOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.js';

interface FileExplorerProps {
  /** 工作目录 */
  workingDir: string;
  /** Agent ID（用于查看变更历史） */
  agentId: string;
  /** 高度 */
  height?: number | string;
}

// 文件树节点类型
interface FileNode {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: FileNode[];
  size?: number;
  ext?: string;
}

// 文件变更记录
interface FileChange {
  id: number;
  agentId: string;
  filePath: string;
  action: string;
  diffSummary: string | null;
  createdAt: number;
}

export function FileExplorer({ workingDir, agentId, height = 500 }: FileExplorerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('content');

  // 获取目录树
  const { data: treeData, isLoading: treeLoading } = useQuery({
    queryKey: ['file-tree', workingDir],
    queryFn: () => api.get<FileNode>(`/files/tree?dir=${encodeURIComponent(workingDir)}`),
    enabled: !!workingDir,
  });

  // 获取文件内容
  const { data: fileContent, isLoading: contentLoading } = useQuery({
    queryKey: ['file-content', selectedFile],
    queryFn: () => api.get<{ path: string; content: string; size: number; ext: string; modifiedAt: number }>(
      `/files/content?path=${encodeURIComponent(selectedFile!)}`
    ),
    enabled: !!selectedFile,
  });

  // 获取文件变更记录
  const { data: changesData, isLoading: changesLoading } = useQuery({
    queryKey: ['file-changes', agentId],
    queryFn: () => api.get<{ changes: FileChange[] }>(`/files/changes?agentId=${agentId}&limit=50`),
    enabled: !!agentId,
  });

  // 将树数据转换为 antd Tree 格式
  const convertToAntdTree = useCallback((node: FileNode): {
    key: string;
    title: string;
    icon: React.ReactNode;
    isLeaf: boolean;
    children?: ReturnType<typeof convertToAntdTree>[];
  } => ({
    key: node.key,
    title: node.title,
    icon: node.isLeaf
      ? <FileOutlined style={{ color: '#8b949e' }} />
      : <FolderOutlined style={{ color: '#ffba00' }} />,
    isLeaf: node.isLeaf,
    children: node.children?.map(convertToAntdTree),
  }), []);

  const antdTreeData = treeData ? [convertToAntdTree(treeData)] : [];

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const changeColumns = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 80,
      render: (action: string) => {
        const colorMap: Record<string, string> = {
          create: '#00d992',
          modify: '#00d992',
          delete: '#fb565b',
        };
        const labelMap: Record<string, string> = {
          create: '新建',
          modify: '修改',
          delete: '删除',
        };
        return <Tag color={colorMap[action] || '#8b949e'}>{labelMap[action] || action}</Tag>;
      },
    },
    {
      title: '文件路径',
      dataIndex: 'filePath',
      key: 'filePath',
      ellipsis: true,
      render: (v: string) => <span style={{ color: '#b8b3b0', fontSize: 12 }}>{v}</span>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (ts: number) => (
        <span style={{ color: '#8b949e', fontSize: 12 }}>
          {new Date(ts).toLocaleString('zh-CN')}
        </span>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', gap: 12, height }}>
      {/* 左侧文件树 */}
      <div style={{
        width: 260,
        borderRight: '1px solid #3d3a39',
        overflow: 'auto',
        paddingRight: 8,
      }}>
        <Typography.Text strong style={{ color: '#b8b3b0', fontSize: 13, display: 'block', marginBottom: 8 }}>
          文件浏览器
        </Typography.Text>
        {treeLoading ? (
          <Spin />
        ) : antdTreeData.length === 0 ? (
          <Empty description="无文件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Tree
            showIcon
            treeData={antdTreeData}
            onSelect={(keys) => {
              if (keys.length > 0 && typeof keys[0] === 'string') {
                setSelectedFile(keys[0]);
                setActiveTab('content');
              }
            }}
            style={{ background: 'transparent', color: '#f2f2f2', fontSize: 12 }}
          />
        )}
      </div>

      {/* 右侧内容区域 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          size="small"
          items={[
            {
              key: 'content',
              label: '文件内容',
              children: selectedFile && fileContent ? (
                <div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                    padding: '4px 8px',
                    background: '#101010',
                    borderRadius: 4,
                  }}>
                    <Space size={8}>
                      <Tag>{fileContent.ext || 'txt'}</Tag>
                      <span style={{ color: '#8b949e', fontSize: 12 }}>
                        {formatSize(fileContent.size)}
                      </span>
                    </Space>
                    <span style={{ color: '#8b949e', fontSize: 12 }}>
                      {new Date(fileContent.modifiedAt).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  <pre style={{
                    background: '#050507',
                    padding: 12,
                    borderRadius: 4,
                    overflow: 'auto',
                    maxHeight: height as number - 80,
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#f2f2f2',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}>
                    {fileContent.content}
                  </pre>
                </div>
              ) : selectedFile && contentLoading ? (
                <Spin />
              ) : (
                <Empty description="选择左侧文件查看内容" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ),
            },
            {
              key: 'changes',
              label: '变更历史',
              children: changesLoading ? (
                <Spin />
              ) : (
                <Table
                  dataSource={changesData?.changes || []}
                  columns={changeColumns}
                  rowKey="id"
                  size="small"
                  pagination={{ pageSize: 10, size: 'small' }}
                  style={{ background: 'transparent' }}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
