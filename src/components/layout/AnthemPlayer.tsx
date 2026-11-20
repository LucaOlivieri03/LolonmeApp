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
    <div className="flex items-center gap-1 rounded-full border border-pitch-700/20 bg-pitch-50 px-2 py-1 shadow-xs">
      <audio ref={audioRef} src="/assets/cancion.mpeg" preload="metadata" />
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pausar himno de LOLONMEBOL" : "Reproducir himno de LOLONMEBOL"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
          isPlaying
            ? "bg-pitch-700 text-white"
            : "text-pitch-800 hover:bg-pitch-100"
        )}
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 fill-current" />}
        <span className="hidden sm:inline">Himno</span>
      </button>
      <button
        type="button"
        onClick={toggleMode}
        title={mode === "chorus" ? "Modo estribillo (0:10 - 0:21). Clic para cambiar a completo." : "Modo completo. Clic para volver al estribillo (0:10 - 0:21)."}
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-navy-800 hover:bg-white/80"
      >
        <Music2 className="h-3 w-3 text-gold-600" />
        <span>{mode === "chorus" ? "Estribillo" : "Full"}</span>
      </button>
    </div>
  );
}
