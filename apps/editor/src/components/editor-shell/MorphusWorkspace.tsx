import { Code2, ExternalLink, FileCode2, Folder, Gamepad2, LayoutPanelLeft, X } from "lucide-react";
import { useMemo, useState } from "react";
import { buildGameBlobUrl } from "@/lib/game-html";
import type { CopilotImageAttachment, CopilotSession } from "@/lib/copilot/types";
import type { MorphusFileRecord } from "@/lib/copilot/morphus-memory";
import { CopilotPanel } from "@/components/editor-shell/CopilotPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MorphusWorkspaceProps = {
  files: MorphusFileRecord[];
  isConfigured: boolean;
  latestGame: { title: string; html: string } | null;
  onAbort: () => void;
  onClearGame: () => void;
  onClearHistory: () => void;
  onClose: () => void;
  onPlayInViewport?: () => void;
  onSendMessage: (prompt: string, images?: CopilotImageAttachment[]) => void;
  onSettingsChanged: () => void;
  session: CopilotSession;
};

export function MorphusWorkspace({
  files,
  isConfigured,
  latestGame,
  onAbort,
  onClearGame,
  onClearHistory,
  onClose,
  onPlayInViewport,
  onSendMessage,
  onSettingsChanged,
  session
}: MorphusWorkspaceProps) {
  const fallbackFiles = useMemo<MorphusFileRecord[]>(
    () =>
      files.length > 0
        ? files
        : [
            {
              content:
                "<!-- Morphus will generate your playable HTML game here. -->\n<div id=\"game\"></div>",
              language: "html",
              path: "index.html",
              updatedAt: Date.now()
            },
            {
              content:
                "// Ask Morphus for a browser game and the generated code will be saved in IndexedDB.",
              language: "javascript",
              path: "index.js",
              updatedAt: Date.now()
            }
          ],
    [files]
  );
  const [activePath, setActivePath] = useState(fallbackFiles[0]?.path ?? "index.html");
  const activeFile = fallbackFiles.find((file) => file.path === activePath) ?? fallbackFiles[0];

  const openGame = () => {
    if (!latestGame) {
      return;
    }

    window.open(buildGameBlobUrl(latestGame.html), "_blank");
  };

  return (
    <div className="absolute inset-0 z-40 flex overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0f14] shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-white/8 bg-[#11161d]">
        <div className="flex h-12 items-center justify-between border-b border-white/8 px-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-white/44 uppercase">
            <Folder className="size-3.5" />
            Explorer
          </div>
          <LayoutPanelLeft className="size-3.5 text-white/28" />
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {fallbackFiles.map((file) => (
            <button
              className={cn(
                "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[12px] transition-colors",
                activeFile.path === file.path
                  ? "border-[#f6d07d] bg-white/[0.06] text-white"
                  : "border-transparent text-white/58 hover:bg-white/[0.035] hover:text-white/82"
              )}
              key={file.path}
              onClick={() => setActivePath(file.path)}
              type="button"
            >
              <FileCode2 className="size-3.5 text-cyan-300/72" />
              <span className="truncate font-medium">{file.path}</span>
            </button>
          ))}
        </div>
        <div className="border-t border-white/8 p-3 text-[10px] leading-relaxed text-white/34">
          Chat memory and generated files are saved locally in IndexedDB.
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-[#15191f]">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/8 bg-[#1b2027] px-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-lg border border-[#f6d07d]/20 bg-[#f6d07d]/10 text-[#f6d07d]">
              <Code2 className="size-3.5" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.2em] text-white/88 uppercase">
                Morphus
              </div>
              <div className="truncate text-[10px] text-white/38">
                HTML game maker
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {latestGame && (
              <>
                <Button
                  className="editor-toolbar-button h-8 rounded-[10px] px-2.5 text-[11px]"
                  onClick={openGame}
                  size="sm"
                  variant="ghost"
                >
                  <ExternalLink className="size-3.5" />
                  Open
                </Button>
                {onPlayInViewport && (
                  <Button
                    className="editor-toolbar-button h-8 rounded-[10px] px-2.5 text-[11px]"
                    onClick={onPlayInViewport}
                    size="sm"
                    variant="ghost"
                  >
                    <Gamepad2 className="size-3.5" />
                    Play
                  </Button>
                )}
              </>
            )}
            <Button
              aria-label="Close Morphus"
              className="editor-toolbar-button size-8 rounded-[10px]"
              onClick={onClose}
              size="icon-sm"
              variant="ghost"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 overflow-hidden border-r border-white/8">
            <div className="flex h-9 items-center gap-2 border-b border-white/8 bg-[#191e25] px-3 text-[11px] text-white/52">
              <FileCode2 className="size-3.5 text-cyan-300/70" />
              {activeFile.path}
            </div>
            <pre className="h-full overflow-auto bg-[#171a1f] px-6 py-5 font-mono text-[12px] leading-6 text-slate-200">
              <code>{activeFile.content}</code>
            </pre>
          </div>

          <div className="min-h-0 bg-[#0f151a] p-3">
            <CopilotPanel
              emptyText="Describe the HTML game you want Morphus to create."
              isConfigured={isConfigured}
              latestGame={latestGame}
              onAbort={onAbort}
              onClearGame={onClearGame}
              onClearHistory={onClearHistory}
              onClose={onClose}
              onPlayInViewport={onPlayInViewport}
              onSendMessage={onSendMessage}
              onSettingsChanged={onSettingsChanged}
              placeholder="Create a playable HTML game..."
              session={session}
              title="Morphus"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
