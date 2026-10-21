"use client";

import { useEffect, useState } from "react";
import OrbLoader from "@/components/orb-loader";
import { motionDuration } from "@/lib/motion";

const breatheCycle = 1200;
const minimumCycles = 2;
const maxWait = 3000;

// Shared with the hero video so it waits on its first frame until the orb lifts.
export const orbIntroState = { revealed: false };

export function isOrbIntroCovering() {
  return !orbIntroState.revealed && document.querySelector(".orb-intro") !== null;
}

// Each visit to the home page starts covered again, before the hero video's effects run.
function resetReveal() {
  orbIntroState.revealed = false;
  return "pulse" as const;
}

function reveal() {
  if (orbIntroState.revealed) {
    return;
  }
  orbIntroState.revealed = true;
  window.dispatchEvent(new Event("orb-intro-reveal"));
}

// Resolves once the hero poster is decoded, so the orb never lifts onto an empty frame.
function posterReady() {
  const poster = document.querySelector<HTMLImageElement>(".hero-poster");
  if (!poster) {
    return Promise.resolve();
  }
  return poster.decode().catch(() => undefined);
}

export default function OrbIntro() {
  const [phase, setPhase] = useState<"pulse" | "fade" | "done">(resetReveal);

  useEffect(() => {
    window.scrollTo(0, 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const minimum = reduceMotion ? 600 : minimumCycles * breatheCycle;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cancelled = false;

    const ready = Promise.race([
      posterReady(),
      new Promise<void>((resolve) => timers.push(setTimeout(resolve, maxWait))),
    ]);
    ready.then(() => {
      if (cancelled) {
        return;
      }
      const elapsed = performance.now() - start;
      // Lift on a breathe boundary so the pulse never cuts off mid-swell.
      const target = reduceMotion
        ? minimum
        : Math.max(minimum, Math.ceil(elapsed / breatheCycle) * breatheCycle);
      timers.push(
        setTimeout(() => {
          window.scrollTo(0, 0);
          setPhase("fade");
          reveal();
          timers.push(setTimeout(() => setPhase("done"), motionDuration("orb-exit", 1000)));
        }, Math.max(0, target - elapsed)),
      );
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "done") {
    return null;
  }

  return (
    <div className={`orb-intro${phase === "fade" ? " is-leaving" : ""}`}>
      <OrbLoader />
    </div>
  );
}
