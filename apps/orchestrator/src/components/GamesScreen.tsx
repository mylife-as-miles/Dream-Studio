import {
  ChevronUp,
  Gamepad2,
  Lock,
  PenLine,
  Play,
  Plus,
  Settings2,
  Square,
  UserCircle,
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
  const recentProject = projects[0] ?? null;

  return (
    <div className="games-screen-overlay">
      <aside className="games-sidebar" aria-label="Launcher sidebar">
        <div className="games-brand">
          <span className="games-brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>BLUD</span>
        </div>

        <nav className="games-nav" aria-label="Primary">
          <button type="button" className="games-nav-item games-nav-item-active" onClick={onClose}>
            <PenLine size={18} />
            <span>Create</span>
          </button>
          <button
            type="button"
            className="games-nav-item"
            disabled={!snapshot}
            onClick={() => onSetView("blob")}
          >
            <Users size={18} />
            <span>Community</span>
          </button>
        </nav>

        <button type="button" className="games-new-project" onClick={onOpenSettings}>
          <Plus size={18} />
          <span>New project</span>
        </button>

        <section className="games-recents" aria-label="Recent projects">
          <h2>Recent</h2>
          <p>This week</p>
          {recentProject ? (
            <button
              type="button"
              className="games-recent-project"
              onClick={() => onSelect(recentProject.id)}
            >
              <span className="games-recent-thumb">
                <Gamepad2 size={15} />
              </span>
              <span>{recentProject.name}</span>
            </button>
          ) : (
            <button type="button" className="games-recent-project" onClick={onOpenSettings}>
              <span className="games-recent-thumb" />
              <span>New project</span>
            </button>
          )}
        </section>

        <div className="games-sidebar-spacer" />

        <button type="button" className="games-account" onClick={onOpenSettings}>
          <span className="games-account-avatar">
            <UserCircle size={21} />
          </span>
          <span className="games-account-copy">
            <span>BLUD</span>
            <span>Local workspace</span>
          </span>
          <ChevronUp size={15} />
        </button>
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
