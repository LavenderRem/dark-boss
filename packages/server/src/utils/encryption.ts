import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;

// 项目根目录下的 .env 路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../../.env');

function getKey(): Buffer {
  const key = process.env.DB_ENCRYPTION_KEY;
  if (key) return Buffer.from(key, 'hex');

  // 首次运行自动生成密钥并写入 .env
  const newKey = crypto.randomBytes(32).toString('hex');
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  if (!envContent.includes('DB_ENCRYPTION_KEY')) {
    envContent += `\nDB_ENCRYPTION_KEY=${newKey}\n`;
    fs.writeFileSync(envPath, envContent);
  }
  process.env.DB_ENCRYPTION_KEY = newKey;
  console.log('[加密] 已自动生成 DB_ENCRYPTION_KEY 并写入 .env');
  return Buffer.from(newKey, 'hex');
}

/** 加密明文，返回 "iv:authTag:ciphertext" (Base64) */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

/** 解密 "iv:authTag:ciphertext" 格式密文，失败返回空字符串 */
export function decrypt(ciphertext: string): string {
  if (!ciphertext) return '';
  try {
    const key = getKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) return '';
    const [ivB64, authTagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    console.warn('[加密] 解密失败，可能密钥已变更，请重新配置 API Key');
    return '';
  }
}

/** 脱敏 API Key */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  if (apiKey.length <= 6) return '***';
  return `***...${apiKey.slice(-3)}`;
}