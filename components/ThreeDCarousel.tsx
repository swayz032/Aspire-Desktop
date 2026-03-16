// components/ThreeDCarousel.tsx
// Source: node_modules/lightswind/dist/components/ui/3d-carousel.tsx
// Adapted: Tailwind → inline styles, Card → div, Link → <a>, useIsMobile → inlined
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

// inlined from lightswind/dist/components/hooks/use-mobile
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
  cardHeight = 500,
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

  // Lightswind logic: translate-x-[40%] scale-95 opacity-60 z-10 etc.
  // Wrapper is 100%-wide flex-center; card inside is 70% width.
  // translateX on the wrapper uses % of the wrapper (container) width,
  // so side cards peek in from left/right edges.
  const getCardStyle = (index: number): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      display: "flex",
      justifyContent: "center",
      transition: "transform 500ms ease, opacity 500ms ease",
    };

    if (index === active) {
      // scale-100 opacity-100 z-20
      return { ...base, transform: "translateX(0) scale(1)", opacity: 1, zIndex: 20 };
    }
    if (index === (active + 1) % items.length) {
      // translate-x-[40%] scale-95 opacity-60 z-10
      return { ...base, transform: "translateX(40%) scale(0.95)", opacity: 0.6, zIndex: 10, cursor: "pointer" };
    }
    if (index === (active - 1 + items.length) % items.length) {
      // translate-x-[-40%] scale-95 opacity-60 z-10
      return { ...base, transform: "translateX(-40%) scale(0.95)", opacity: 0.6, zIndex: 10, cursor: "pointer" };
    }
    // scale-90 opacity-0
    return {
      ...base,
      transform: `translateX(${index > active ? 80 : -80}%) scale(0.9)`,
      opacity: 0,
      pointerEvents: "none",
    };
  };

  return (
    // bg-transparent min-w-full mx-auto flex items-center justify-center
    <section
      id="ThreeDCarousel"
      style={{
        backgroundColor: "transparent",
        minWidth: "100%",
        margin: "0 auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* w-full px-4 min-w-[350px] md:min-w-[1000px] max-w-7xl */}
      <div
        style={{
          width: "100%",
          padding: "0 16px",
          minWidth: 350,
          maxWidth: 1280,
        }}
      >
        {/* relative overflow-hidden h-[550px] */}
        <div
          style={{ position: "relative", overflow: "hidden", height: 550 }}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          ref={carouselRef}
        >
          {/* absolute top-0 left-0 w-full h-full flex items-center justify-center */}
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
            {items.map((item, index) => (
              <div
                key={item.id}
                style={getCardStyle(index)}
                onClick={() => {
                  if (index !== active) setActive(index);
                }}
              >
                {/* Card: overflow-hidden bg-background h-[${cardHeight}px] border shadow-sm flex flex-col */}
                {/* Dark-themed: bg-background → #111116, width constrained so side cards peek */}
                <div
                  style={{
                    width: "72%",
                    maxWidth: 360,
                    overflow: "hidden",
                    backgroundColor: "#111116",
                    height: cardHeight,
                    border: "1px solid rgba(255,255,255,0.09)",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.4), 0 4px 20px rgba(0,0,0,0.3)",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: 12,
                  }}
                >
                  {/* relative bg-black p-6 flex items-center justify-center h-48 overflow-hidden */}
                  <div
                    style={{
                      position: "relative",
                      backgroundColor: "#000",
                      padding: 24,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: 192,
                      overflow: "hidden",
                      backgroundImage: `url(${item.imageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {/* absolute inset-0 bg-black/50 */}
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                      }}
                    />
                    {/* relative z-10 text-center text-white */}
                    <div
                      style={{
                        position: "relative",
                        zIndex: 1,
                        textAlign: "center",
                        color: "#ffffff",
                      }}
                    >
                      {/* text-2xl font-bold mb-2 */}
                      <h3
                        style={{
                          fontSize: 24,
                          fontWeight: 700,
                          marginBottom: 8,
                          margin: "0 0 8px 0",
                        }}
                      >
                        {item.brand.toUpperCase()}
                      </h3>
                      {/* w-12 h-1 bg-white mx-auto mb-2 */}
                      <div
                        style={{
                          width: 48,
                          height: 4,
                          backgroundColor: item.accent || "#ffffff",
                          margin: "0 auto 8px",
                          borderRadius: 2,
                        }}
                      />
                      {/* text-sm */}
                      <p style={{ fontSize: 14, margin: 0 }}>{item.title}</p>
                    </div>
                  </div>

                  {/* CardContent: p-6 flex flex-col flex-grow */}
                  <div
                    style={{
                      padding: 24,
                      display: "flex",
                      flexDirection: "column",
                      flexGrow: 1,
                    }}
                  >
                    {/* text-xl font-bold mb-1 text-foreground */}
                    <h3
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        marginBottom: 4,
                        color: "#ffffff",
                        margin: "0 0 4px 0",
                      }}
                    >
                      {item.title}
                    </h3>
                    {/* text-gray-500 text-sm font-medium mb-2 */}
                    <p
                      style={{
                        color: "rgba(255,255,255,0.5)",
                        fontSize: 14,
                        fontWeight: 500,
                        marginBottom: 8,
                        margin: "0 0 8px 0",
                      }}
                    >
                      {item.brand}
                    </p>
                    {/* text-gray-600 text-sm flex-grow */}
                    <p
                      style={{
                        color: "rgba(255,255,255,0.4)",
                        fontSize: 14,
                        flexGrow: 1,
                        margin: 0,
                      }}
                    >
                      {item.description}
                    </p>

                    {/* mt-4 */}
                    <div style={{ marginTop: 16 }}>
                      {/* flex flex-wrap gap-2 mb-4 */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          marginBottom: 16,
                        }}
                      >
                        {item.tags.map((tag, idx) => (
                          // px-2 py-1 bg-gray-50 text-gray-600 rounded-full text-xs
                          <span
                            key={idx}
                            style={{
                              padding: "4px 8px",
                              backgroundColor: "rgba(255,255,255,0.07)",
                              color: "rgba(255,255,255,0.45)",
                              borderRadius: 20,
                              fontSize: 12,
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* text-gray-500 flex items-center hover:underline */}
                      <a
                        href={item.link || "#"}
                        style={{
                          color: "rgba(255,255,255,0.45)",
                          display: "flex",
                          alignItems: "center",
                          textDecoration: "none",
                          position: "relative",
                          gap: 4,
                        }}
                        onClick={(e) => {
                          if (!item.link || item.link === "#") {
                            e.preventDefault();
                          } else if (item.link.startsWith("/")) {
                            window.scrollTo(0, 0);
                          }
                        }}
                      >
                        <span style={{ position: "relative", zIndex: 1 }}>Learn more</span>
                        <ArrowRight
                          style={{ marginLeft: 8, width: 16, height: 16, position: "relative", zIndex: 1 }}
                        />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nav buttons — only shown when not mobile */}
          {!isMobile && (
            <>
              {/* absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 rounded-full ... z-30 */}
              <button
                style={{
                  position: "absolute",
                  left: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 40,
                  height: 40,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.8)",
                  zIndex: 30,
                  boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  padding: 0,
                }}
                onClick={() =>
                  setActive((prev) => (prev - 1 + items.length) % items.length)
                }
                aria-label="Previous"
              >
                <ChevronLeft style={{ width: 20, height: 20 }} />
              </button>
              <button
                style={{
                  position: "absolute",
                  right: 16,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 40,
                  height: 40,
                  backgroundColor: "rgba(255,255,255,0.15)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "50%",
                  border: "1px solid rgba(255,255,255,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "rgba(255,255,255,0.8)",
                  zIndex: 30,
                  boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  padding: 0,
                }}
                onClick={() => setActive((prev) => (prev + 1) % items.length)}
                aria-label="Next"
              >
                <ChevronRight style={{ width: 20, height: 20 }} />
              </button>
            </>
          )}

          {/* absolute bottom-6 left-0 right-0 flex justify-center items-center space-x-3 z-30 */}
          <div
            style={{
              position: "absolute",
              bottom: 24,
              left: 0,
              right: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 12,
              zIndex: 30,
            }}
          >
            {items.map((item, idx) => (
              <button
                key={idx}
                style={{
                  width: active === idx ? 20 : 8,
                  height: 8,
                  borderRadius: 4,
                  border: "none",
                  outline: "none",
                  cursor: "pointer",
                  backgroundColor: active === idx
                    ? (item.accent || "rgba(100,100,100,1)")
                    : "rgba(200,200,200,0.3)",
                  transition: "all 0.3s ease",
                  padding: 0,
                }}
                onClick={() => setActive(idx)}
                aria-label={`Go to item ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ThreeDCarousel;
