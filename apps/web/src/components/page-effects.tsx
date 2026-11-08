"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function PageEffects() {
  const [showPreloader, setShowPreloader] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const seen = sessionStorage.getItem("clutchverse-preloaded");
    if (!seen && !reducedMotion.matches) {
      setShowPreloader(true);
      sessionStorage.setItem("clutchverse-preloaded", "true");
      window.setTimeout(() => setShowPreloader(false), 350);
    }

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.08 },
    );
    document
      .querySelectorAll(
        ".page-transition .section, .page-transition .game-card",
      )
      .forEach((element) => {
        element.classList.add("scroll-reveal");
        observer.observe(element);
      });

    const resetMagnetic = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element) {
        target.closest(".magnetic-button")?.removeAttribute("style");
      }
    };
    const moveMagnetic = (event: PointerEvent) => {
      if (
        reducedMotion.matches ||
        document.documentElement.dataset.performance === "true"
      )
        return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(".magnetic-button");
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const x = event.clientX - rect.left - rect.width / 2;
      const y = event.clientY - rect.top - rect.height / 2;
      button.style.transform = `translate(${x * 0.08}px, ${y * 0.12}px)`;
    };
    document.addEventListener("pointermove", moveMagnetic, { passive: true });
    document.addEventListener("pointerout", resetMagnetic);

    return () => {
      observer.disconnect();
      document.removeEventListener("pointermove", moveMagnetic);
      document.removeEventListener("pointerout", resetMagnetic);
    };
  }, [pathname]);

  return showPreloader ? (
    <div className="site-preloader" aria-hidden="true">
      <span className="brand-mark">
        C<span>V</span>
      </span>
    </div>
  ) : null;
}
