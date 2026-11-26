"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function parts(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return [
    ["Days", Math.floor(total / 86400)],
    ["Hours", Math.floor((total % 86400) / 3600)],
    ["Mins", Math.floor((total % 3600) / 60)],
    ["Secs", total % 60],
  ] as const;
}

export default function HeroCountdown({ target, label, refreshOnEnd }: { target: number; label: string; refreshOnEnd?: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Set after mount so server and client markup match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = target - (now ?? 0);
  const router = useRouter();
  const ended = now !== null && remaining <= 0;
  useEffect(() => {
    if (ended && refreshOnEnd) router.refresh();
  }, [ended, refreshOnEnd, router]);
  if (now !== null && remaining <= 0) return null;
  return (
    <div className="hero-countdown" role="timer" aria-label={label || "Countdown"}>
      {label && <p className="hero-countdown-label">{label}</p>}
      <div className="hero-countdown-grid">
        {parts(now === null ? 0 : remaining).map(([unit, value]) => (
          <div key={unit}>
            <strong suppressHydrationWarning>{now === null ? "--" : String(value).padStart(2, "0")}</strong>
            <span>{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
