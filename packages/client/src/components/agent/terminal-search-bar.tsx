/**
 * 终端搜索栏组件
 * 覆盖在 xterm 终端上方，提供文本搜索功能
 * Ctrl+F 触发，Escape 关闭
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Space } from 'antd';
import { SearchOutlined, UpOutlined, DownOutlined, CloseOutlined } from '@ant-design/icons';
import type { SearchAddon } from '@xterm/addon-search';

interface TerminalSearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

interface SearchResults {
  resultIndex: number;
  resultCount: number;
}

export function TerminalSearchBar({ searchAddon, onClose }: TerminalSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ resultIndex: -1, resultCount: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦输入框
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, []);

  // 监听搜索结果变化
  useEffect(() => {
    if (!searchAddon) return;
    const disposable = searchAddon.onDidChangeResults((e) => {
      setResults({ resultIndex: e.resultIndex, resultCount: e.resultCount });
    });
    return () => disposable.dispose();
  }, [searchAddon]);

  // 执行搜索
  const doSearch = useCallback((searchQuery: string) => {
    if (!searchAddon || !searchQuery) return;
    searchAddon.findNext(searchQuery, {
      regex: false,
      wholeWord: false,
      caseSensitive: false,
      decorations: {
        matchBackground: '#ffd43b44',
        matchBorder: '#ffd43b',
        matchOverviewRuler: '#ffd43b',
        activeMatchBackground: '#ffd43b',
        activeMatchBorder: '#ff922b',
        activeMatchColorOverviewRuler: '#ff922b',
      },
    });
  }, [searchAddon]);

  // 查询变化时自动搜索
  useEffect(() => {
    if (!searchAddon) return;
    if (!query) {
      searchAddon.clearDecorations();
      setResults({ resultIndex: -1, resultCount: 0 });
      return;
    }
    doSearch(query);
  }, [query, searchAddon, doSearch]);

  const handleFindNext = () => {
    if (!searchAddon || !query) return;
    searchAddon.findNext(query);
  };

  const handleFindPrevious = () => {
    if (!searchAddon || !query) return;
    searchAddon.findPrevious(query);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.shiftKey ? handleFindPrevious() : handleFindNext();
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 10,
        background: '#1a1a2e',
        border: '1px solid #303030',
        borderRadius: 6,
        padding: '4px 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
      onKeyDown={handleKeyDown}
    >
      <Input
        ref={inputRef as never}
        size="small"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索终端..."
        style={{
          width: 180,
          background: '#0d1117',
          borderColor: '#303030',
          color: '#e8e8e8',
          fontSize: 12,
        }}
        prefix={<SearchOutlined style={{ color: '#595959' }} />}
      />
      <span style={{ color: '#8c8c8c', fontSize: 11, minWidth: 50, textAlign: 'center' }}>
        {results.resultCount > 0
          ? `${results.resultIndex + 1}/${results.resultCount}`
          : query ? '无匹配' : ''}
      </span>
      <Space size={2}>
        <Button
          size="small"
          type="text"
          icon={<UpOutlined />}
          onClick={handleFindPrevious}
          disabled={!query || results.resultCount === 0}
          style={{ color: '#bfbfbf' }}
        />
        <Button
          size="small"
          type="text"
          icon={<DownOutlined />}
          onClick={handleFindNext}
          disabled={!query || results.resultCount === 0}
          style={{ color: '#bfbfbf' }}
        />
        <Button
          size="small"
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ color: '#8c8c8c' }}
        />
      </Space>
    </div>
  );
}
