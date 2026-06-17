declare module '@/lib/live-match-stats' {
  export function publicSnapshot(row: any): (Record<string, any> & { [key: string]: any }) | null;
}
