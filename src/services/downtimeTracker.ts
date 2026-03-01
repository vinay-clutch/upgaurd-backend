const downtimeMap = new Map<string, number>();

export function recordCheck(websiteId: string, status: string): number {
  if (status === 'Down') {
    const count = (downtimeMap.get(websiteId) || 0) + 1;
    downtimeMap.set(websiteId, count);
    return count;
  } else {
    downtimeMap.set(websiteId, 0);
    return 0;
  }
}

export function getDownCount(websiteId: string): number {
  return downtimeMap.get(websiteId) || 0;
}

export function resetDownCount(websiteId: string): void {
  downtimeMap.set(websiteId, 0);
}
