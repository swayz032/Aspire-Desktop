"use client";

import React, {
  useRef,
  useEffect,
  useState,
  TouchEvent,
} from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface ThreeDCarouselItem {
  id: number | string;
  title: string;
  description: string;
  tags: string[];
  imageUrl: string;
  accent?: string;
}

interface ThreeDCarouselProps {
  items: ThreeDCarouselItem[];
  autoRotate?: boolean;
  rotateInterval?: number;
  cardHeight?: number;
}

const ThreeDCarousel = ({
  items,
  autoRotate = true,
  rotateInterval = 4000,
  cardHeight = 420,
}: ThreeDCarouselProps) => {
  const [active, setActive] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const minSwipeDistance = 50;

  useEffect(() => {
    if (autoRotate && isInView && !isHovering) {
      const interval = setInterval(() => {
        setActive((prev) => (prev + 1) % items.length);
      }, rotateInterval);
      return () => clearInterval(interval);
    }
  }, [isInView, isHovering, autoRotate, rotateInterval, items.length]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onTouchStart = (e: TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    if (distance > minSwipeDistance) {
      setActive((prev) => (prev + 1) % items.length);
    } else if (distance < -minSwipeDistance) {
      setActive((prev) => (prev - 1 + items.length) % items.length);
    }
  };

  const getCardStyle = (index: number): React.CSSProperties => {
    const isCenter = index === active;
    const isNext = index === (active + 1) % items.length;
    const isPrev = index === (active - 1 + items.length) % items.length;

    const base: React.CSSProperties = {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      transition: 'transform 400ms ease, opacity 400ms ease',
    };

    if (isCenter) {
      return {
        ...base,
        transform: 'scale(1) translateX(0)',
        opacity: 1,
        zIndex: 20,
        pointerEvents: 'auto',
      };
    }
    if (isNext) {
      return {
        ...base,
        transform: 'translateX(40%) scale(0.95)',
        opacity: 0.60,
        zIndex: 10,
        pointerEvents: 'auto',
        cursor: 'pointer',
      };
    }
    if (isPrev) {
      return {
        ...base,
        transform: 'translateX(-40%) scale(0.95)',
        opacity: 0.60,
        zIndex: 10,
        pointerEvents: 'auto',
        cursor: 'pointer',
      };
    }
    return {
      ...base,
      transform: `translateX(${index > active ? 80 : -80}%) scale(0.9)`,
      opacity: 0,
      zIndex: 0,
      pointerEvents: 'none',
    };
  };

  return (
    <section
      style={{
        backgroundColor: 'transparent',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '0 24px',
          maxWidth: 1280,
        }}
      >
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: cardHeight + 80,
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          ref={carouselRef}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {items.map((item, index) => {
              const accent = item.accent || '#38BDF8';
              return (
                <div
                  key={item.id}
                  style={getCardStyle(index)}
                  onClick={() => {
                    if (index !== active) setActive(index);
                  }}
                >
                  <div
                    style={{
                      width: '70%',
                      maxWidth: 320,
                      overflow: 'hidden',
                      backgroundColor: '#111116',
                      height: cardHeight,
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 14,
                      boxShadow: index === active
                        ? '0 12px 40px rgba(0,0,0,0.55)'
                        : '0 4px 18px rgba(0,0,0,0.35)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        backgroundColor: '#0A0A0F',
                        height: '60%',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          objectPosition: 'center',
                          display: 'block',
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundColor: accent,
                          opacity: 0.25,
                          pointerEvents: 'none',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        height: '40%',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: '#ffffff',
                          margin: 0,
                        }}
                      >
                        {item.title}
                      </h3>
                      <p
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.5)',
                          margin: 0,
                        }}
                      >
                        {item.description}
                      </p>

                      {item.tags && item.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {item.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: 10,
                                backgroundColor: 'rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.35)',
                                borderRadius: 10,
                                padding: '2px 8px',
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: accent,
                          backgroundColor: accent + '26',
                          borderRadius: 20,
                          padding: '4px 10px',
                          alignSelf: 'flex-start',
                          marginTop: 'auto',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        EXPLORE
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() =>
              setActive((prev) => (prev - 1 + items.length) % items.length)
            }
            aria-label="Previous"
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 32,
              height: 32,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              zIndex: 30,
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            <ChevronLeft size={14} color="currentColor" />
          </button>
          <button
            onClick={() => setActive((prev) => (prev + 1) % items.length)}
            aria-label="Next"
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 32,
              height: 32,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.65)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              zIndex: 30,
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            <ChevronRight size={14} color="currentColor" />
          </button>

          <div
            style={{
              position: 'absolute',
              bottom: 6,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 6,
              zIndex: 30,
            }}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActive(idx)}
                aria-label={`Go to item ${idx + 1}`}
                style={{
                  width: active === idx ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  background: active === idx
                    ? (item.accent || '#38BDF8')
                    : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.3s ease',
                  padding: 0,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ThreeDCarousel;
