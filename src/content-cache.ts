/** Exact content keys, bounded by both count and retained UTF-16 bytes. No hash collisions. */
export class ContentCache<T> {
  private entries = new Map<string, { value: T; bytes: number }>();
  private bytes = 0;
  constructor(private maxEntries = 1024, private maxBytes = 16 * 1024 * 1024) {}
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return;
    this.entries.delete(key); this.entries.set(key, entry);
    return entry.value;
  }
  set(key: string, value: T, extraBytes = 0) {
    const previous = this.entries.get(key);
    if (previous) { this.bytes -= previous.bytes; this.entries.delete(key); }
    const bytes = key.length * 2 + extraBytes;
    if (bytes > this.maxBytes || this.maxEntries < 1) return;
    while (this.entries.size && (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes)) {
      const first = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(first)!.bytes; this.entries.delete(first);
    }
    this.entries.set(key, { value, bytes }); this.bytes += bytes;
  }
}

/** JSON document comparison skips equal large strings instead of serializing them again. */
export function sameData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = Object.keys(a), right = Object.keys(b);
  if (left.length !== right.length) return false;
  return left.every(key => Object.hasOwn(b, key) && sameData((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
