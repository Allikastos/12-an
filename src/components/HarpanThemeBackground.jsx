import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export default function HarpanThemeBackground({ active }) {
  const videoRef = useRef(null);
  const playbackRate = 0.8;

  useEffect(() => {
    if (!active) return undefined;
    const video = videoRef.current;
    if (!video) return undefined;

    const startVideo = () => {
      video.playbackRate = playbackRate;
      void video.play().catch(() => {});
    };

    if (video.readyState >= 1) {
      startVideo();
    } else {
      video.addEventListener("loadedmetadata", startVideo);
    }

    return () => {
      video.pause();
      video.removeEventListener("loadedmetadata", startVideo);
    };
  }, [active]);

  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="harpan-bg-video"
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="harpan-bg-video__layer"
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
