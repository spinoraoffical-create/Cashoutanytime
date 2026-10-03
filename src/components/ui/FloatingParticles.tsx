"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#7c3aed", "#a78bfa", "#fbbf24", "#c084fc"];

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  color: string;
  drift: number;
}

function createParticle(width: number, height: number): Particle {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: 1 + Math.random() * 3,
    speed: 0.3 + Math.random() * 0.9,
    opacity: 0.2 + Math.random() * 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    drift: -0.3 + Math.random() * 0.6,
  };
}

export function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    let animationId: number;
    let particles: Particle[] = [];

    function resize() {
      const rect = parent!.getBoundingClientRect();
      canvas!.width = rect.width;
      canvas!.height = rect.height;
      particles = Array.from({ length: 40 }, () =>
        createParticle(canvas!.width, canvas!.height)
      );
    }

    function animate() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.y -= p.speed;
        p.x += p.drift;

        if (p.y < 0) {
          p.y = canvas.height;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(animate);
    }

    resize();
    animate();

    const observer = new ResizeObserver(resize);
    observer.observe(parent);

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      aria-hidden="true"
    />
  );
}
