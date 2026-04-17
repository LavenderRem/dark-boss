import { run, queryAll, save } from './connection.js';
import { v4 as uuid } from 'uuid';

export function seed() {
  const now = Date.now();

  // 预设模型提供商（独立于部门/模板数据，支持增量初始化）
  const existingProviders = queryAll('SELECT id FROM model_providers LIMIT 1');
  if (existingProviders.length === 0) {
    console.log('初始化预设模型提供商...');
    const providers = [
      { id: uuid(), name: '智谱 (GLM)', protocol: 'anthropic', baseUrl: 'https://open.bigmodel.cn/api/paas/anthropic' },
      { id: uuid(), name: 'OpenAI', protocol: 'openai', baseUrl: 'https://api.openai.com/v1' },
      { id: uuid(), name: 'Anthropic', protocol: 'anthropic', baseUrl: 'https://api.anthropic.com' },
      { id: uuid(), name: 'DeepSeek', protocol: 'openai', baseUrl: 'https://api.deepseek.com' },
    ];
    for (const p of providers) {
      run(
        'INSERT INTO model_providers (id, name, protocol, base_url, api_key, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)',
        [p.id, p.name, p.protocol, p.baseUrl, '', now],
      );
    }

    // 初始化档位映射（未指向任何提供商）
    const tiers: Array<{ tier: string; defaultModel: string }> = [
      { tier: 'haiku', defaultModel: 'glm-4-flash' },
      { tier: 'sonnet', defaultModel: 'glm-4' },
      { tier: 'opus', defaultModel: 'glm-4' },
    ];
    for (const t of tiers) {
      run(
        'INSERT INTO model_tier_mapping (tier, provider_id, model_name, updated_at) VALUES (?, NULL, ?, ?)',
        [t.tier, t.defaultModel, now],
      );
    }
  }

  // 部门和模板数据（首次初始化）
  const existing = queryAll('SELECT id FROM departments LIMIT 1');
  if (existing.length > 0) {
    console.log('数据已存在，跳过初始化');
    save();
    return;
  }

  console.log('初始化默认数据...');

  // 默认部门
  const deptId1 = uuid();
  const deptId2 = uuid();
  const deptId3 = uuid();
  const deptId4 = uuid();

  run('INSERT INTO departments (id, name, description, color, icon, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [deptId1, '技术部', '负责产品技术架构和开发', '#1890ff', '💻', 0, now, now]);
  run('INSERT INTO departments (id, name, description, parent_id, color, icon, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [deptId2, '前端组', '前端开发与 UI 实现', deptId1, '#61dafb', '⚛️', 0, now, now]);
  run('INSERT INTO departments (id, name, description, parent_id, color, icon, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [deptId3, '后端组', '后端服务与 API 开发', deptId1, '#68a063', '⚙️', 1, now, now]);
  run('INSERT INTO departments (id, name, description, color, icon, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [deptId4, '产品部', '产品规划与需求管理', '#10b981', '📋', 1, now, now]);

  // 默认模板
  const templates = [
    {
      id: uuid(), name: '前端开发工程师', slug: 'frontend-dev', category: 'frontend',
      description: '精通 React、Vue、TypeScript，负责 UI 组件开发和前端架构',
      icon: '💻', color: '#61dafb', role: 'frontend',
      tools: JSON.stringify(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']),
      instructions: '你是一名前端开发工程师，精通 React、Vue、TypeScript 和 CSS。你的职责是：编写高质量的前端代码，遵循组件化设计原则，确保代码可维护性和性能优化。',
    },
    {
      id: uuid(), name: '后端开发工程师', slug: 'backend-dev', category: 'backend',
      description: '精通 Node.js、Python、数据库设计，负责 API 和服务端逻辑',
      icon: '⚙️', color: '#68a063', role: 'backend',
      tools: JSON.stringify(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']),
      instructions: '你是一名后端开发工程师，精通 Node.js、Python 和数据库设计。你的职责是：设计和实现 RESTful API、优化数据库查询、确保系统安全性和可扩展性。',
    },
    {
      id: uuid(), name: '全栈开发工程师', slug: 'fullstack-dev', category: 'fullstack',
      description: '前后端兼顾，能独立完成完整功能模块开发',
      icon: '🔧', color: '#8b5cf6', role: 'fullstack',
      tools: JSON.stringify(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Agent']),
      instructions: '你是一名全栈开发工程师，精通前端和后端技术。你可以独立完成从数据库到 UI 的完整功能开发。',
    },
    {
      id: uuid(), name: '架构师', slug: 'architect', category: 'architecture',
      description: '负责系统架构设计、技术选型、代码审查',
      icon: '🏗️', color: '#f59e0b', role: 'architect',
      tools: JSON.stringify(['Read', 'Glob', 'Grep']),
      instructions: '你是一名软件架构师，负责系统架构设计和技术决策。你应该以只读模式工作，专注于分析和建议。',
    },
    {
      id: uuid(), name: '测试工程师', slug: 'tester', category: 'testing',
      description: '负责编写测试用例、执行测试、保障代码质量',
      icon: '🧪', color: '#ef4444', role: 'tester',
      tools: JSON.stringify(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']),
      instructions: '你是一名测试工程师，精通单元测试、集成测试和 E2E 测试。你的职责是：编写全面的测试用例、执行测试并报告结果。',
    },
    {
      id: uuid(), name: '运维工程师', slug: 'devops', category: 'devops',
      description: '负责 CI/CD、Docker、部署和基础设施管理',
      icon: '🚀', color: '#3b82f6', role: 'devops',
      tools: JSON.stringify(['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']),
      instructions: '你是一名运维工程师，精通 Docker、CI/CD、Linux 系统管理。你的职责是：配置部署流程、管理基础设施、优化系统性能。',
    },
    {
      id: uuid(), name: '产品经理', slug: 'pm', category: 'general',
      description: '负责需求分析、产品规划、编写 PRD',
      icon: '📋', color: '#10b981', role: 'pm',
      tools: JSON.stringify(['Read', 'Glob', 'Grep']),
      instructions: '你是一名产品经理，擅长需求分析和产品规划。你的职责是：分析用户需求、编写 PRD 文档、定义产品功能优先级。',
    },
  ];

  for (const t of templates) {
    run(
      `INSERT INTO templates (id, name, slug, category, description, icon, color, role, allowed_tools, custom_instructions, is_builtin, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [t.id, t.name, t.slug, t.category, t.description, t.icon, t.color, t.role, t.tools, t.instructions, now, now]
    );
  }

  save();
  console.log('默认数据初始化完成');
}
