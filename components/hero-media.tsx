"use client";

import { useEffect, useRef, useState } from "react";
import { preconnect } from "react-dom";
import { isOrbIntroCovering } from "@/components/orb-intro";
import { motionDuration } from "@/lib/motion";

const clips = [
  { src: "https://videos.pexels.com/video-files/5309774/5309774-hd_1920_1080_30fps.mp4", cutAt: 7 },
  { src: "https://videos.pexels.com/video-files/10835189/10835189-hd_1920_1080_24fps.mp4", cutAt: 7 },
  { src: "https://videos.pexels.com/video-files/20315770/20315770-hd_1920_1080_25fps.mp4", cutAt: 7 },
];


export default function HeroMedia() {
  preconnect("https://videos.pexels.com");
  // Render the videos on the server so they start downloading before hydration;
  // reduced-motion users are handled by CSS and by the effect below.
  const [reduceMotion, setReduceMotion] = useState(false);
  const [hasCrossfaded, setHasCrossfaded] = useState(false);
  const [activeClip, setActiveClip] = useState(0);
  const [outgoingClip, setOutgoingClip] = useState<number | null>(null);
  const [readyClips, setReadyClips] = useState<number[]>([]);
  const [playingClips, setPlayingClips] = useState<number[]>([]);
  const [failedClips, setFailedClips] = useState<number[]>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const activeClipRef = useRef(0);
  const readyClipsRef = useRef(new Set<number>());
  const failedClipsRef = useRef(new Set<number>());
  const transitioningRef = useRef(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextClipToPreloadRef = useRef<number | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  function findNextReadyClip(fromIndex: number) {
    for (let offset = 1; offset < clips.length; offset += 1) {
      const candidate = (fromIndex + offset) % clips.length;
      if (readyClipsRef.current.has(candidate) && !failedClipsRef.current.has(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  function advanceClip(fromIndex: number, restartIfWaiting = false) {
    if (fromIndex !== activeClipRef.current || transitioningRef.current || reduceMotion) {
      return;
    }

    const nextClip = findNextReadyClip(fromIndex);
    const currentVideo = videoRefs.current[fromIndex];

    if (nextClip === null) {
      if (restartIfWaiting && currentVideo) {
        currentVideo.currentTime = 0;
      }
      return;
    }

    const nextVideo = videoRefs.current[nextClip];
    if (!nextVideo || nextVideo.paused) {
      if (restartIfWaiting && currentVideo) {
        currentVideo.currentTime = 0;
      }
      return;
    }

    transitioningRef.current = true;
    const revealNextClip = () => {
      if (fromIndex !== activeClipRef.current) {
        transitioningRef.current = false;
        return;
      }

      const reveal = () => {
        activeClipRef.current = nextClip;
        setOutgoingClip(fromIndex);
        setActiveClip(nextClip);
        setHasCrossfaded(true);

        transitionTimerRef.current = setTimeout(() => {
          currentVideo?.pause();
          if (currentVideo) {
            currentVideo.currentTime = 0;
          }
          setOutgoingClip(null);
          transitioningRef.current = false;
        }, motionDuration("crossfade", 1800));
      };

      if ("requestVideoFrameCallback" in nextVideo) {
        nextVideo.requestVideoFrameCallback(() => reveal());
      } else {
        requestAnimationFrame(reveal);
      }
    };

    if (nextVideo.currentTime <= 0.05) {
      revealNextClip();
    } else {
      nextVideo.addEventListener("seeked", revealNextClip, { once: true });
      nextVideo.currentTime = 0;
    }
  }

  function ensurePlaying(video: HTMLVideoElement | null | undefined) {
    if (!video || !video.paused) {
      return;
    }
    // Hold the first clip on its opening frame while the home intro covers it.
    if (video === videoRefs.current[0] && activeClipRef.current === 0 && isOrbIntroCovering()) {
      return;
    }
    video.muted = true;
    video.play().catch(() => {});
  }

  function markClipReady(index: number) {
    if (index === activeClipRef.current || index === nextClipToPreloadRef.current) {
      ensurePlaying(videoRefs.current[index]);
    }

    if (!readyClipsRef.current.has(index)) {
      readyClipsRef.current.add(index);
      setReadyClips(Array.from(readyClipsRef.current));
    }

    if (failedClipsRef.current.has(activeClipRef.current)) {
      advanceClip(activeClipRef.current);
    }
  }

  function markClipPlaying(index: number) {
    setPlayingClips((current) => (current.includes(index) ? current : [...current, index]));
  }

  function markClipPaused(index: number) {
    setPlayingClips((current) =>
      current.includes(index) ? current.filter((clipIndex) => clipIndex !== index) : current,
    );
  }

  function markClipFailed(index: number, video: HTMLVideoElement) {
    failedClipsRef.current.add(index);
    readyClipsRef.current.delete(index);
    setFailedClips(Array.from(failedClipsRef.current));
    setReadyClips(Array.from(readyClipsRef.current));
    console.warn("A hero video clip could not be loaded.", video.error);

    if (index === activeClipRef.current) {
      advanceClip(index);
    }
  }

  const nextClipOffset = clips.findIndex((_, index) => {
    const candidate = (activeClip + index + 1) % clips.length;
    return !failedClips.includes(candidate);
  });
  const nextClipToPreload =
    nextClipOffset === -1 ? activeClip : (activeClip + nextClipOffset + 1) % clips.length;

  useEffect(() => {
    nextClipToPreloadRef.current = nextClipToPreload;
  }, [nextClipToPreload]);

  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const video = videoRefs.current[nextClipToPreload];
    if (video && video.paused) {
      video.load();
    }
  }, [nextClipToPreload, reduceMotion]);

  // Autoplay can start before hydration, so catch up on media events React missed.
  useEffect(() => {
    if (reduceMotion) {
      return;
    }
    videoRefs.current.forEach((video, index) => {
      if (!video) {
        return;
      }
      if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        markClipReady(index);
      }
      if (!video.paused && !video.ended) {
        markClipPlaying(index);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // The first clip waits on its opening frame until the home intro fades.
  useEffect(() => {
    const start = () => ensurePlaying(videoRefs.current[activeClipRef.current]);
    window.addEventListener("orb-intro-reveal", start);
    return () => window.removeEventListener("orb-intro-reveal", start);
  }, []);

  // Some browsers ignore the autoplay attribute or block it until the user interacts,
  // so start playback explicitly and retry on the first interaction.
  useEffect(() => {
    if (reduceMotion) {
      return;
    }

    const resume = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      ensurePlaying(videoRefs.current[activeClipRef.current]);
      if (nextClipToPreloadRef.current !== null) {
        ensurePlaying(videoRefs.current[nextClipToPreloadRef.current]);
      }
    };

    const interactionEvents = ["pointerdown", "keydown", "touchstart"] as const;

    resume();
    document.addEventListener("visibilitychange", resume);
    interactionEvents.forEach((type) => document.addEventListener(type, resume, { passive: true }));
    return () => {
      document.removeEventListener("visibilitychange", resume);
      interactionEvents.forEach((type) => document.removeEventListener(type, resume));
    };
  }, [reduceMotion, activeClip]);

  return (
    <div className="hero-media" aria-hidden="true">
      {/* Still of the first clip's opening frame, shown whenever no video is playing. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized 45KB webp, must render before hydration */}
      <img className="hero-poster" src="/hero-poster.webp" alt="" fetchPriority="high" decoding="async" />
      {!reduceMotion &&
        clips.map((clip, index) => {
          const isReady = readyClips.includes(index) && !failedClips.includes(index);
          const isPlaying = playingClips.includes(index);
          const className = [
            "hero-video",
            isReady && isPlaying && index === activeClip ? "is-active" : "",
            !hasCrossfaded && index === activeClip ? "is-first" : "",
            isReady && isPlaying && index === outgoingClip ? "is-outgoing" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <video
              key={clip.src}
              ref={(video) => {
                videoRefs.current[index] = video;
                if (video) {
                  video.defaultMuted = true;
                  video.muted = true;
                }
              }}
              className={className}
              autoPlay={index !== 0 && (index === activeClip || index === nextClipToPreload)}
              loop
              muted
              playsInline
              preload={index === activeClip || index === nextClipToPreload ? "auto" : "metadata"}
              onCanPlay={() => markClipReady(index)}
              onPlaying={() => markClipPlaying(index)}
              onPause={() => markClipPaused(index)}
              onTimeUpdate={(event) => {
                const transitionAt = Math.max(0, clip.cutAt - motionDuration("crossfade", 1800) / 1000);

                if (
                  index === activeClipRef.current &&
                  event.currentTarget.currentTime >= transitionAt
                ) {
                  advanceClip(index, true);
                }
              }}
              onError={(event) => markClipFailed(index, event.currentTarget)}
            >
              <source src={clip.src} type="video/mp4" />
            </video>
          );
        })}
    </div>
  );
}
