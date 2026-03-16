"use client";

import React, {
  useRef,
  useEffect,
  useState,
  TouchEvent,
} from "react";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";

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
  cardHeight = 460,
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
      { threshold: 0.1 }
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
      width: '100%',
      maxWidth: 400,
      transition: 'transform 500ms cubic-bezier(0.4,0,0.2,1), opacity 500ms ease',
    };

    if (isCenter) {
      return {
        ...base,
        transform: 'translateX(-50%) scale(1)',
        left: '50%',
        opacity: 1,
        zIndex: 20,
        pointerEvents: 'auto',
      };
    }
    if (isNext) {
      return {
        ...base,
        transform: 'translateX(calc(-50% + 60%)) scale(0.88)',
        left: '50%',
        opacity: 0.6,
        zIndex: 10,
        pointerEvents: 'auto',
        cursor: 'pointer',
      };
    }
    if (isPrev) {
      return {
        ...base,
        transform: 'translateX(calc(-50% - 60%)) scale(0.88)',
        left: '50%',
        opacity: 0.6,
        zIndex: 10,
        pointerEvents: 'auto',
        cursor: 'pointer',
      };
    }
    return {
      ...base,
      transform: index > active
        ? 'translateX(calc(-50% + 120%)) scale(0.8)'
        : 'translateX(calc(-50% - 120%)) scale(0.8)',
      left: '50%',
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
      <div style={{ width: '100%' }}>
        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            height: cardHeight + 56,
          }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          ref={carouselRef}
        >
          {items.map((item, index) => {
            const accent = item.accent || '#38BDF8';
            const isCenter = index === active;

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
                    overflow: 'hidden',
                    backgroundColor: '#0D0D12',
                    height: cardHeight,
                    border: `1px solid ${isCenter ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 16,
                    boxShadow: isCenter
                      ? '0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)'
                      : '0 4px 20px rgba(0,0,0,0.4)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      height: 200,
                      backgroundImage: `url(${item.imageUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.72) 100%)`,
                        pointerEvents: 'none',
                      }}
                    />
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        textAlign: 'center',
                        color: '#ffffff',
                        padding: '0 20px',
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 22,
                          fontWeight: 800,
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                          margin: 0,
                          marginBottom: 8,
                          textShadow: '0 2px 12px rgba(0,0,0,0.6)',
                        }}
                      >
                        {item.title}
                      </h3>
                      <div
                        style={{
                          width: 48,
                          height: 3,
                          backgroundColor: accent,
                          borderRadius: 2,
                          margin: '0 auto 8px',
                        }}
                      />
                      <p
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.75)',
                          margin: 0,
                          textShadow: '0 1px 6px rgba(0,0,0,0.5)',
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      flex: 1,
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <h3
                      style={{
                        fontSize: 16,
                        fontWeight: 700,
                        color: '#ffffff',
                        margin: 0,
                      }}
                    >
                      {item.title}
                    </h3>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.45)',
                        margin: 0,
                      }}
                    >
                      {item.description}
                    </p>

                    {item.tags && item.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: 10,
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              color: 'rgba(255,255,255,0.35)',
                              borderRadius: 20,
                              padding: '3px 9px',
                              border: '1px solid rgba(255,255,255,0.08)',
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto' }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: 'rgba(255,255,255,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Learn more
                        <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <button
            onClick={() =>
              setActive((prev) => (prev - 1 + items.length) % items.length)
            }
            aria-label="Previous"
            style={{
              position: 'absolute',
              left: 8,
              top: '45%',
              transform: 'translateY(-50%)',
              width: 36,
              height: 36,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(10,10,15,0.8)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
              zIndex: 30,
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setActive((prev) => (prev + 1) % items.length)}
            aria-label="Next"
            style={{
              position: 'absolute',
              right: 8,
              top: '45%',
              transform: 'translateY(-50%)',
              width: 36,
              height: 36,
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.12)',
              background: 'rgba(10,10,15,0.8)',
              backdropFilter: 'blur(8px)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.7)',
              zIndex: 30,
              transition: 'all 0.15s ease',
              padding: 0,
            }}
          >
            <ChevronRight size={16} />
          </button>

          <div
            style={{
              position: 'absolute',
              bottom: 8,
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
                  width: active === idx ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  background: active === idx
                    ? (item.accent || '#38BDF8')
                    : 'rgba(255,255,255,0.2)',
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
