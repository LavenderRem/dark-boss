import { Button, Space, Tag, Typography } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  DndContext,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import type { Task, TaskStatus, Agent } from '@dark-boss/shared';
import { TaskCard } from './task-card';
import { getWipLimits } from '../utils/wip-limits.js';

const { Text } = Typography;
const COLUMNS: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'backlog', label: '待规划', color: '#8b949e' },
  { status: 'todo', label: '待办', color: '#00d992' },
  { status: 'in_progress', label: '进行中', color: '#ffba00' },
  { status: 'review', label: '审核中', color: '#722ed1' },
  { status: 'done', label: '已完成', color: '#00d992' },
];

interface SortableTaskCardProps {
  task: Task;
  agents: Agent[];
  onClick: (task: Task, event?: React.MouseEvent) => void;
  selectedTaskIds: Set<string>;
}

function SortableTaskCard({ task, agents, onClick, selectedTaskIds }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 8,
    border: selectedTaskIds.has(task.id) ? '1px solid #00d992' : undefined,
    borderRadius: selectedTaskIds.has(task.id) ? 6 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} agents={agents} onClick={onClick} />
    </div>
  );
}

interface KanbanViewProps {
  tasks: Task[];
  agents: Agent[];
  activeTask: Task | null;
  sensors: any;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onTaskClick: (task: Task, event?: React.MouseEvent) => void;
  onQuickCreate: (status: TaskStatus) => void;
  selectedTaskIds: Set<string>;
}

export function KanbanView({
  tasks,
  agents,
  activeTask,
  sensors,
  onDragStart,
  onDragEnd,
  onTaskClick,
  onQuickCreate,
  selectedTaskIds,
}: KanbanViewProps) {
  const getTasksByStatus = (status: TaskStatus) => tasks.filter(t => t.status === status);
  const wipLimits = getWipLimits();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', gap: 12, flex: 1, overflow: 'auto' }}>
        {COLUMNS.map(col => {
          const columnTasks = getTasksByStatus(col.status);
          return (
            <div
              key={col.status}
              style={{
                flex: 1,
                minWidth: 240,
                background: '#050507',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* 列头 */}
              <div
                style={{
                  padding: '10px 14px',
                  borderBottom: '1px solid #3d3a39',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Space>
                  <span
                    style={{ width: 10, height: 10, borderRadius: '50%', background: col.color, display: 'inline-block' }}
                  />
                  <Text style={{ color: '#f2f2f2', fontWeight: 600 }}>{col.label}</Text>
                  {wipLimits[col.status] ? (
                    <Tag
                      style={{
                        background: columnTasks.length >= wipLimits[col.status] ? 'rgba(251, 86, 91, 0.2)' : 'rgba(0, 217, 146, 0.2)',
                        color: columnTasks.length >= wipLimits[col.status] ? '#fb565b' : '#00d992',
                        border: columnTasks.length >= wipLimits[col.status] ? '1px solid #fb565b' : '1px solid #00d992',
                        fontSize: 11,
                      }}
                    >
                      {columnTasks.length} / {wipLimits[col.status]}
                    </Tag>
                  ) : (
                    <Tag
                      style={{ background: '#3d3a39', color: '#8b949e', border: 'none', fontSize: 11 }}
                    >
                      {columnTasks.length}
                    </Tag>
                  )}
                </Space>
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  style={{ color: '#595959' }}
                  onClick={() => onQuickCreate(col.status)}
                />
              </div>

              {/* 列内容 */}
              <SortableContext
                id={col.status}
                items={columnTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div style={{ padding: 8, flex: 1, overflow: 'auto', minHeight: 100 }}>
                  {columnTasks.map(task => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      agents={agents}
                      onClick={onTaskClick}
                      selectedTaskIds={selectedTaskIds}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeTask ? (
          <div style={{ opacity: 0.85, transform: 'rotate(2deg)' }}>
            <TaskCard task={activeTask} agents={agents} onClick={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
