// 部门（组织架构树节点）
export interface Department {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  headAgentId: string | null;
  color: string;
  icon: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// 创建部门请求
export interface CreateDepartmentRequest {
  name: string;
  description?: string;
  parentId?: string | null;
  headAgentId?: string | null;
  color?: string;
  icon?: string;
}

// 部门树节点（前端使用）
export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
  agentCount: number;
}
