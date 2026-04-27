import { useEffect, useState } from "react";

/**
 * Tracks the on-screen keyboard height using the VisualViewport API.
 * Updates the `--keyboard-offset` CSS variable so sticky bars can lift
 * via `bottom: max(env(safe-area-inset-bottom), var(--keyboard-offset))`.
 *
 * Returns the current offset in pixels for components that prefer JS access.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;

    const update = () => {
      // Difference between layout viewport and visual viewport ≈ keyboard height.
      const next = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setOffset(next);
      document.documentElement.style.setProperty("--keyboard-offset", `${next}px`);
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}
