import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { AssistantStatus } from "../types";

const labels: Record<AssistantStatus, string> = {
  idle: "Aguardando comando",
  listening: "Escutando",
  thinking: "Processando contexto",
  responding: "Respondendo",
};

type OrbScene3DProps = {
  status: AssistantStatus;
  onReady: () => void;
  onUnavailable: () => void;
};

function canUseWebGL() {
  if (typeof document === "undefined") return false;
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function VoiceOrb({
  status,
  onClick,
}: {
  status: AssistantStatus;
  onClick: () => void;
}) {
  const [webGLEnabled, setWebGLEnabled] = useState(canUseWebGL);
  const [webGLReady, setWebGLReady] = useState(false);
  const [showWebGL, setShowWebGL] = useState(false);
  const [OrbScene3D, setOrbScene3D] = useState<ComponentType<OrbScene3DProps> | null>(null);
  const active = status !== "idle";

  useEffect(() => {
    if (!webGLEnabled || OrbScene3D) return;

    let cancelled = false;
    let timeout = 0;
    let idleHandle = 0;

    const loadScene = () => {
      void import("./OrbScene3D").then((module) => {
        if (!cancelled) setOrbScene3D(() => module.default);
      }).catch(() => {
        if (!cancelled) setWebGLEnabled(false);
      });
    };

    const scheduleLoad = () => {
      if ("requestIdleCallback" in window && window.requestIdleCallback) {
        idleHandle = window.requestIdleCallback(loadScene, { timeout: 2600 });
        return;
      }
      timeout = window.setTimeout(loadScene, 1600);
    };

    const firstPaint = window.requestAnimationFrame(() => {
      timeout = window.setTimeout(scheduleLoad, 900);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstPaint);
      if (timeout) window.clearTimeout(timeout);
      if (idleHandle && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
    };
  }, [OrbScene3D, webGLEnabled]);

  useEffect(() => {
    if (!webGLReady) {
      setShowWebGL(false);
      return;
    }
    const timeout = window.setTimeout(() => setShowWebGL(true), 120);
    return () => window.clearTimeout(timeout);
  }, [webGLReady]);

  return (
    <div className={`orb-zone orb-zone--${status}`}>
      <span className="orb-energy-field" aria-hidden="true" />
      <motion.button
        type="button"
        className={`voice-orb voice-orb--${status} ${showWebGL ? "voice-orb--webgl-visible" : ""}`}
        onClick={onClick}
        aria-label={status === "listening" ? "Parar de ouvir" : "Falar com Jarvis"}
        animate={{ scale: status === "listening" ? [1, 1.024, 1] : [1, 1.009, 1] }}
        transition={{
          duration: status === "listening" ? 0.88 : 4.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        whileTap={{ scale: 0.985 }}
      >
        <span className="orb-loading-shell" aria-hidden="true">
          <span />
          <i />
        </span>

        {webGLEnabled && OrbScene3D && (
          <OrbScene3D
            status={status}
            onReady={() => setWebGLReady(true)}
            onUnavailable={() => {
              setWebGLReady(false);
              setWebGLEnabled(false);
            }}
          />
        )}
      </motion.button>
      <motion.div
        className="orb-status"
        layout
        animate={{
          borderColor: active ? "rgba(0, 196, 255, .62)" : "rgba(21, 111, 202, .52)",
          boxShadow: active
            ? "0 0 26px rgba(0, 152, 255, .18), inset 0 0 14px rgba(0, 122, 255, .06)"
            : "0 12px 32px rgba(0, 0, 0, .35)",
        }}
      >
        <span className={`status-spark status-spark--${status}`}><span /></span>
        {labels[status]}
      </motion.div>
    </div>
  );
}
