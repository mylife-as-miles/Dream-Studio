/**
 * VoicesPanel.tsx
 *
 * Voice cloning panel — lives in the "Voices" tab of InspectorSidebar.
 * Users upload a short audio sample, clone it via ElevenLabs, and the
 * resulting voice becomes available in the NpcVoiceInspector voice picker.
 */

import { useRef, useState } from "react";
import { Loader2, Mic, Play, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cloneVoice, deleteVoice, playBuffer, fetchVoices } from "@/lib/elevenlabs-client";
import {
  addCustomVoice,
  removeCustomVoice,
  voicesStore,
  type CustomVoice,
} from "@/lib/elevenlabs-voices-store";
import { useSnapshot } from "valtio";

const PANEL_SURFACE = "rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]";

export function VoicesPanel() {
  const snap = useSnapshot(voicesStore);

  return (
    <div className="flex min-h-full flex-col gap-4 px-1 pb-1">
      <div className="sticky top-0 z-20 -mx-1 px-1 pb-1">
        <CloneVoiceCard />
      </div>

      {snap.voices.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-2">
          <div className="px-1 text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">
            Cloned Voices ({snap.voices.length})
          </div>
          <div className="space-y-2">
            {snap.voices.map((voice) => (
              <VoiceRow key={voice.id} voice={voice as CustomVoice} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center">
          <div className="w-full rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-[11px] text-foreground/36">
            <Mic className="mx-auto mb-2 size-6 opacity-30" />
            No cloned voices yet. Upload a sample above to create one.
          </div>
        </div>
      )}
    </div>
  );
}

function CloneVoiceCard() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setError(null);
    setSuccess(false);
  };

  const handleClone = async () => {
    if (!name.trim() || !file) return;
    setCloning(true);
    setError(null);
    setSuccess(false);
    try {
      const voiceId = await cloneVoice(name.trim(), file);
      addCustomVoice(name.trim(), voiceId);
      setName("");
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clone failed");
    } finally {
      setCloning(false);
    }
  };

  const canClone = name.trim().length > 0 && file !== null && !cloning;

  return (
    <div className={`${PANEL_SURFACE} relative space-y-3 overflow-hidden px-3 py-3 backdrop-blur-xl`}>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015)_26%,rgba(5,8,12,0.06))]" />
      <div className="relative text-[10px] font-medium tracking-[0.18em] text-foreground/42 uppercase">
        Clone a Voice
      </div>

      <Input
        className="relative h-8 rounded-xl border-white/10 bg-white/[0.04] text-xs"
        onChange={(e) => setName(e.target.value)}
        placeholder="Voice name (e.g. Guard NPC)"
        value={name}
      />

      <div className="relative">
        <input
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
          ref={fileInputRef}
          type="file"
        />
        <button
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/14 bg-white/[0.025] px-3 py-2.5 text-[11px] text-foreground/56 transition-colors hover:border-purple-400/30 hover:text-purple-300"
          onClick={() => fileInputRef.current?.click()}
          type="button"
        >
          <Upload className="size-3.5" />
          {file ? file.name : "Upload audio sample (mp3, wav, m4a…)"}
        </button>
      </div>

      <div className="relative flex items-center justify-between gap-2">
        <div className="text-[10px] text-foreground/36">
          15–120 sec of clean speech works best.
        </div>
        <Button
          className="gap-1.5"
          disabled={!canClone}
          onClick={handleClone}
          size="xs"
        >
          {cloning ? <Loader2 className="size-3 animate-spin" /> : <Mic className="size-3" />}
          {cloning ? "Cloning…" : "Clone"}
        </Button>
      </div>

      {error && <div className="relative rounded-lg bg-rose-500/10 px-2 py-1.5 text-[10px] text-rose-300">{error}</div>}
      {success && <div className="relative rounded-lg bg-emerald-500/10 px-2 py-1.5 text-[10px] text-emerald-300">Voice cloned! It's now available in the NPC voice picker.</div>}
    </div>
  );
}

function VoiceRow({ voice }: { voice: CustomVoice }) {
  const [deleting, setDeleting] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteVoice(voice.voiceId);
      removeCustomVoice(voice.id);
    } catch {
      removeCustomVoice(voice.id);
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const voices = await fetchVoices();
      const found = voices.find((v) => v.voice_id === voice.voiceId);
      if (found?.preview_url) {
        const audio = new Audio(found.preview_url);
        audio.onended = () => setPreviewing(false);
        audio.play().catch(() => setPreviewing(false));
        return;
      }
    } catch {}
    setPreviewing(false);
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-2">
      <Mic className="size-3.5 shrink-0 text-purple-400" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-foreground/82">{voice.name}</div>
        <div className="truncate text-[9px] text-foreground/36 font-mono">{voice.voiceId}</div>
      </div>
      <Button
        className="size-6 shrink-0"
        disabled={previewing}
        onClick={handlePreview}
        size="icon-xs"
        title="Preview voice"
        variant="ghost"
      >
        <Play className="size-3 text-emerald-400" />
      </Button>
      <Button
        className="size-6 shrink-0"
        disabled={deleting}
        onClick={handleDelete}
        size="icon-xs"
        title="Delete voice"
        variant="ghost"
      >
        {deleting ? <Loader2 className="size-2.5 animate-spin" /> : <Trash2 className="size-3 text-foreground/40" />}
      </Button>
    </div>
  );
}
