import { useState } from "react";
import {
  Clapperboard,
  Gamepad2,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Users
} from "lucide-react";
import type { OrchestratorSnapshot, ViewId } from "../types";
import { LauncherViewportScene } from "./LauncherViewportScene";

interface GamesScreenProps {
  snapshot: OrchestratorSnapshot | null;
  onSetView: (view: ViewId) => void;
  onOpenSettings: () => void;
}

export function GamesScreen({
  snapshot,
  onSetView,
  onOpenSettings
}: GamesScreenProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const projects = snapshot?.projects ?? [];
  const selectedProject = projects.find((project) => project.isSelected) ?? null;
  const activeView = snapshot?.activeView;
  const studioNavItems = [
    {
      icon: <Monitor size={17} />,
      title: "Dream Studio",
      subtitle: "World Editor",
      view: "blob" as ViewId,
      disabled: !snapshot
    },
    {
      icon: <Clapperboard size={17} />,
      title: "Animation Studio",
      subtitle: "Motion Editor",
      view: "animation-studio" as ViewId,
      disabled: !snapshot
    },
    {
      icon: <Users size={17} />,
      title: "Character Studio",
      subtitle: "Character Editor",
      view: "character-studio" as ViewId,
      disabled: !snapshot
    },
    {
      icon: <Gamepad2 size={17} />,
      title: "Game",
      subtitle: "Play Mode",
      view: "game" as ViewId,
      disabled: !snapshot || !selectedProject
    }
  ];

  return (
    <div className={`games-screen-overlay ${sidebarCollapsed ? "games-screen-overlay-collapsed" : ""}`}>
      <aside
        className={`games-sidebar ${sidebarCollapsed ? "games-sidebar-collapsed" : ""}`}
        aria-label="Launcher sidebar"
      >
        <header className="games-sidebar-header">
          <span className="games-app-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="games-app-copy">
            <span className="games-app-title">Dream Studio</span>
          </span>
          <button
            type="button"
            className="games-sidebar-toggle"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </header>

        <nav className="games-sidebar-menu" aria-label="Studio navigation">
          {studioNavItems.map((item) => (
            <button
              key={item.title}
              type="button"
              aria-label={`${item.title}, ${item.subtitle}`}
              title={sidebarCollapsed ? item.title : undefined}
              className={`games-sidebar-nav-item ${
                activeView === item.view ? "games-sidebar-nav-item-active" : ""
              }`}
              disabled={item.disabled}
              onClick={() => onSetView(item.view)}
            >
              <span className="games-sidebar-nav-icon">{item.icon}</span>
              <span className="games-sidebar-nav-copy">
                <span>{item.title}</span>
                <span>{item.subtitle}</span>
              </span>
            </button>
          ))}

          <span className="games-sidebar-separator" aria-hidden="true" />

          <button
            type="button"
            className="games-sidebar-nav-item"
            onClick={onOpenSettings}
            aria-label="Settings, Projects and Editors"
            title={sidebarCollapsed ? "Settings" : undefined}
          >
            <span className="games-sidebar-nav-icon">
              <Settings size={17} />
            </span>
            <span className="games-sidebar-nav-copy">
              <span>Settings</span>
              <span>Projects &amp; Editors</span>
            </span>
          </button>
        </nav>
      </aside>

      <main className="games-panel">
        <LauncherViewportScene />
        <section className="games-hero" aria-labelledby="games-title">
          <h1 id="games-title">Start building</h1>
          <p>Open a fresh project, jump into the editor, and keep the rest of your work close by.</p>
          <button type="button" className="games-hero-cta" onClick={onOpenSettings}>
            <Plus size={17} />
            <span>Create a new game</span>
          </button>
        </section>
      </main>
    </div>
  );
}
