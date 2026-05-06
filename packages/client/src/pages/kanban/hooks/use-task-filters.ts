import { useState, useMemo } from 'react';
import type { Task, TaskPriority } from '@dark-boss/shared';

export function useTaskFilters(tasks: Task[]) {
  const [searchText, setSearchText] = useState('');
  const [filterAgent, setFilterAgent] = useState<string | undefined>();
  const [filterDept, setFilterDept] = useState<string | undefined>();
  const [filterPriority, setFilterPriority] = useState<TaskPriority | undefined>();
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchText) {
        const lower = searchText.toLowerCase();
        if (!t.title.toLowerCase().includes(lower) && !(t.description || '').toLowerCase().includes(lower)) return false;
      }
      if (filterAgent && t.assignedAgentId !== filterAgent) return false;
      if (filterDept && t.departmentId !== filterDept) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      const tags: string[] = Array.isArray(t.tags) ? t.tags : typeof t.tags === 'string' ? JSON.parse(t.tags) : [];
      if (filterTags.length > 0 && !tags.some((tag: string) => filterTags.includes(tag))) return false;
      return true;
    });
  }, [tasks, searchText, filterAgent, filterDept, filterPriority, filterTags]);

  return {
    searchText,
    setSearchText,
    filterAgent,
    setFilterAgent,
    filterDept,
    setFilterDept,
    filterPriority,
    setFilterPriority,
    filterTags,
    setFilterTags,
    filteredTasks,
  };
}
