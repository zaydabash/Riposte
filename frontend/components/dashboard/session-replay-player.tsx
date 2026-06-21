"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { defaultApiBaseUrl } from "@/lib/riposte-config";

interface ReplayPage {
  pageId: string;
  url?: string;
}

interface SessionReplayPlayerProps {
  sessionId: string;
  label?: string;
  className?: string;
  compact?: boolean;
}

export function SessionReplayPlayer({
  sessionId,
  label = "Browserbase session replay",
  className,
  compact = false,
}: SessionReplayPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const apiBase = defaultApiBaseUrl().replace(/\/$/, "");

    async function loadReplay() {
      setLoading(true);
      setError(null);
      try {
        const metaRes = await fetch(`${apiBase}/api/v1/sessions/${sessionId}/replays`);
        if (!metaRes.ok) {
          throw new Error(`Replay metadata unavailable (${metaRes.status})`);
        }
        const meta = (await metaRes.json()) as { pages?: ReplayPage[] };
        const firstPage = meta.pages?.[0]?.pageId;
        if (!firstPage) {
          throw new Error("No replay pages for this session yet");
        }
        if (cancelled) return;
        setPageId(firstPage);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Replay unavailable");
          setLoading(false);
        }
      }
    }

    void loadReplay();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!pageId || !videoRef.current) return;

    const apiBase = defaultApiBaseUrl().replace(/\/$/, "");
    const playlistUrl = `${apiBase}/api/v1/sessions/${sessionId}/replays/${pageId}`;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hlsRef.current = hls;
      hls.loadSource(playlistUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          setError("HLS playback failed");
          setLoading(false);
        }
      });
      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    }

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playlistUrl;
      video.addEventListener("loadedmetadata", () => setLoading(false), { once: true });
      video.addEventListener("error", () => setError("Replay playback failed"), { once: true });
    } else {
      setError("HLS playback not supported in this browser");
      setLoading(false);
    }
    return undefined;
  }, [pageId, sessionId]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
          {label}
        </p>
        <a
          href={`https://www.browserbase.com/sessions/${sessionId}/debug`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-[10px] text-accent hover:underline"
        >
          <MonitorPlay size={12} />
          Open in Browserbase
        </a>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded border border-white/10 bg-black",
          compact ? "aspect-video max-h-48" : "aspect-video",
        )}
      >
        {error ? (
          <div className="flex h-full min-h-[120px] items-center justify-center p-4 text-center font-mono text-[10px] text-muted">
            {error}
            <span className="mt-1 block text-[9px] text-muted/70">
              Replay may take a moment after the session ends.
            </span>
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            playsInline
            className="h-full w-full bg-black object-contain"
          />
        )}
      </div>
      {loading && !error && (
        <p className="font-mono text-[10px] text-muted">Loading replay…</p>
      )}
      <p className="font-mono text-[9px] text-muted">
        Session {sessionId.slice(0, 8)}…
        {pageId ? ` · page ${pageId}` : ""}
      </p>
    </div>
  );
}
