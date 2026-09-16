"use client";

import { useEffect, useState } from "react";

const clips = [
  "https://videos.pexels.com/video-files/5309774/5309774-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/10551703/10551703-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/10835189/10835189-hd_1920_1080_24fps.mp4",
  "https://videos.pexels.com/video-files/20315770/20315770-hd_1920_1080_25fps.mp4",
];
const videoTransitionDuration = 1200;

export default function HeroMedia() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [activeClip, setActiveClip] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [layerClips, setLayerClips] = useState([0, 1]);
  const [failedLayers, setFailedLayers] = useState<Set<number>>(new Set());
  const [transitionInProgress, setTransitionInProgress] = useState(false);
  const [pendingTransition, setPendingTransition] = useState<{ nextClip: number; nextLayer: number; oldLayer: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function advanceClip() {
    if (transitionInProgress) return;
    const nextClip = (activeClip + 1) % clips.length;
    const nextLayer = 1 - activeLayer;

    setTransitionInProgress(true);
    setPendingTransition({ nextClip, nextLayer, oldLayer: activeLayer });
    setLayerClips((current) => current.map((clip, layer) => layer === nextLayer ? nextClip : clip));
  }

  useEffect(() => {
    if (!pendingTransition) return;
    const { nextClip, nextLayer, oldLayer } = pendingTransition;
    const nextVideo = document.querySelector<HTMLVideoElement>(`video[data-layer="${nextLayer}"]`);
    if (!nextVideo) return;
    let started = false;
    let cleanupTimer: number | undefined;
    const startTransition = () => {
      if (started || nextVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
      started = true;
      nextVideo.currentTime = 0;
      nextVideo.play().then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setActiveLayer(nextLayer));
        });
        cleanupTimer = window.setTimeout(() => {
          setFailedLayers((current) => {
            const next = new Set(current);
            next.delete(oldLayer);
            return next;
          });
          setLayerClips((current) => current.map((clip, layer) => layer === oldLayer ? (nextClip + 1) % clips.length : clip));
          setActiveClip(nextClip);
          setPendingTransition(null);
          setTransitionInProgress(false);
        }, videoTransitionDuration);
      }).catch(() => setVideoFailed(true));
    };
    startTransition();
    nextVideo.addEventListener("canplay", startTransition);
    nextVideo.addEventListener("loadeddata", startTransition);
    return () => {
      nextVideo.removeEventListener("canplay", startTransition);
      nextVideo.removeEventListener("loadeddata", startTransition);
      if (cleanupTimer) window.clearTimeout(cleanupTimer);
    };
  }, [pendingTransition]);

  return (
    <div className="hero-media" aria-hidden="true">
      {!reduceMotion && failedLayers.size < 2 && (
        [0, 1].map((layer) => (
          <video
            key={layer}
            className={`hero-video${activeLayer === layer ? " is-active" : ""}`}
            autoPlay={layer === 0}
            loop={false}
            muted
            playsInline
            preload="auto"
            src={clips[layerClips[layer]]}
            data-layer={layer}
            onTimeUpdate={(event) => {
              if (layer !== activeLayer || transitionInProgress) return;
              const clipLimit = layerClips[layer] === 0 ? 7 : layerClips[layer] === 1 ? 2.5 : layerClips[layer] === 2 ? 7 : layerClips[layer] === 3 ? 7 : null;
              if (clipLimit && event.currentTarget.currentTime >= clipLimit) advanceClip();
            }}
            onEnded={() => {
              if (layer !== activeLayer) return;
              if (transitionInProgress) return;
              advanceClip();
            }}
            onError={() => {
              setFailedLayers((current) => new Set(current).add(layer));
              if (layer === activeLayer) {
                const fallbackLayer = 1 - layer;
                setActiveLayer(fallbackLayer);
                setActiveClip(layerClips[fallbackLayer]);
                document.querySelector<HTMLVideoElement>(`video[data-layer="${fallbackLayer}"]`)?.play().catch(() => undefined);
              }
            }}
          >
          </video>
        ))
      )}
    </div>
  );
}
