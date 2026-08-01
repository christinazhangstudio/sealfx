"use client";

import { useEffect, useRef } from "react";
import { changelogEntries } from "@/lib/changelog";

export default function ChangelogCard() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const firstTimelineRef = useRef<HTMLDivElement>(null);
  const repeatedTimelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let animationFrame = 0;
    let previousTime = performance.now();
    let holdUntil = previousTime + 1_500;
    let paused = false;

    const pause = () => { paused = true; };
    const resume = () => {
      paused = false;
      previousTime = performance.now();
    };

    const animate = (time: number) => {
      const firstTimeline = firstTimelineRef.current;
      const repeatedTimeline = repeatedTimelineRef.current;
      const loopPoint = firstTimeline && repeatedTimeline
        ? repeatedTimeline.offsetTop - firstTimeline.offsetTop
        : 0;

      if (!paused && loopPoint > 0 && time >= holdUntil) {
        const elapsed = Math.min(time - previousTime, 50);
        scroller.scrollTop += elapsed * 0.025;

        if (scroller.scrollTop >= loopPoint) {
          scroller.scrollTop -= loopPoint;
        }
      }

      previousTime = time;
      animationFrame = requestAnimationFrame(animate);
    };

    scroller.addEventListener("pointerenter", pause);
    scroller.addEventListener("pointerleave", resume);
    scroller.addEventListener("focusin", pause);
    scroller.addEventListener("focusout", resume);
    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      scroller.removeEventListener("pointerenter", pause);
      scroller.removeEventListener("pointerleave", resume);
      scroller.removeEventListener("focusin", pause);
      scroller.removeEventListener("focusout", resume);
    };
  }, []);

  const renderEntries = (keyPrefix: string) => changelogEntries.map((entry, index) => (
    <section key={`${keyPrefix}-${entry.date}-${index}`} className="relative">
      <span className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-primary" />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-bold text-primary">{entry.version}</h3>
        <p className="text-xs text-text-secondary">{entry.date}</p>
      </div>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-text-secondary">
        {entry.updates.map((update) => (
          <li key={update} className="flex gap-2">
            <span className="text-primary" aria-hidden="true">✦</span>
            <span>{update}</span>
          </li>
        ))}
      </ul>
    </section>
  ));

  return (
    <aside className="flex h-[32rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <h2 className="text-2xl font-bold text-primary">Changelog</h2>
        <p className="mt-1 text-sm text-text-secondary">What’s new in Sealift</p>
      </div>

      <div
        ref={scrollerRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 py-5 [scrollbar-width:thin]"
        aria-label="Changelog entries; auto-scroll pauses while hovered or focused"
        tabIndex={0}
      >
        <div ref={firstTimelineRef} className="space-y-7 border-l-2 border-primary/30 pl-5">
          {renderEntries("primary")}
        </div>
        <div
          ref={repeatedTimelineRef}
          aria-hidden="true"
          className="mt-7 space-y-7 border-l-2 border-primary/30 pl-5"
        >
          {renderEntries("repeat")}
        </div>
      </div>
    </aside>
  );
}
