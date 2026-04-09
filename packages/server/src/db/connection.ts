import initSqlJs, { Database } from 'sql.js';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

let db: Database;
const dataDir = path.join(os.homedir(), '.dark-boss');
const dbPath = path.join(dataDir, 'data.db');

// 初始化数据库
export async function initDatabase(): Promise<Database> {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const SQL = await initSqlJs();

  // 如果已有数据库文件，加载它
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // 启用外键
  db.run('PRAGMA foreign_keys = ON');
  db.run('PRAGMA journal_mode = WAL');

  // 创建表
  createTables();

  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      parent_id TEXT REFERENCES departments(id),
      head_agent_id TEXT,
      color TEXT DEFAULT '#1890ff',
      icon TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'offline',
      session_id TEXT,
      cwd TEXT NOT NULL,
      model TEXT DEFAULT 'sonnet',
      permission_mode TEXT DEFAULT 'bypass',
      tokens_used INTEGER DEFAULT 0,
      total_cost REAL DEFAULT 0,
      current_task TEXT,
      current_tool TEXT,
      department_id TEXT REFERENCES departments(id),
      boss_agent_id TEXT,
      is_boss INTEGER DEFAULT 0,
      custom_instructions TEXT,
      allowed_tools TEXT,
      mcp_servers TEXT,
      template_id TEXT,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      nodes TEXT NOT NULL DEFAULT '[]',
      edges TEXT NOT NULL DEFAULT '[]',
      current_step_index INTEGER DEFAULT -1,
      variables TEXT,
      department_id TEXT REFERENCES departments(id),
      created_by TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_run_at INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      priority TEXT NOT NULL DEFAULT 'medium',
      assigned_agent_id TEXT REFERENCES agents(id),
      department_id TEXT REFERENCES departments(id),
      created_by_agent_id TEXT REFERENCES agents(id),
      workflow_id TEXT REFERENCES workflows(id),
      workflow_node_id TEXT,
      column_order REAL DEFAULT 0,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      started_at INTEGER,
      completed_at INTEGER,
      due_at INTEGER,
      result TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      role TEXT NOT NULL,
      custom_instructions TEXT,
      allowed_tools TEXT,
      mcp_servers TEXT,
      model TEXT DEFAULT 'sonnet',
      author TEXT DEFAULT 'system',
      version TEXT DEFAULT '1.0.0',
      is_builtin INTEGER DEFAULT 0,
      install_count INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS agent_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      session_id TEXT,
      event_type TEXT NOT NULL,
      tool_name TEXT,
      tool_input TEXT,
      tool_output TEXT,
      text_content TEXT,
      tokens TEXT,
      cost REAL,
      duration_ms INTEGER,
      error TEXT,
      metadata TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_events_agent ON agent_events(agent_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_events_created ON agent_events(created_at)`);

  save();
}

// 保存数据库到文件
export function save() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

// 获取数据库实例
export function getDb(): Database {
  if (!db) throw new Error('数据库未初始化');
  return db;
}

// 执行查询并返回对象数组
export function queryAll<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
  const d = getDb();
  const stmt = d.prepare(sql);
  if (params) stmt.bind(params);
  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return results;
}

// 执行查询返回单行
export function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
  const results = queryAll<T>(sql, params);
  return results[0];
}

// 执行写操作
export function run(sql: string, params?: unknown[]) {
  const d = getDb();
  if (params) {
    d.run(sql, params);
  } else {
    d.run(sql);
  }
  save();
}
