"use client";

import { useEffect, useState } from "react";
import OrbLoader from "@/components/orb-loader";

const pulseDuration = 2400; // two pulses
const fadeDuration = 700;

// Only play on the first visit to the home page per full page load.
let hasPlayed = false;

// Shared with the hero video so it waits on its first frame until the orb lifts.
export const orbIntroState = { revealed: false };

export function isOrbIntroCovering() {
  return !orbIntroState.revealed && document.querySelector(".orb-intro") !== null;
}

function reveal() {
  if (orbIntroState.revealed) {
    return;
  }
  orbIntroState.revealed = true;
  window.dispatchEvent(new Event("orb-intro-reveal"));
}

export default function OrbIntro() {
  const [phase, setPhase] = useState<"pulse" | "fade" | "done">(() => (hasPlayed ? "done" : "pulse"));

  useEffect(() => {
    if (phase === "done") {
      return;
    }
    hasPlayed = true;
    window.scrollTo(0, 0);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeTimer = setTimeout(() => {
      window.scrollTo(0, 0);
      setPhase("fade");
      reveal();
    }, reduceMotion ? 600 : pulseDuration);
    const doneTimer = setTimeout(
      () => setPhase("done"),
      (reduceMotion ? 600 : pulseDuration) + fadeDuration,
    );
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
