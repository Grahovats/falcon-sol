import { useEffect, useRef, useState, type ReactNode } from "react";

const SCROLL_REVEAL_OBSERVER = {
  threshold: 0.08,
  rootMargin: "0px 0px -8% 0px",
} as const;

type ScrollRevealProps = {
  children: ReactNode;
  direction?: "up" | "left" | "right";
};

/*
 * SCROLL REVEAL STORYBOARD
 *
 *   enter viewport   section fades and settles into position
 *   +100ms           lime edge trace completes its sweep
 *   after reveal     section remains stable and never replays
 */
export function ScrollReveal({
  children,
  direction = "up",
}: ScrollRevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        !("IntersectionObserver" in window)),
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element || visible) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, SCROLL_REVEAL_OBSERVER);

    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={elementRef}
      className={`scroll-reveal scroll-reveal-${direction}${visible ? " scroll-reveal-visible" : ""}`}
    >
      {children}
    </div>
  );
}
