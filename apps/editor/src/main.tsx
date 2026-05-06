import React from "react";
import ReactDOM from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles.css";

const isPlayPage = window.location.pathname === "/play";

(async () => {
  if (isPlayPage) {
    const { PlayPage } = await import("@/app/PlayPage");

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <PlayPage />
      </React.StrictMode>
    );
  } else {
    const { bootstrapEngine } = await import("@/lib/engine-bootstrap");
    const { App } = await import("@/app/App");

    await bootstrapEngine();

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </React.StrictMode>
    );
  }
})();
