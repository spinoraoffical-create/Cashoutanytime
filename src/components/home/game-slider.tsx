"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GAMES } from "@/lib/games";
import { CompactGameCard } from "@/components/home/compact-game-card";
import { useInView } from "@/lib/hooks/use-in-view";
import { useIsMobile, usePrefersReducedMotion } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function GameSlider() {
  const isMobile = useIsMobile();
  const reducedMotion = usePrefersReducedMotion();
  const autoScroll = !isMobile && !reducedMotion;
  const availableGames = GAMES.filter((g) => !g.upcoming);

  const items = autoScroll ? [...availableGames, ...availableGames] : availableGames;
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const dragMoved = useRef(0);
  const [paused, setPaused] = useState(!autoScroll);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const { ref: sectionRef, inView } = useInView("100px");

  const loopScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !autoScroll) return;
    const half = el.scrollWidth / 2;
    if (half <= 0) return;
    if (el.scrollLeft >= half) {
      el.scrollLeft -= half;
    } else if (el.scrollLeft <= 0) {
      el.scrollLeft += half;
    }
  }, [autoScroll]);

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft === 0 && el.scrollWidth > 0) {
      el.scrollLeft = 1;
    }
  }, [autoScroll]);

  useEffect(() => {
    if (!autoScroll || !inView) return;
    const el = scrollRef.current;
    if (!el || paused) return;

    let raf = 0;
    let running = true;

    const tick = () => {
      if (!running) return;
      if (
        inView &&
        !paused &&
        !isDragging.current &&
        document.visibilityState === "visible"
      ) {
        el.scrollLeft += 0.35;
        loopScroll();
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
  }, [paused, loopScroll, autoScroll, inView]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!autoScroll) return;
    if (e.pointerType === "touch") return;
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("a")) return;

    const el = scrollRef.current;
    if (!el) return;

    isDragging.current = true;
    dragMoved.current = 0;
    dragStartX.current = e.clientX;
    dragScrollLeft.current = el.scrollLeft;
    setPaused(true);
    setIsGrabbing(true);

    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore — mobile browsers may reject */
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!autoScroll || e.pointerType === "touch" || !isDragging.current || !scrollRef.current) return;
    const dx = e.clientX - dragStartX.current;
    dragMoved.current = Math.max(dragMoved.current, Math.abs(dx));
    scrollRef.current.scrollLeft = dragScrollLeft.current - dx;
    loopScroll();
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!autoScroll || e.pointerType === "touch" || !isDragging.current || !scrollRef.current) return;

    isDragging.current = false;
    setIsGrabbing(false);

    try {
      scrollRef.current.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }

    loopScroll();
    window.setTimeout(() => setPaused(false), 1500);
  }

  function blockClickIfDragged(e: React.MouseEvent) {
    if (dragMoved.current > 6) {
      e.preventDefault();
      e.stopPropagation();
    }
    dragMoved.current = 0;
  }

  return (
    <section ref={sectionRef} className="game-slider-wrap py-1" aria-label="Featured games slider">
      <div
        ref={scrollRef}
        className={cn(
          "game-slider-scroll flex gap-3 sm:gap-4 overflow-x-auto overscroll-x-contain",
          autoScroll ? "select-none" : "snap-x snap-mandatory scroll-smooth",
          autoScroll && (isGrabbing ? "cursor-grabbing" : "cursor-grab")
        )}
        style={{ WebkitOverflowScrolling: "touch" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={autoScroll ? () => setPaused(true) : undefined}
        onMouseLeave={
          autoScroll
            ? () => {
                if (!isDragging.current) setPaused(false);
              }
            : undefined
        }
        onClickCapture={autoScroll ? blockClickIfDragged : undefined}
      >
        {items.map((game, i) => (
          <CompactGameCard
            key={`${game.id}-${i}`}
            game={game}
            variant="slider"
            eager={i < 3}
            className={!autoScroll ? "snap-start" : undefined}
          />
        ))}
      </div>
    </section>
  );
}
