// Match the native TCP executor's two threads; do not queue hundreds of native
// connect/destroy operations. Let started attempts finish before returning.
export function createLanFailureTracker() {
  let failure: Error | null = null;
  return {
    capture(error: unknown) {
      const code = (error as { code?: string } | null)?.code;
      if (error instanceof Error && code?.startsWith('LOCAL_')) failure = error;
    },
    getError: () => failure,
  };
}

export async function scanLanHosts(
  hosts: string[],
  attempt: (host: string) => Promise<void>,
  options: {
    found: () => boolean;
    progress?: (completed: number, total: number) => void;
    now?: () => number;
    budgetMs?: number;
  },
) {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? 20_000);
  let cursor = 0;
  let completed = 0;
  const worker = async () => {
    while (cursor < hosts.length && now() < deadline && !options.found()) {
      const host = hosts[cursor++];
      await attempt(host);
      completed++;
      options.progress?.(completed, hosts.length);
    }
  };
  await Promise.all([worker(), worker()]);
  return { completed, exhausted: cursor === hosts.length };
}
