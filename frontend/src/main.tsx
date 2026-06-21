import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      // Reduce redundant network/DB traffic: financial data only changes on
      // user actions (which invalidate the relevant queries explicitly).
      // refetchOnMount is left at its default so navigating to a page still
      // refreshes data that is stale (>staleTime) — keeps a shared family
      // workspace reasonably fresh without refetching on every focus/reconnect.
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // keep cached data for 30 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
