import {
  Clapperboard,
  Gamepad2,
  Home,
  Lock,
  Monitor,
  Play,
  Plus,
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

        <div className="games-sidebar-card" role="navigation" aria-label="View switcher">
          <SidebarButton
            active
            disabled={!snapshot}
            icon={<Home size={14} />}
            label="Games"
            subtitle="Launcher"
            onClick={onClose}
          />
          <SidebarButton
            disabled={!snapshot}
            icon={<Monitor size={14} />}
            label="World Studio"
            subtitle="World editor"
            onClick={() => onSetView("blob")}
          />
          <SidebarButton
            disabled={!snapshot}
            icon={<Clapperboard size={14} />}
            label="Animation Studio"
            subtitle="Motion editor"
            onClick={() => onSetView("animation-studio")}
          />
          <SidebarButton
            disabled={!snapshot}
            icon={<Users size={14} />}
            label="Character Studio"
            subtitle="Character editor"
            onClick={() => onSetView("character-studio")}
          />
          <SidebarButton
            disabled={!snapshot || !selectedProject}
            icon={<Gamepad2 size={14} />}
            label={selectedProject?.name ?? "Game"}
            subtitle="Play mode"
            onClick={() => onSetView("game")}
          />
          <div className="games-sidebar-divider" />
          <SidebarButton
            disabled={!snapshot}
            icon={<Settings2 size={14} />}
            label="Settings"
            subtitle="Projects & editors"
            onClick={onOpenSettings}
          />
        </div>
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

function SidebarButton({
  active = false,
  disabled,
  icon,
  label,
  subtitle,
  onClick
}: {
  active?: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`games-sidebar-button ${active ? "games-sidebar-button-active" : ""}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="games-sidebar-button-icon">{icon}</span>
      <span className="games-sidebar-button-copy">
        <span>{label}</span>
        <span>{subtitle}</span>
      </span>
    </button>
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
