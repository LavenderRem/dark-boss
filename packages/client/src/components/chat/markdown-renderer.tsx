/**
 * Markdown 渲染组件
 * 支持暗色主题、代码高亮、GFM 扩展
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Button } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useState, useCallback } from 'react';

interface MarkdownRendererProps {
  content: string;
}

// 代码块组件（带语言标签和复制按钮）
function CodeBlock({ className, children }: { className?: string; children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const language = className?.replace('language-', '') || '';
  const codeText = String(children).replace(/\n$/, '');

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [codeText]);

  return (
    <div style={{ position: 'relative', margin: '8px 0' }}>
      {language && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: language ? 80 : 12,
          padding: '2px 8px',
          fontSize: 11,
          color: '#8b949e',
          background: '#0a0a0c',
          borderRadius: '0 0 4px 0',
          zIndex: 1,
        }}>
          {language}
        </div>
      )}
      <Button
        size="small"
        type="text"
        icon={<CopyOutlined />}
        onClick={handleCopy}
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          fontSize: 11,
          color: copied ? '#00d992' : '#8b949e',
          zIndex: 1,
        }}
      >
        {copied ? '已复制' : ''}
      </Button>
      <pre style={{
        background: '#0a0a0c',
        borderRadius: 6,
        padding: '12px 16px',
        overflow: 'auto',
        fontSize: 13,
        lineHeight: 1.5,
        margin: 0,
        border: '1px solid #3d3a39',
      }}>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight]}
      components={{
        // 代码块
        code({ className, children, ...props }) {
          const isInline = !className && typeof children === 'string' && !children.includes('\n');
          if (isInline) {
            return (
              <code
                style={{
                  background: '#3d3a39',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: '0.9em',
                  color: '#f2f2f2',
                }}
                {...props}
              >
                {children}
              </code>
            );
          }
          return <code className={className} {...props}>{children}</code>;
        },
        // pre 包裹代码块
        pre({ children }) {
          // 检查子元素是否是 code 块
          const child = children as React.ReactElement<{
            className?: string;
            children?: React.ReactNode;
          }>;
          if (child?.props?.className) {
            return <CodeBlock className={child.props.className}>{child.props.children}</CodeBlock>;
          }
          return <pre style={{ background: '#0a0a0c', borderRadius: 6, padding: 12 }}>{children}</pre>;
        },
        // 段落
        p({ children }) {
          return <p style={{ margin: '4px 0', lineHeight: 1.7 }}>{children}</p>;
        },
        // 标题
        h1({ children }) {
          return <h1 style={{ color: '#f2f2f2', fontSize: 18, margin: '12px 0 8px', fontWeight: 600 }}>{children}</h1>;
        },
        h2({ children }) {
          return <h2 style={{ color: '#f2f2f2', fontSize: 16, margin: '10px 0 6px', fontWeight: 600 }}>{children}</h2>;
        },
        h3({ children }) {
          return <h3 style={{ color: '#f2f2f2', fontSize: 15, margin: '8px 0 4px', fontWeight: 600 }}>{children}</h3>;
        },
        // 链接
        a({ href, children }) {
          return <a href={href} style={{ color: '#00d992', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">{children}</a>;
        },
        // 列表
        ul({ children }) {
          return <ul style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ul>;
        },
        ol({ children }) {
          return <ol style={{ paddingLeft: 20, margin: '4px 0' }}>{children}</ol>;
        },
        li({ children }) {
          return <li style={{ lineHeight: 1.7 }}>{children}</li>;
        },
        // 引用
        blockquote({ children }) {
          return (
            <blockquote style={{
              borderLeft: '3px solid #00d992',
              paddingLeft: 12,
              margin: '8px 0',
              color: '#b8b3b0',
            }}>
              {children}
            </blockquote>
          );
        },
        // 表格
        table({ children }) {
          return (
            <div style={{ overflow: 'auto', margin: '8px 0' }}>
              <table style={{
                borderCollapse: 'collapse',
                width: '100%',
                fontSize: 13,
              }}>
                {children}
              </table>
            </div>
          );
        },
        th({ children }) {
          return (
            <th style={{
              border: '1px solid #3d3a39',
              padding: '6px 12px',
              background: '#0a0a0c',
              textAlign: 'left',
              fontWeight: 600,
            }}>
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td style={{
              border: '1px solid #3d3a39',
              padding: '6px 12px',
            }}>
              {children}
            </td>
          );
        },
        // 水平线
        hr() {
          return <hr style={{ border: 'none', borderTop: '1px solid #3d3a39', margin: '12px 0' }} />;
        },
        // 粗体
        strong({ children }) {
          return <strong style={{ fontWeight: 600, color: '#f0f0f0' }}>{children}</strong>;
        },
        // 删除线
        del({ children }) {
          return <del style={{ color: '#8b949e' }}>{children}</del>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
