import {
  Clapperboard,
  Gamepad2,
  Lock,
  Monitor,
  Play,
  Plus,
  Settings,
  Settings2,
  Square,
  Users,
  X
} from "lucide-react";
import type { OrchestratorSnapshot, ProjectSnapshot, ViewId } from "../types";

interface GamesScreenProps {
  snapshot: OrchestratorSnapshot | null;
  busyKey: string | null;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onSelect: (id: string) => void;
  onSetView: (view: ViewId) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function GamesScreen({
  snapshot,
  busyKey,
  onStart,
  onStop,
  onSelect,
  onSetView,
  onOpenSettings,
  onClose
}: GamesScreenProps) {
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
    <div className="games-screen-overlay">
      <aside className="games-sidebar" aria-label="Launcher sidebar">
        <nav className="games-sidebar-menu" aria-label="Studio navigation">
          {studioNavItems.map((item) => (
            <button
              key={item.title}
              type="button"
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

          <button type="button" className="games-sidebar-nav-item" onClick={onOpenSettings}>
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
        <button type="button" className="games-close-btn icon-btn" onClick={onClose} aria-label="Close">
          <X size={14} />
        </button>

        <section className="games-hero" aria-labelledby="games-title">
          <h1 id="games-title">Start building</h1>
          <p>Open a fresh project, jump into the editor, and keep the rest of your work close by.</p>
          <button type="button" className="games-hero-cta" onClick={onOpenSettings}>
            <Plus size={17} />
            <span>Create a new project</span>
          </button>
        </section>

        <section className="games-projects" aria-label="Registered games">
          <h2>Pick up where you left off.</h2>

          {projects.length > 0 ? (
            <div className="games-project-grid">
              {projects.map((project) => (
                <GameProjectCard
                  key={project.id}
                  project={project}
                  busyKey={busyKey}
                  onSelect={onSelect}
                  onStart={onStart}
                  onStop={onStop}
                />
              ))}
            </div>
          ) : (
            <div className="games-empty-main">
              <div className="games-empty-preview">
                <span className="games-project-status">
                  <Lock size={13} />
                  Private
                </span>
                <span className="games-project-settings">
                  <Settings2 size={12} />
                </span>
                <span className="games-project-placeholder">No preview</span>
              </div>
              <div className="games-empty-copy">
                <h3>New project</h3>
                <p>Updated 1w ago</p>
              </div>
            </div>
          )}
        </section>

        <section className="games-featured" aria-label="Featured projects">
          <h2>Featured projects</h2>
        </section>
      </main>
    </div>
  );
}

function GameProjectCard({
  project,
  busyKey,
  onSelect,
  onStart,
  onStop
}: {
  project: ProjectSnapshot;
  busyKey: string | null;
  onSelect: (id: string) => void;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
}) {
  const { status } = project.runtime;
  const isRunning = status === "running";
  const isStarting = status === "starting";

  return (
    <article className={`games-project-card ${project.isSelected ? "games-project-card-selected" : ""}`}>
      <button type="button" className="games-project-preview" onClick={() => onSelect(project.id)}>
        <span className="games-project-status">
          <Lock size={13} />
          Private
        </span>
        <span className="games-project-settings">
          <Settings2 size={12} />
        </span>
        <span className="games-project-placeholder">No preview</span>
      </button>

      <div className="games-project-meta">
        <button type="button" className="games-project-title" onClick={() => onSelect(project.id)}>
          {project.name}
        </button>

        <div className="games-project-actions">
          {isRunning ? (
            <button
              type="button"
              className="icon-btn"
              title="Stop"
              onClick={() => onStop(project.id)}
              disabled={busyKey === `stop:${project.id}`}
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              type="button"
              className="icon-btn"
              title="Start"
              onClick={() => onStart(project.id)}
              disabled={busyKey === `start:${project.id}` || isStarting}
            >
              <Play size={12} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
