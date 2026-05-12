import { useState } from "react";
import { Settings, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import type { CopilotSettings } from "@/lib/copilot/types";
import { loadCopilotSettings, saveCopilotSettings } from "@/lib/copilot/settings";

export function CopilotSettingsDialog({ onSaved }: { onSaved?: () => void }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<CopilotSettings>(loadCopilotSettings);
  const [showElevenLabsKey, setShowElevenLabsKey] = useState(false);
  const handleSave = () => {
    saveCopilotSettings({ ...settings, provider: "gemini" });
    setOpen(false);
    onSaved?.();
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger
        render={
          <Button className="size-7 rounded-lg text-foreground/48 hover:text-foreground" size="icon-sm" variant="ghost" />
        }
      >
        <Settings className="size-3.5" />
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0a1510] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vibe Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">


          <div className="space-y-1.5">
            <label className="text-[11px] font-medium tracking-[0.18em] text-foreground/52 uppercase">
              ElevenLabs API Key
            </label>
            <div className="relative">
              <Input
                className="h-10 rounded-xl border-white/10 bg-white/[0.045] pr-10 text-sm font-mono"
                onChange={(e) => setSettings({ ...settings, elevenlabsApiKey: e.target.value })}
                placeholder="Enter your ElevenLabs API key"
                type={showElevenLabsKey ? "text" : "password"}
                value={settings.elevenlabsApiKey}
              />
              <Button
                className="absolute right-1 top-1 size-8 rounded-lg text-foreground/48"
                onClick={() => setShowElevenLabsKey(!showElevenLabsKey)}
                size="icon-sm"
                variant="ghost"
              >
                {showElevenLabsKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </Button>
            </div>
            <p className="text-[10px] text-foreground/36">
              Used for voice and audio features. Stored locally in your browser.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button className="rounded-xl" onClick={() => setOpen(false)} size="sm" variant="ghost">
              Cancel
            </Button>
            <Button className="rounded-xl" onClick={handleSave} size="sm">
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
