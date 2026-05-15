import { Check, Code2, Edit3, ExternalLink, FileCode2, Folder, FolderUp, Gamepad2, LayoutPanelLeft, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
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
  onSaveFile: (path: string, content: string) => void;
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
  onSaveFile,
  onSendMessage,
  onSettingsChanged,
  session
}: MorphusWorkspaceProps) {
  const [activePath, setActivePath] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [editingPath, setEditingPath] = useState("");
  const [requestStarted, setRequestStarted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const hasConversation = session.messages.length > 0 || session.activity.length > 0;
  const workspaceActive = requestStarted || hasConversation || files.length > 0 || Boolean(latestGame);
  const activeFile = files.find((file) => file.path === activePath) ?? files[0];

  useEffect(() => {
    if (files.length === 0) {
      setActivePath("");
      return;
    }

    if (!files.some((file) => file.path === activePath)) {
      setActivePath(files[0].path);
    }
  }, [activePath, files]);

  useEffect(() => {
    if (!activeFile || editingPath !== activeFile.path) {
      return;
    }

    setDraftContent(activeFile.content);
  }, [activeFile, editingPath]);

  const openGame = () => {
    if (!latestGame) {
      return;
    }

    window.open(buildGameBlobUrl(latestGame.html), "_blank");
  };

  const sendMorphusMessage = (prompt: string, images?: CopilotImageAttachment[]) => {
    setRequestStarted(true);
    onSendMessage(prompt, images);
  };

  const handleImportChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const importedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    for (const file of importedFiles) {
      const path = getImportPath(file);
      const content = await readImportedFile(file);
      onSaveFile(path, content);
      setActivePath(path);
    }
  };

  const clearMorphusHistory = () => {
    setRequestStarted(false);
    setActivePath("");
    setEditingPath("");
    setDraftContent("");
    onClearHistory();
  };

  const startEditing = () => {
    if (!activeFile) {
      return;
    }

    setEditingPath(activeFile.path);
    setDraftContent(activeFile.content);
  };

  const cancelEditing = () => {
    setEditingPath("");
    setDraftContent("");
  };

  const saveEditing = () => {
    if (!activeFile || editingPath !== activeFile.path) {
      return;
    }

    onSaveFile(activeFile.path, draftContent);
    setEditingPath("");
    setDraftContent("");
  };

  const editingActiveFile = Boolean(activeFile && editingPath === activeFile.path);

  return (
    <div className="absolute inset-0 z-40 flex overflow-hidden rounded-[32px] border border-white/10 bg-[#0b0f14] shadow-[0_30px_90px_rgba(0,0,0,0.48)]">
      {!workspaceActive ? (
        <MorphusStart
          isConfigured={isConfigured}
          latestGame={latestGame}
          onAbort={onAbort}
          onClearGame={onClearGame}
          onClearHistory={clearMorphusHistory}
          onClose={onClose}
          onPlayInViewport={onPlayInViewport}
          onSendMessage={sendMorphusMessage}
          onSettingsChanged={onSettingsChanged}
          session={session}
        />
      ) : (
        <>
          <input
            className="hidden"
            multiple
            onChange={(event) => {
              void handleImportChange(event);
            }}
            ref={fileInputRef}
            type="file"
          />
          <input
            {...folderInputProps}
            className="hidden"
            multiple
            onChange={(event) => {
              void handleImportChange(event);
            }}
            ref={folderInputRef}
            type="file"
          />
          <aside className="flex w-56 shrink-0 flex-col border-r border-white/8 bg-[#11161d]">
        <div className="flex h-12 items-center justify-between border-b border-white/8 px-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-white/44 uppercase">
            <Folder className="size-3.5" />
            Explorer
          </div>
          <div className="flex items-center gap-1">
            <button
              className="flex size-7 items-center justify-center rounded-lg text-white/34 transition-colors hover:bg-white/[0.05] hover:text-white/76"
              onClick={() => fileInputRef.current?.click()}
              title="Import files"
              type="button"
            >
              <Upload className="size-3.5" />
            </button>
            <button
              className="flex size-7 items-center justify-center rounded-lg text-white/34 transition-colors hover:bg-white/[0.05] hover:text-white/76"
              onClick={() => folderInputRef.current?.click()}
              title="Import folder"
              type="button"
            >
              <FolderUp className="size-3.5" />
            </button>
            <LayoutPanelLeft className="size-3.5 text-white/28" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {files.length === 0 ? (
            <div className="px-3 py-4 text-[11px] leading-relaxed text-white/34">
              Files will appear here after Morphus generates a game.
            </div>
          ) : null}
          {files.map((file) => (
            <button
              className={cn(
                "flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[12px] transition-colors",
                activeFile?.path === file.path
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
              <FileCode2 className="size-3.5 shrink-0 text-cyan-300/70" />
              <span className="min-w-0 flex-1 truncate">{activeFile?.path ?? "No file selected"}</span>
              {activeFile && activeFile.language !== "asset" && (
                <div className="flex items-center gap-1">
                  {editingActiveFile ? (
                    <>
                      <Button
                        className="editor-toolbar-button h-7 rounded-[9px] px-2 text-[10px]"
                        onClick={cancelEditing}
                        size="sm"
                        variant="ghost"
                      >
                        <X className="size-3" />
                        Cancel
                      </Button>
                      <Button
                        className="h-7 rounded-[9px] border border-emerald-400/20 bg-emerald-500/20 px-2 text-[10px] font-medium text-emerald-200 hover:bg-emerald-500/30"
                        onClick={saveEditing}
                        size="sm"
                        variant="ghost"
                      >
                        <Check className="size-3" />
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button
                      className="editor-toolbar-button h-7 rounded-[9px] px-2 text-[10px]"
                      onClick={startEditing}
                      size="sm"
                      variant="ghost"
                    >
                      <Edit3 className="size-3" />
                      Edit
                    </Button>
                  )}
                </div>
              )}
            </div>
            {activeFile ? (
              activeFile.language === "asset" ? (
                <div className="flex h-full items-center justify-center bg-[#171a1f] px-6 text-center">
                  <div className="max-w-md">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-xl border border-[#f6d07d]/20 bg-[#f6d07d]/10 text-[#f6d07d]">
                      <FileCode2 className="size-5" />
                    </div>
                    <div className="mt-4 text-[11px] font-semibold tracking-[0.18em] text-white/72 uppercase">
                      Asset imported
                    </div>
                    <p className="mt-2 break-all text-[11px] leading-relaxed text-white/38">
                      {activeFile.path}
                    </p>
                    <p className="mt-3 text-[11px] leading-relaxed text-white/34">
                      Binary assets are stored locally as data URLs and can be referenced by generated HTML, CSS, or JavaScript.
                    </p>
                  </div>
                </div>
              ) : editingActiveFile ? (
                <textarea
                  className="h-full w-full resize-none overflow-auto border-0 bg-[#171a1f] px-6 py-5 font-mono text-[12px] leading-6 text-slate-100 outline-none selection:bg-emerald-400/20"
                  onChange={(event) => setDraftContent(event.target.value)}
                  spellCheck={false}
                  value={draftContent}
                />
              ) : (
                <pre className="h-full overflow-auto bg-[#171a1f] px-6 py-5 font-mono text-[12px] leading-6 text-slate-200">
                  <code>{activeFile.content}</code>
                </pre>
              )
            ) : (
              <div className="flex h-full items-center justify-center bg-[#171a1f] px-6 text-center">
                <div className="max-w-xs">
                  <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-cyan-200/70">
                    <FileCode2 className="size-4" />
                  </div>
                  <div className="mt-4 text-[11px] font-semibold tracking-[0.18em] text-white/62 uppercase">
                    Waiting for files
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-white/36">
                    Morphus will place generated HTML and JavaScript here once the first response completes.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 bg-[#0f151a] p-3">
            <CopilotPanel
              emptyText="Describe the HTML game you want Morphus to create."
              isConfigured={isConfigured}
              latestGame={latestGame}
              onAbort={onAbort}
              onClearGame={onClearGame}
              onClearHistory={clearMorphusHistory}
              onClose={onClose}
              onPlayInViewport={onPlayInViewport}
              onSendMessage={sendMorphusMessage}
              onSettingsChanged={onSettingsChanged}
              placeholder="Create a playable HTML game..."
              session={session}
              title="Morphus"
            />
          </div>
        </div>
      </section>
        </>
      )}
    </div>
  );
}

const folderInputProps = {
  directory: "",
  webkitdirectory: ""
} as InputHTMLAttributes<HTMLInputElement> & {
  directory: string;
  webkitdirectory: string;
};

function getImportPath(file: File) {
  const maybeRelative = file as File & { webkitRelativePath?: string };
  return (maybeRelative.webkitRelativePath || file.name).replace(/\\/g, "/");
}

function readImportedFile(file: File): Promise<string> {
  if (isTextLikeFile(file)) {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

function isTextLikeFile(file: File) {
  const lower = file.name.toLowerCase();
  return (
    file.type.startsWith("text/") ||
    /\.(html?|css|m?js|ts|tsx|jsx|json|gltf|glsl|wgsl|md|txt|csv|xml|svg|obj|mtl)$/i.test(lower)
  );
}

function MorphusStart({
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
}: Omit<MorphusWorkspaceProps, "files" | "onSaveFile">) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b0f14]">
      <header className="absolute inset-x-0 top-0 z-10 flex h-14 items-center justify-between px-5">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-xl border border-[#f6d07d]/20 bg-[#f6d07d]/10 text-[#f6d07d]">
            <Code2 className="size-4" />
          </span>
          <div>
            <div className="text-[11px] font-semibold tracking-[0.22em] text-white/86 uppercase">
              Morphus
            </div>
            <div className="text-[10px] text-white/38">HTML game maker</div>
          </div>
        </div>
        <Button
          aria-label="Close Morphus"
          className="editor-toolbar-button size-8 rounded-[10px]"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <X className="size-3.5" />
        </Button>
      </header>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(52,211,153,0.16),transparent_28%),radial-gradient(circle_at_72%_70%,rgba(56,189,248,0.1),transparent_26%),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[length:auto,auto,72px_72px,72px_72px]" />

      <div className="relative z-0 flex min-h-0 flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-2xl">
          <div className="mb-5 text-center">
            <h2 className="text-3xl font-semibold tracking-normal text-white">Create Anything</h2>
            <p className="mt-2 text-sm text-white/42">Describe the playable HTML game you want to build.</p>
          </div>
          <div className="mx-auto h-[28rem] max-w-xl">
            <CopilotPanel
              emptyText="Tell Morphus what to make."
              isConfigured={isConfigured}
              latestGame={latestGame}
              onAbort={onAbort}
              onClearGame={onClearGame}
              onClearHistory={onClearHistory}
              onClose={onClose}
              onPlayInViewport={onPlayInViewport}
              onSendMessage={onSendMessage}
              onSettingsChanged={onSettingsChanged}
              placeholder="What do you want to create?"
              session={session}
              title="Morphus"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
