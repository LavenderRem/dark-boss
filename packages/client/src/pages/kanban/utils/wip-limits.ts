export function getWipLimits(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem('kanban-wip-limits') || '{}');
  } catch {
    return {};
  }
}

export function setWipLimit(status: string, limit: number | null) {
  const limits = getWipLimits();
  if (limit === null) {
    delete limits[status];
  } else {
    limits[status] = limit;
  }
  localStorage.setItem('kanban-wip-limits', JSON.stringify(limits));
}

export function checkWipLimit(
  status: string,
  currentCount: number
): { exceeded: boolean; limit: number } {
  const limits = getWipLimits();
  const limit = limits[status];
  if (!limit) {
    return { exceeded: false, limit: 0 };
  }
  return { exceeded: currentCount >= limit, limit };
}
