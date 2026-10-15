"use client";

import { useEffect, useState } from "react";
import OrbLoader from "@/components/orb-loader";

const pulseDuration = 2400; // two pulses
const fadeDuration = 700;

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

export default function OrbIntro() {
  const [phase, setPhase] = useState<"pulse" | "fade" | "done">(resetReveal);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Block wheel, touch and keyboard scrolling until the orb lifts.
    const blockScroll = (event: Event) => event.preventDefault();
    const scrollKeys = new Set([" ", "PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);
    const blockKeys = (event: KeyboardEvent) => {
      if (scrollKeys.has(event.key)) {
        event.preventDefault();
      }
    };
    const unlock = () => {
      window.removeEventListener("wheel", blockScroll);
      window.removeEventListener("touchmove", blockScroll);
      window.removeEventListener("keydown", blockKeys);
    };
    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("keydown", blockKeys);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeTimer = setTimeout(() => {
      window.scrollTo(0, 0);
      unlock();
      setPhase("fade");
      reveal();
    }, reduceMotion ? 600 : pulseDuration);
    const doneTimer = setTimeout(
      () => setPhase("done"),
      (reduceMotion ? 600 : pulseDuration) + fadeDuration,
    );
    return () => {
      unlock();
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
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
