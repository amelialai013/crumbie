"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Clip = { src: string; cutAt: number };
type Layer = 0 | 1;

const CLIPS: Clip[] = [
  { src: "https://videos.pexels.com/video-files/5309774/5309774-hd_1920_1080_30fps.mp4", cutAt: 7 },
  { src: "https://videos.pexels.com/video-files/34484013/34484013-hd_1920_1080_30fps.mp4", cutAt: 7 },
  { src: "https://videos.pexels.com/video-files/10835189/10835189-hd_1920_1080_24fps.mp4", cutAt: 7 },
  { src: "https://videos.pexels.com/video-files/20315770/20315770-hd_1920_1080_25fps.mp4", cutAt: 7 },
];

const CROSSFADE_MS = 900;
const PRIME_LEAD_SECONDS = 0.6; // start decoding the incoming clip this far ahead of the cut so the fade never stalls on startup

function otherLayer(layer: Layer): Layer {
  return layer === 0 ? 1 : 0;
}

export default function HeroMedia() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [activeLayer, setActiveLayer] = useState<Layer>(0);
  const [clipForLayer, setClipForLayer] = useState<[number, number]>([0, 1]);

  const videoRefs = useRef<[HTMLVideoElement | null, HTMLVideoElement | null]>([null, null]);
  const failedClipsRef = useRef<Set<number>>(new Set());
  const primedRef = useRef(false);
  const transitioningRef = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!reduceMotion && !hidden) return;
    const readyFrame = window.requestAnimationFrame(() => window.dispatchEvent(new Event("hero-media-ready")));
    return () => window.cancelAnimationFrame(readyFrame);
  }, [hidden, reduceMotion]);

  // Starts the incoming layer decoding (muted, hidden) well before the cut so the crossfade has no startup stutter.
  const primeIncoming = useCallback((fromLayer: Layer) => {
    if (primedRef.current) return;
    const toVideo = videoRefs.current[otherLayer(fromLayer)];
    if (!toVideo || toVideo.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) return;
    primedRef.current = true;
    toVideo.currentTime = 0;
    toVideo.play().catch(() => {
      primedRef.current = false;
    });
  }, []);

  // Cross-fades to the already-priming incoming layer; falls back to a cold start if priming hasn't happened yet.
  const cutToNext = useCallback((fromLayer: Layer) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;

    const toLayer = otherLayer(fromLayer);
    const toVideo = videoRefs.current[toLayer];
    if (!toVideo) {
      transitioningRef.current = false;
      return;
    }

    const reveal = () => {
      setActiveLayer(toLayer);
      videoRefs.current[fromLayer]?.pause();
      primedRef.current = false;
      window.setTimeout(() => {
        // Queue the clip after next onto the now-hidden layer so it's ready for the following crossfade.
        setClipForLayer((current) => {
          const next: [number, number] = [...current];
          next[fromLayer] = (current[toLayer] + 1) % CLIPS.length;
          return next;
        });
        transitioningRef.current = false;
      }, CROSSFADE_MS);
    };

    if (toVideo.paused) {
      toVideo.currentTime = 0;
      toVideo
        .play()
        .then(reveal)
        .catch(() => setHidden(true));
    } else {
      reveal();
    }
  }, []);

  const handleVideoError = useCallback((layer: Layer, clipIndex: number) => {
    failedClipsRef.current.add(clipIndex);
    const nextClip = Array.from({ length: CLIPS.length }, (_, offset) => (clipIndex + offset + 1) % CLIPS.length)
      .find((index) => !failedClipsRef.current.has(index));
    if (nextClip === undefined) {
      setHidden(true);
      return;
    }

    setClipForLayer((current) => {
      const next: [number, number] = [...current];
      next[layer] = nextClip;
      return next;
    });
  }, []);

  // Falls back to the theme's plain black background, no broken-media icon, on any playback failure.
  if (reduceMotion || hidden) return <div className="hero-media" aria-hidden="true" />;

  return (
    <div className="hero-media" aria-hidden="true">
      <div className={`hero-media-loading${ready ? " is-hidden" : ""}`}>
        <div className="hero-media-loading-pulse" />
      </div>
      {([0, 1] as const).map((layer) => (
        <video
          key={layer}
          ref={(el) => {
            videoRefs.current[layer] = el;
          }}
          className={`hero-video${activeLayer === layer ? " is-active" : ""}`}
          autoPlay={layer === 0}
          muted
          playsInline
          preload="auto"
          src={CLIPS[clipForLayer[layer]].src}
          onPlaying={() => {
            if (layer === 0) {
              setReady(true);
              window.dispatchEvent(new Event("hero-media-ready"));
            }
          }}
          onTimeUpdate={(event) => {
            if (layer !== activeLayer) return;
            const time = event.currentTarget.currentTime;
            const cutAt = CLIPS[clipForLayer[layer]].cutAt;
            if (time >= cutAt - PRIME_LEAD_SECONDS) primeIncoming(layer);
            if (time >= cutAt) cutToNext(layer);
          }}
          onEnded={() => {
            if (layer === activeLayer) cutToNext(layer);
          }}
          onError={() => handleVideoError(layer, clipForLayer[layer])}
        />
      ))}
    </div>
  );
}
