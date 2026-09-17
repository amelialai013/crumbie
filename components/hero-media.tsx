"use client";

import { useEffect, useState } from "react";

const clips = [
  "https://videos.pexels.com/video-files/5309774/5309774-hd_1920_1080_30fps.mp4",
  "https://videos.pexels.com/video-files/10551703/10551703-hd_1080_1920_30fps.mp4",
  "https://videos.pexels.com/video-files/10835189/10835189-hd_1920_1080_24fps.mp4",
  "https://videos.pexels.com/video-files/20315770/20315770-hd_1920_1080_25fps.mp4",
];

export default function HeroMedia() {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [activeClip, setActiveClip] = useState(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div className="hero-media" aria-hidden="true">
      {!reduceMotion && (
        <video
          key={clips[activeClip]}
          className="hero-video"
          autoPlay
          muted
          playsInline
          preload="auto"
          onTimeUpdate={(event) => {
            const clipLimit = activeClip === 1 ? 3 : activeClip === 2 ? 5 : null;
            if (clipLimit && event.currentTarget.currentTime >= clipLimit) {
              setActiveClip((current) => (current + 1) % clips.length);
            }
          }}
          onEnded={() => setActiveClip((current) => (current + 1) % clips.length)}
          onError={() => setActiveClip((current) => (current + 1) % clips.length)}
        >
          <source src={clips[activeClip]} type="video/mp4" />
        </video>
      )}
    </div>
  );
}
