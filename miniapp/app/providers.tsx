'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';

// Farcaster Mini App SDK — notify host when ready
function useMiniAppReady() {
  useEffect(() => {
    // Dynamic import to avoid SSR issues
    import('@farcaster/miniapp-sdk').then(({ sdk }) => {
      sdk.actions.ready({});
    }).catch(() => {
      // Not in a Farcaster context — that's fine, works standalone too
    });
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchInterval: 30_000,
            retry: 2,
          },
        },
      })
  );

  useMiniAppReady();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
