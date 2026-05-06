import React from "react";
import ReactDOM from "react-dom/client";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles.css";

const pathname = window.location.pathname;
const isPlayPage = pathname === "/play";
const isLandingPage = pathname === "/" || pathname === "";

(async () => {
  if (isLandingPage) {
    await import("@/landing.css");
    const { LandingPage } = await import("@/app/LandingPage");

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <LandingPage />
      </React.StrictMode>
    );
  } else if (isPlayPage) {
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
