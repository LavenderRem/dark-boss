/**
 * 文件浏览器 API
 * 提供目录树、文件内容、Agent 文件变更等功能
 */
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { queryAll } from '../db/connection.js';

const router = Router();

// 允许浏览的基础目录（安全限制，防止访问系统敏感目录）
const ALLOWED_BASE_DIRS = new Set([
  process.cwd(),
  path.resolve(process.cwd(), '..'),
]);

let agentDirsLoaded = false;

/** 加载 Agent 工作目录到允许列表（首次调用或创建新 Agent 后重置时查库） */
export function ensureAgentDirsLoaded(): void {
  if (agentDirsLoaded) return;
  agentDirsLoaded = true;
  try {
    const agents = queryAll<{ cwd: string }>('SELECT cwd FROM agents WHERE cwd IS NOT NULL');
    for (const agent of agents) {
      if (agent.cwd) {
        ALLOWED_BASE_DIRS.add(path.resolve(agent.cwd));
      }
    }
  } catch { /* 数据库可能还没初始化 */ }
}

/** 创建新 Agent 后调用，使下次请求时重新加载目录列表 */
export function invalidateAgentDirs(): void {
  agentDirsLoaded = false;
}

// 最大文件读取大小（1MB）
const MAX_FILE_SIZE = 1024 * 1024;

/**
 * 安全校验文件路径，防止目录穿越
 */
function safePath(inputPath: string): string | null {
  const resolved = path.resolve(inputPath);
  ensureAgentDirsLoaded();

  for (const base of ALLOWED_BASE_DIRS) {
    if (resolved.startsWith(base)) {
      return resolved;
    }
  }
  return null;
}

/**
 * 读取目录树
 * GET /files/tree?dir=xxx
 */
router.get('/tree', (req, res) => {
  try {
    const dir = req.query.dir as string || process.cwd();
    const safeDir = safePath(dir);
    if (!safeDir) return res.status(403).json({ error: '不允许访问该目录' });

    if (!fs.existsSync(safeDir)) return res.status(404).json({ error: '目录不存在' });
    const stat = fs.statSync(safeDir);
    if (!stat.isDirectory()) return res.status(400).json({ error: '路径不是目录' });

    const tree = readDirectory(safeDir, 0, 3);
    res.json(tree);
  } catch (err) {
    console.error('读取目录树失败:', err);
    res.status(500).json({ error: '读取目录树失败' });
  }
});

/**
 * 读取文件内容
 * GET /files/content?path=xxx
 */
router.get('/content', (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: '必须指定 path' });

    const safeFilePath = safePath(filePath);
    if (!safeFilePath) return res.status(403).json({ error: '不允许访问该文件' });
    if (!fs.existsSync(safeFilePath)) return res.status(404).json({ error: '文件不存在' });

    const stat = fs.statSync(safeFilePath);
    if (stat.isDirectory()) return res.status(400).json({ error: '路径是目录，不是文件' });
    if (stat.size > MAX_FILE_SIZE) return res.status(413).json({ error: '文件过大，超过 1MB 限制' });

    const content = fs.readFileSync(safeFilePath, 'utf-8');
    const ext = path.extname(safeFilePath).slice(1);

    res.json({
      path: safeFilePath,
      content,
      size: stat.size,
      ext,
      modifiedAt: stat.mtimeMs,
    });
  } catch (err) {
    console.error('读取文件失败:', err);
    res.status(500).json({ error: '读取文件失败' });
  }
});

/**
 * 获取 Agent 文件变更记录
 * GET /files/changes?agentId=xxx
 */
router.get('/changes', (req, res) => {
  try {
    const agentId = req.query.agentId as string;
    if (!agentId) return res.status(400).json({ error: '必须指定 agentId' });

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const changes = queryAll(
      'SELECT * FROM agent_file_changes WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?',
      [agentId, limit]
    );
    res.json({ changes });
  } catch (err) {
    console.error('获取文件变更失败:', err);
    res.status(500).json({ error: '获取文件变更失败' });
  }
});

/**
 * 文件 Diff 对比
 * POST /files/diff
 */
router.post('/diff', (req, res) => {
  try {
    const { oldContent, newContent, filePath } = req.body as {
      oldContent?: string;
      newContent?: string;
      filePath?: string;
    };

    // 如果提供了文件路径，从磁盘读取
    let oldText = oldContent || '';
    let newText = newContent || '';

    if (filePath) {
      const safeFilePath = safePath(filePath);
      if (!safeFilePath) return res.status(403).json({ error: '不允许访问该文件' });
      if (fs.existsSync(safeFilePath)) {
        const stat = fs.statSync(safeFilePath);
        if (stat.size <= MAX_FILE_SIZE) {
          newText = fs.readFileSync(safeFilePath, 'utf-8');
        }
      }
    }

    const diff = computeDiff(oldText, newText);
    res.json({ diff, filePath });
  } catch (err) {
    console.error('Diff 对比失败:', err);
    res.status(500).json({ error: 'Diff 对比失败' });
  }
});

// 递归读取目录结构
function readDirectory(dirPath: string, depth: number, maxDepth: number): FileTreeNode {
  const name = path.basename(dirPath);
  const stat = fs.statSync(dirPath);

  if (!stat.isDirectory()) {
    return {
      key: dirPath,
      title: name,
      isLeaf: true,
      size: stat.size,
      ext: path.extname(name).slice(1),
    };
  }

  const children: FileTreeNode[] = [];
  if (depth < maxDepth) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      // 排序：目录在前，文件在后
      const sorted = entries.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

      // 跳过 node_modules、.git 等目录
      const skipDirs = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.cache']);

      for (const entry of sorted) {
        if (entry.isDirectory() && skipDirs.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.isFile()) continue;

        try {
          children.push(readDirectory(path.join(dirPath, entry.name), depth + 1, maxDepth));
        } catch {
          // 跳过无权限访问的文件/目录
        }
      }
    } catch {
      // 跳过读取失败的目录
    }
  }

  return {
    key: dirPath,
    title: name,
    isLeaf: false,
    children,
  };
}

// 简单 Diff 算法（基于行对比）
function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const result: DiffLine[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === newLine) {
      result.push({ type: 'unchanged', lineNumber: i + 1, content: oldLine! });
    } else {
      if (oldLine !== undefined) {
        result.push({ type: 'removed', lineNumber: i + 1, content: oldLine });
      }
      if (newLine !== undefined) {
        result.push({ type: 'added', lineNumber: i + 1, content: newLine });
      }
    }
  }

  return result;
}

interface FileTreeNode {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: FileTreeNode[];
  size?: number;
  ext?: string;
}

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  lineNumber: number;
  content: string;
}

export default router;
