import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function HarpanThemeBackground({ active }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const resume = () => {
      if (!active) return;
      video.playbackRate = 0.78;
      void video.play().catch(() => {});
    };

    const onPause = () => {
      // Prevent stuck paused state / overlay icon on some mobile browsers.
      resume();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") resume();
    };

    resume();
    video.addEventListener("pause", onPause);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      video.removeEventListener("pause", onPause);
      document.removeEventListener("visibilitychange", onVisible);
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        // Ignore seek timing issues.
      }
    };
  }, [active]);

  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div className="harpan-bg-video" aria-hidden="true">
      <video
        ref={videoRef}
        className="harpan-bg-video__layer is-active"
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
      >
        <source src="/Bakgrund_harpan.mp4" type="video/mp4" />
      </video>
      <div className="harpan-bg-video__veil" />
    </div>,
    document.body
  );
}
