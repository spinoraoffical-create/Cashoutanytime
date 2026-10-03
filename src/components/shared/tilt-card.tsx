"use client";

import { useState, useRef } from "react";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
}

/** 3D Interactive Mouse Physics Card (Pinterest & Dribbble Casino Motion Style) */
export function TiltCard({ children, className = "" }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [rotX, setRotX] = useState(0);
  const [rotY, setRotY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -12; // tilt max 12 deg
    const rotateY = ((x - centerX) / centerX) * 12;

    setRotX(rotateX);
    setRotY(rotateY);
  }

  function handleMouseEnter() {
    setIsHovered(true);
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setRotX(0);
    setRotY(0);
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        perspective: "1000px",
      }}
      className="inline-block w-full"
    >
      <div
        style={{
          transform: isHovered
            ? `rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`
            : "rotateX(0deg) rotateY(0deg) scale(1)",
          transition: isHovered ? "transform 0.1s ease-out" : "transform 0.5s ease-in-out",
        }}
        className={`relative transition-all duration-300 ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
