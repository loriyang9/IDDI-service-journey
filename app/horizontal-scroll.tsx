"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

export default function HorizontalScroll({
  className,
  ariaLabel,
  children,
}: {
  className: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const element = scroller.current;
    if (!element) return;
    const overflow = element.scrollWidth - element.clientWidth;
    setEdges({
      left: overflow > 2 && element.scrollLeft > 36,
      right: overflow > 2 && element.scrollLeft < overflow - 2,
    });
  }, []);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    element.addEventListener("scroll", updateEdges, { passive: true });
    window.addEventListener("resize", updateEdges);
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", updateEdges);
      window.removeEventListener("resize", updateEdges);
    };
  }, [updateEdges, children]);

  return (
    <div className={`scroll-shell ${edges.left ? "can-scroll-left" : ""} ${edges.right ? "can-scroll-right" : ""}`}>
      <div ref={scroller} className={className} tabIndex={0} aria-label={ariaLabel}>
        {children}
      </div>
      <span className="scroll-edge scroll-edge-left" aria-hidden="true">←</span>
      <span className="scroll-edge scroll-edge-right" aria-hidden="true">→</span>
    </div>
  );
}
