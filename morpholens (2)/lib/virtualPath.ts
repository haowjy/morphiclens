
/**
 * Utility class for handling Virtual File System paths.
 * Ensures consistent normalization (removing trailing slashes, handling duplicates)
 * and safe joining of segments.
 */
export class VirtualPath {
  static readonly SEPARATOR = '/';
  
  /**
   * Joins path segments into a single normalized path.
   * Handles missing/empty segments gracefully.
   */
  static join(...parts: string[]): string {
    const raw = parts.filter(Boolean).join(this.SEPARATOR);
    return this.normalize(raw);
  }

  /**
   * Normalizes a path string:
   * - Replaces backslashes with forward slashes
   * - Deduplicates separators (// -> /)
   * - Ensures absolute paths start with /
   * - Removes trailing slashes (unless root)
   */
  static normalize(path: string): string {
    if (!path) return '';
    
    let normalized = path.replace(/\\/g, this.SEPARATOR).replace(/\/+/g, this.SEPARATOR);
    
    // Ensure absolute path logic if intended, but mostly we want to just clean it up
    if (!normalized.startsWith(this.SEPARATOR)) {
        normalized = this.SEPARATOR + normalized;
    }

    // Remove trailing slash unless it's just "/"
    if (normalized.length > 1 && normalized.endsWith(this.SEPARATOR)) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  }
  
  static dirname(path: string): string {
    const normalized = this.normalize(path);
    const lastSlash = normalized.lastIndexOf(this.SEPARATOR);
    
    if (lastSlash <= 0) return this.SEPARATOR; // Root or top-level
    return normalized.substring(0, lastSlash);
  }

  static basename(path: string): string {
    const normalized = this.normalize(path);
    if (normalized === this.SEPARATOR) return '';
    const lastSlash = normalized.lastIndexOf(this.SEPARATOR);
    return normalized.substring(lastSlash + 1);
  }
}
