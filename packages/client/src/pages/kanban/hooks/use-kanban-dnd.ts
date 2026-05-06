import { useState, useCallback } from 'react';
import { useSensor, useSensors, PointerSensor, type DragStartEvent, type DragEndEvent } from '@dnd-kit/core';
import type { Task, TaskStatus } from '@dark-boss/shared';

export const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: '待规划', color: '#8b949e' },
  { status: 'todo', label: '待办', color: '#00d992' },
  { status: 'in_progress', label: '进行中', color: '#ffba00' },
  { status: 'review', label: '审核中', color: '#722ed1' },
  { status: 'done', label: '已完成', color: '#00d992' },
];

export function useKanbanDnd(
  tasks: Task[],
  onMove: (params: { id: string; status: TaskStatus; columnOrder: number }) => void
) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    setActiveTask(task || null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    const targetColumn = COLUMNS.find(c => c.status === overId);
    if (targetColumn) {
      const task = tasks.find(t => t.id === taskId);
      if (task && task.status !== targetColumn.status) {
        onMove({ id: taskId, status: targetColumn.status, columnOrder: Date.now() });
      }
      return;
    }

    const targetTask = tasks.find(t => t.id === overId);
    if (targetTask && taskId !== overId) {
      onMove({ id: taskId, status: targetTask.status, columnOrder: targetTask.columnOrder });
    }
  }, [tasks, onMove]);

  return { activeTask, sensors, handleDragStart, handleDragEnd };
}
