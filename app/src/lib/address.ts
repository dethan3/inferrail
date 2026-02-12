export function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

export function shortAddress(value: string): string {
  if (value.length < 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
