import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useState } from "react";

export default function HarpanThemeBackground({ active }) {
  const primaryRef = useRef(null);
  const secondaryRef = useRef(null);
  const secondaryPrimedRef = useRef(false);
  const [loopSeconds, setLoopSeconds] = useState(18);

  useEffect(() => {
    if (!active) return undefined;
    const primary = primaryRef.current;
    const secondary = secondaryRef.current;
    if (!primary || !secondary) return undefined;

    const primeSecondary = () => {
      if (secondaryPrimedRef.current) return;
      if (!Number.isFinite(primary.duration) || primary.duration <= 0) return;
      setLoopSeconds(primary.duration);
      try {
        secondary.currentTime = primary.duration / 2;
      } catch {
        // Ignore seek timing issues on some devices.
      }
      secondaryPrimedRef.current = true;
    };

    const startBoth = () => {
      primeSecondary();
      void primary.play().catch(() => {});
      void secondary.play().catch(() => {});
    };

    if (primary.readyState >= 1) {
      startBoth();
    } else {
      primary.addEventListener("loadedmetadata", startBoth);
    }

    return () => {
      primary.pause();
      secondary.pause();
      primary.removeEventListener("loadedmetadata", startBoth);
    };
  }, [active]);

  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="harpan-bg-video"
      aria-hidden="true"
      style={{ "--harpan-loop-sec": `${loopSeconds}s` }}
    >
      <video
        ref={primaryRef}
        className="harpan-bg-video__layer harpan-bg-video__layer--a"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/Bakgrund_harpan.mp4" type="video/mp4" />
      </video>
      <video
        ref={secondaryRef}
        className="harpan-bg-video__layer harpan-bg-video__layer--b"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src="/Bakgrund_harpan.mp4" type="video/mp4" />
      </video>
      <div className="harpan-bg-video__veil" />
    </div>,
    document.body
  );
}
