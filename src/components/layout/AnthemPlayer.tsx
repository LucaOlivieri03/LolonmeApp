"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

const CHORUS_START_SEC = 10;
const CHORUS_END_SEC = 21;

export function AnthemPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mode, setMode] = useState<"chorus" | "full">("chorus");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (mode === "chorus" && audio.currentTime >= CHORUS_END_SEC) {
        audio.pause();
        audio.currentTime = CHORUS_START_SEC;
        setIsPlaying(false);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [mode]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    if (mode === "chorus") {
      if (audio.currentTime < CHORUS_START_SEC || audio.currentTime >= CHORUS_END_SEC) {
        audio.currentTime = CHORUS_START_SEC;
      }
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const toggleMode = () => {
    const nextMode = mode === "chorus" ? "full" : "chorus";
    setMode(nextMode);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = nextMode === "chorus" ? CHORUS_START_SEC : 0;
    }
  };

  return (
    <div className="flex items-center overflow-hidden rounded-md border border-white/20 bg-pitch-900/60">
      <audio ref={audioRef} src="/assets/cancion.mpeg" preload="none" />
      <button
        type="button"
        onClick={togglePlay}
        title={isPlaying ? "Pausar himno de LOLONMEBOL" : "Reproducir himno de LOLONMEBOL"}
        aria-label={isPlaying ? "Pausar himno de LOLONMEBOL" : "Reproducir himno de LOLONMEBOL"}
        className={cn(
          "inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 px-2 text-xs font-semibold transition-colors lg:px-2.5",
          isPlaying
            ? "bg-leather-600 text-white"
            : "text-pitch-50 hover:bg-white/10"
        )}
      >
        {isPlaying ? (
          <Pause className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Play className="h-3.5 w-3.5 shrink-0 fill-current" />
        )}
        <span className="hidden lg:inline">Himno</span>
      </button>
      <button
        type="button"
        onClick={toggleMode}
        title={
          mode === "chorus"
            ? "Modo estribillo (0:10 - 0:21). Clic para cambiar a completo."
            : "Modo completo. Clic para volver al estribillo (0:10 - 0:21)."
        }
        aria-label={mode === "chorus" ? "Cambiar himno a modo completo" : "Cambiar himno a modo estribillo"}
        className="hidden min-h-10 min-w-10 items-center justify-center gap-1 border-l border-white/15 px-2 text-xs font-medium text-gold-400 transition-colors hover:bg-white/10 lg:inline-flex xl:px-2.5"
      >
        <Music2 className="h-3.5 w-3.5 shrink-0" />
        <span className="hidden xl:inline">{mode === "chorus" ? "Estrib." : "Full"}</span>
      </button>
    </div>
  );
}
