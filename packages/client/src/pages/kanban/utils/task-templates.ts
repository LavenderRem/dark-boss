export interface TaskTemplate {
  id: string;
  name: string;
  icon: string;
  description: string;
  defaultTaskType: 'epic' | 'story' | 'task';
  subtasks: string[];
  defaultTags: string[];
  defaultRole?: string;
}

export const BUILTIN_TEMPLATES: TaskTemplate[] = [
  {
    id: 'bug-fix',
    name: 'Bug 修复',
    icon: '🐛',
    description: '自动创建 3 个子任务',
    defaultTaskType: 'task',
    subtasks: ['复现并定位问题', '编写修复代码', '添加回归测试'],
    defaultTags: ['bug'],
  },
  {
    id: 'feature',
    name: '新功能开发',
    icon: '✨',
    description: '自动创建 4 个子任务',
    defaultTaskType: 'story',
    subtasks: ['需求分析与设计', '编码实现', '代码审查', '测试验证'],
    defaultTags: [],
  },
  {
    id: 'code-review',
    name: '代码审查',
    icon: '🔍',
    description: '自动分配给架构师',
    defaultTaskType: 'task',
    subtasks: ['审查代码质量', '检查安全性', '生成审查报告'],
    defaultTags: [],
    defaultRole: 'architect',
  },
];

export function getCustomTemplates(): TaskTemplate[] {
  try {
    return JSON.parse(localStorage.getItem('kanban-templates') || '[]');
  } catch {
    return [];
  }
}

export function saveCustomTemplate(template: TaskTemplate) {
  const templates = getCustomTemplates();
  templates.push(template);
  localStorage.setItem('kanban-templates', JSON.stringify(templates));
}

export function getAllTemplates(): TaskTemplate[] {
  return [...BUILTIN_TEMPLATES, ...getCustomTemplates()];
}
