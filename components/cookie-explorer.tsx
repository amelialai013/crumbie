"use client";

import Image, { StaticImageData } from "next/image";
import { PointerEvent, useRef, useState } from "react";

import frame01 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-01.png";
import frame02 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-02.png";
import frame03 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-03.png";
import frame04 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-04.png";
import frame05 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-05.png";
import frame06 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-06.png";
import frame07 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-07.png";
import frame08 from "@/assets/cookies/choc-chip-cookie/turntable-natural/frame-08.png";
import biscoff01 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-01.png";
import biscoff02 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-02.png";
import biscoff03 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-03.png";
import biscoff04 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-04.png";
import biscoff05 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-05.png";
import biscoff06 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-06.png";
import biscoff07 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-07.png";
import biscoff08 from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-natural/frame-08.png";

const signatureFrames: StaticImageData[] = [frame01, frame02, frame03, frame04, frame05, frame06, frame07, frame08];
const biscoffFrames: StaticImageData[] = [biscoff01, biscoff02, biscoff03, biscoff04, biscoff05, biscoff06, biscoff07, biscoff08];

export default function CookieExplorer({ name, variant = "signature" }: { name: string; variant?: "signature" | "biscoff" }) {
  const frames = variant === "biscoff" ? biscoffFrames : signatureFrames;
  const initialRotation = variant === "biscoff" ? 2 : 0;
  const wrap = (value: number) => (value % frames.length + frames.length) % frames.length;
  const [rotation, setRotation] = useState(initialRotation);
  const [dragging, setDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [tilt, setTilt] = useState(0);
  const dragStart = useRef({ x: 0, y: 0, rotation: 0 });

  function startDrag(event: PointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = { x: event.clientX, y: event.clientY, rotation };
    setDragging(true);
    setHasInteracted(true);
  }

  function updateDrag(event: PointerEvent<HTMLElement>) {
    if (!dragging) return;
    setRotation(wrap(dragStart.current.rotation + (event.clientX - dragStart.current.x) / 82));
    setTilt(Math.max(-6, Math.min(6, -(event.clientY - dragStart.current.y) / 28)));
  }

  function endDrag() {
    setDragging(false);
    setTilt(0);
    setRotation((current) => wrap(Math.round(current)));
  }

  return (
    <section
      className={`cookie-explorer${dragging ? " is-dragging" : ""}${hasInteracted ? " has-interacted" : ""}`}
      tabIndex={0}
      role="group"
      aria-roledescription="360-degree product view"
      aria-label={`${name}. Drag left or right, or use the arrow keys, to rotate the cookie.`}
      onPointerDown={startDrag}
      onPointerMove={updateDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        setHasInteracted(true);
        setRotation((current) => wrap(Math.round(current) + (event.key === "ArrowLeft" ? -1 : 1)));
      }}
    >
      <div className="cookie-explorer-object" style={{ transform: `perspective(1000px) rotateX(${tilt}deg)` }}>
        {frames.map((frame, index) => {
          const directDistance = Math.abs(rotation - index);
          const distance = Math.min(directDistance, frames.length - directDistance);
          const opacity = Math.max(0, 1 - distance);
          return (
            <Image
              key={frame.src}
              src={frame}
              alt=""
              fill
              priority
              draggable={false}
              sizes="(max-width: 900px) 100vw, 46vw"
              style={{ opacity }}
            />
          );
        })}
      </div>
      <span className="cookie-explorer-hint" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
        </svg>
        Rotate cookie
      </span>
      <span className="sr-only" aria-live="polite">Cookie angle updated</span>
    </section>
  );
}
