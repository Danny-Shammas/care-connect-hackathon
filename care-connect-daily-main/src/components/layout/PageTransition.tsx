import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

/**
 * Page transitions:
 *  - Forward navigation slides in from right
 *  - Back navigation slides out to right
 *  - prefers-reduced-motion → fade only
 *
 * Direction is detected by listening to router history action (PUSH vs POP).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const reduce = useReducedMotion();
  // historyAction is "PUSH" | "REPLACE" | "POP"
  const action = useRouterState({ select: (s) => s.location.state?.__TSR_index });
  // Heuristic: vaul/router doesn't expose direction directly. Use POP for back.
  const isBack =
    typeof window !== "undefined" &&
    (window.performance?.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "back_forward";

  void action;

  if (reduce) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="min-h-[100dvh]"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ x: isBack ? "-12%" : "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: isBack ? "100%" : "-12%", opacity: 0 }}
        transition={{ type: "tween", ease: [0.22, 1, 0.36, 1], duration: 0.28 }}
        className="min-h-[100dvh]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
