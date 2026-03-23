"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { ApiError, setApiErrorHandler } from "@/shared/api";

function getErrorTitle(error: ApiError): string {
  if (error.status === 401) return "Unauthorized request";
  if (error.status === 404) return "Resource not found";
  if (error.status >= 500) return "Server error";
  return "Request failed";
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (
                error instanceof ApiError &&
                (error.status === 401 || error.status === 404)
              ) {
                return false;
              }
              return failureCount < 1;
            },
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  useEffect(() => {
    setApiErrorHandler((error) => {
      toast.error(getErrorTitle(error), {
        description: error.message,
      });
    });

    return () => setApiErrorHandler(null);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster theme="dark" richColors position="top-right" />
    </QueryClientProvider>
  );
}
