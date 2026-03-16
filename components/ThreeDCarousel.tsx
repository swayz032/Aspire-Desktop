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
  brand: string;
  description: string;
  tags: string[];
  imageUrl: string;
  link?: string;
  accent?: string;
}

interface ThreeDCarouselProps {
  items: ThreeDCarouselItem[];
  autoRotate?: boolean;
  rotateInterval?: number;
  cardHeight?: number;
  isMobileSwipe?: boolean;
}

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState<boolean>(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", check);
    check();
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

const ThreeDCarousel = ({
  items,
  autoRotate = true,
  rotateInterval = 4000,
  cardHeight = 440,
  isMobileSwipe = true,
}: ThreeDCarouselProps) => {
  const [active, setActive] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const isMobile = useIsMobile();
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
    const base: React.CSSProperties = {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      display: "flex",
      justifyContent: "center",
      transition: "transform 400ms ease, opacity 400ms ease",
    };

    if (index === active) {
      return { ...base, transform: "translateX(0) scale(1)", opacity: 1, zIndex: 20 };
    }
    if (index === (active + 1) % items.length) {
      return { ...base, transform: "translateX(40%) scale(0.95)", opacity: 0.6, zIndex: 10, cursor: "pointer" };
    }
    if (index === (active - 1 + items.length) % items.length) {
      return { ...base, transform: "translateX(-40%) scale(0.95)", opacity: 0.6, zIndex: 10, cursor: "pointer" };
    }
    return {
      ...base,
      transform: `translateX(${index > active ? 80 : -80}%) scale(0.9)`,
      opacity: 0,
      pointerEvents: "none",
    };
  };

  return (
    <section
      id="ThreeDCarousel"
      style={{
        backgroundColor: "transparent",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "stretch",
      }}
    >
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
        <div
          style={{ position: "relative", overflow: "hidden", flex: 1, minHeight: cardHeight }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          ref={carouselRef}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {items.map((item, index) => {
              const accent = item.accent || "#38BDF8";
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
                      width: "72%",
                      maxWidth: 360,
                      height: cardHeight,
                      overflow: "hidden",
                      backgroundColor: "#111116",
                      border: `1px solid ${isCenter ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: isCenter
                        ? "0 12px 40px rgba(0,0,0,0.6)"
                        : "0 2px 12px rgba(0,0,0,0.35)",
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: 12,
                    }}
                  >
                    {/* Image hero — #0A0A0F photo zone, img objectFit contain (no cropping) */}
                    <div
                      style={{
                        position: "relative",
                        backgroundColor: "#0A0A0F",
                        height: 192,
                        overflow: "hidden",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.title}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            objectPosition: "center",
                            display: "block",
                          }}
                        />
                      ) : null}
                      {/* Accent colour overlay */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundColor: accent,
                          opacity: 0.25,
                          pointerEvents: "none",
                        }}
                      />
                      {/* Text overlay */}
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 1,
                          textAlign: "center",
                          color: "#ffffff",
                          padding: "0 12px",
                        }}
                      >
                        <h3 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px 0", textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>
                          {item.brand.toUpperCase()}
                        </h3>
                        <div
                          style={{
                            width: 40,
                            height: 3,
                            backgroundColor: accent,
                            margin: "0 auto 6px",
                            borderRadius: 2,
                          }}
                        />
                        <p style={{ fontSize: 13, margin: 0, opacity: 0.9, textShadow: "0 1px 4px rgba(0,0,0,0.7)" }}>{item.title}</p>
                      </div>
                    </div>

                    {/* Card body */}
                    <div
                      style={{
                        padding: 20,
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                        gap: 6,
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 18,
                          fontWeight: 700,
                          color: "#ffffff",
                          margin: 0,
                        }}
                      >
                        {item.title}
                      </h3>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.5)",
                          fontSize: 13,
                          fontWeight: 500,
                          margin: 0,
                        }}
                      >
                        {item.brand}
                      </p>
                      <p
                        style={{
                          color: "rgba(255,255,255,0.38)",
                          fontSize: 13,
                          margin: 0,
                          flexGrow: 1,
                        }}
                      >
                        {item.description}
                      </p>

                      {item.tags && item.tags.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {item.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                padding: "3px 8px",
                                backgroundColor: "rgba(255,255,255,0.07)",
                                color: "rgba(255,255,255,0.4)",
                                borderRadius: 20,
                                fontSize: 11,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Colored EXPLORE accent button */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginTop: 4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: accent,
                            backgroundColor: accent + "26",
                            borderRadius: 20,
                            padding: "4px 12px",
                            textTransform: "uppercase",
                            letterSpacing: "0.6px",
                          }}
                        >
                          EXPLORE
                        </div>
                        <a
                          href={item.link || "#"}
                          style={{
                            color: "rgba(255,255,255,0.35)",
                            display: "flex",
                            alignItems: "center",
                            textDecoration: "none",
                            gap: 4,
                            fontSize: 12,
                          }}
                          onClick={(e) => {
                            if (!item.link || item.link === "#") e.preventDefault();
                            else if (item.link.startsWith("/")) window.scrollTo(0, 0);
                          }}
                        >
                          Learn more
                          <ArrowRight style={{ width: 14, height: 14 }} />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Nav arrows — always shown on desktop */}
          {!isMobile && (
            <>
              <button
                style={{
                  position: "absolute",
                  left: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.75)",
                  zIndex: 30,
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={() =>
                  setActive((prev) => (prev - 1 + items.length) % items.length)
                }
                aria-label="Previous"
              >
                <ChevronLeft style={{ width: 18, height: 18 }} />
              </button>
              <button
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  backgroundColor: "rgba(0,0,0,0.65)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.75)",
                  zIndex: 30,
                  cursor: "pointer",
                  padding: 0,
                }}
                onClick={() => setActive((prev) => (prev + 1) % items.length)}
                aria-label="Next"
              >
                <ChevronRight style={{ width: 18, height: 18 }} />
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default ThreeDCarousel;
