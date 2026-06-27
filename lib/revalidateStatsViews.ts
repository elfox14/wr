import { revalidatePath, revalidateTag } from 'next/cache';

const STATS_RELATED_PATHS = ['/', '/statistics', '/groups', '/round-of-32'];
const STATS_RELATED_TAGS = ['home-dashboard'];

export function revalidateStatsViews(reason = 'stats-updated') {
  const result = {
    reason,
    paths: [] as string[],
    tags: [] as string[],
    errors: [] as string[],
  };

  for (const tag of STATS_RELATED_TAGS) {
    try {
      revalidateTag(tag, 'max');
      result.tags.push(tag);
    } catch (error: any) {
      result.errors.push(`tag:${tag}:${error?.message || String(error)}`);
    }
  }

  for (const path of STATS_RELATED_PATHS) {
    try {
      revalidatePath(path);
      result.paths.push(path);
    } catch (error: any) {
      result.errors.push(`path:${path}:${error?.message || String(error)}`);
    }
  }

  if (result.errors.length) {
    console.warn('[stats-cache] partial revalidation failure:', result);
  }

  return result;
}
