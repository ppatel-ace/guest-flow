import { createContext, useContext, useEffect, useRef, useState } from "react";

type RsvpFullscreenState = { expanded: boolean; toggle: () => void };

export const RsvpFullscreenContext = createContext<RsvpFullscreenState>({
  expanded: false,
  toggle: () => {},
});

export function useRsvpFullscreen() {
  return useContext(RsvpFullscreenContext);
}

/** Fullscreen the document, not the page: body-portaled dialogs/toasts must remain visible. */
export function useRsvpFullscreenMode(enabled: boolean): RsvpFullscreenState {
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(false);
  const ownsNative = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const onFullscreenChange = () => {
      if (expandedRef.current && document.fullscreenElement === document.documentElement) {
        ownsNative.current = true;
      }
      if (ownsNative.current && !document.fullscreenElement) {
        ownsNative.current = false;
        expandedRef.current = false;
        generation.current++;
        setExpanded(false);
      }
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      generation.current++;
      expandedRef.current = false;
      setExpanded(false);
      if (ownsNative.current && document.fullscreenElement === document.documentElement) {
        void document.exitFullscreen().catch(() => {});
      }
      ownsNative.current = false;
    };
  }, [enabled]);

  const toggle = () => {
    if (!enabled) return;
    const requestGeneration = ++generation.current;
    if (expandedRef.current) {
      expandedRef.current = false;
      setExpanded(false);
      if (ownsNative.current && document.fullscreenElement === document.documentElement) {
        void document.exitFullscreen().catch(() => {
          // If the browser refuses to exit, keep the exit control available.
          if (generation.current === requestGeneration && document.fullscreenElement) {
            expandedRef.current = true;
            setExpanded(true);
          }
        });
      }
      return;
    }

    expandedRef.current = true;
    setExpanded(true);
    const root = document.documentElement;
    if (!root.requestFullscreen || document.fullscreenEnabled === false || document.fullscreenElement) return;
    try {
      // Called directly from the staff button's click, preserving user activation.
      void root.requestFullscreen().then(() => {
        if (generation.current !== requestGeneration) {
          if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
          return;
        }
        ownsNative.current = document.fullscreenElement === root;
      }).catch(() => {
        // Denied/unsupported browser fullscreen still leaves the expanded in-app view.
      });
    } catch {
      // Some embedded/tablet browsers throw synchronously instead of rejecting.
    }
  };

  return { expanded: enabled && expanded, toggle };
}
