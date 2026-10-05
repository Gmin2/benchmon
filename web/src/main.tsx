import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DynamicProvider } from "@dynamic-labs-sdk/react-hooks";
import { dynamicClient } from "./dynamicClient";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

// after a deploy an open tab can ask for a screen chunk that is gone, a reload picks up the new build
addEventListener("vite:preloadError", () => {
  if (sessionStorage.getItem("benchmon:reloaded")) return;
  sessionStorage.setItem("benchmon:reloaded", "1");
  location.reload();
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <DynamicProvider client={dynamicClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </DynamicProvider>
    </QueryClientProvider>
  </StrictMode>,
);
