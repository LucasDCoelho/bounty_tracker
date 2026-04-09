"use client";

import { useRef, useEffect, useState } from 'react';
import styles from './holographic-card.module.css';

interface HolographicCardProps {
  src: string;
  alt: string;
  className?: string;
}

export function HolographicCard({ src, alt, className = "" }: HolographicCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isHovering) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Normalizar para percentuais (0-100)
      const xPercent = (x / rect.width) * 100;
      const yPercent = (y / rect.height) * 100;

      setMousePosition({ x: xPercent, y: yPercent });

      // Aplicar as transformações 3D baseadas na posição do mouse
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * 15; // 15 graus max
      const rotateY = ((x - centerX) / centerX) * -15; // -15 graus max

      card.style.setProperty('--rotate-x', `${rotateY}deg`);
      card.style.setProperty('--rotate-y', `${rotateX}deg`);
      card.style.setProperty('--pointer-x', `${xPercent}%`);
      card.style.setProperty('--pointer-y', `${yPercent}%`);
    };

    const handleMouseEnter = () => setIsHovering(true);
    const handleMouseLeave = () => {
      setIsHovering(false);
      // Reset transformações
      card.style.setProperty('--rotate-x', '0deg');
      card.style.setProperty('--rotate-y', '0deg');
      card.style.setProperty('--pointer-x', '50%');
      card.style.setProperty('--pointer-y', '50%');
    };

    card.addEventListener('mousemove', handleMouseMove);
    card.addEventListener('mouseenter', handleMouseEnter);
    card.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      card.removeEventListener('mousemove', handleMouseMove);
      card.removeEventListener('mouseenter', handleMouseEnter);
      card.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isHovering]);

  return (
    <div
      ref={cardRef}
      className={`${styles.holographicCardContainer} ${className}`}
    >
      <div className={styles.cardRotator}>
        <div className={styles.cardFront}>
          <img src={src} alt={alt} className={styles.cardImage} />
          <div className={styles.cardShine}></div>
          <div className={styles.cardGlare}></div>
        </div>
      </div>
    </div>
  );
}
