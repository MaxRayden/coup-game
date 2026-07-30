import { useEffect, useRef, useState } from "react";
import { coverImg } from "@/components/layout/CoverArt";

export interface IntroSplashProps {
  onComplete: () => void;
  durationMs?: number;
}

const EXIT_MS = 400;

export default function IntroSplash({ onComplete, durationMs = 3000 }: IntroSplashProps) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const onCompleteRef = useRef(onComplete);
  const finishedRef = useRef(false);

  onCompleteRef.current = onComplete;

  useEffect(() => {
    finishedRef.current = false;
    const started = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const elapsed = now - started;
      setProgress(Math.min(100, (elapsed / durationMs) * 100));
      if (elapsed < durationMs) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);

    let exitTimer: number | undefined;
    const finishTimer = window.setTimeout(() => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setExiting(true);
      exitTimer = window.setTimeout(() => {
        onCompleteRef.current();
      }, EXIT_MS);
    }, durationMs);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(finishTimer);
      if (exitTimer != null) window.clearTimeout(exitTimer);
    };
  }, [durationMs]);

  return (
    <div
      className={`intro-splash${exiting ? " intro-splash--exit" : ""}`}
      role="presentation"
      aria-hidden
    >
      <div className="intro-splash-bg">
        <img src={coverImg} alt="" className="intro-splash-img" draggable={false} />
        <div className="intro-splash-vignette" />
        <div className="intro-splash-glow intro-splash-glow--magenta" />
        <div className="intro-splash-glow intro-splash-glow--teal" />
      </div>

      <div className="intro-splash-content">
        <p className="intro-splash-eyebrow">Controle de Partida</p>
        <h1 className="intro-splash-title">Coup</h1>
      </div>

      <div className="intro-splash-footer">
        <div className="intro-splash-progress" aria-hidden>
          <div className="intro-splash-progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
}
