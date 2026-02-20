import { useEffect, useRef, useState, useCallback } from 'react';

export function usePolling<T>(fetcher: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const stableFetcher = useRef(fetcher);
  stableFetcher.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const result = await stableFetcher.current();
        if (mounted.current) { setData(result); setError(null); }
      } catch (e: any) {
        if (mounted.current) setError(e.message);
      }
      if (mounted.current) timer = setTimeout(poll, intervalMs);
    };

    poll();
    return () => { mounted.current = false; clearTimeout(timer); };
  }, [intervalMs]);

  return { data, error };
}
