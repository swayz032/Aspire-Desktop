import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { PageErrorBoundary } from '@/components/PageErrorBoundary';

const WMO: Record<number, [string, string]> = {
  0: ['Clear sky', '☀️'],
  1: ['Mostly clear', '🌤'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Foggy', '🌫'],
  48: ['Icy fog', '🌫'],
  51: ['Light drizzle', '🌦'],
  53: ['Drizzle', '🌦'],
  55: ['Heavy drizzle', '🌦'],
  61: ['Light rain', '🌧'],
  63: ['Rain', '🌧'],
  65: ['Heavy rain', '🌧'],
  71: ['Light snow', '🌨'],
  73: ['Snow', '❄️'],
  75: ['Heavy snow', '❄️'],
  80: ['Showers', '🌦'],
  81: ['Showers', '🌦'],
  82: ['Heavy showers', '⛈'],
  95: ['Thunderstorm', '⛈'],
  96: ['Thunderstorm', '⛈'],
  99: ['Thunderstorm', '⛈'],
};

function getWmo(code: number): [string, string] {
  return WMO[code] ?? ['—', '🌡'];
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

interface WeatherState {
  temp: number;
  code: number;
  unit: string;
}

async function fetchWeatherForCoords(lat: number, lon: number): Promise<WeatherState> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current_weather=true&temperature_unit=fahrenheit`
  );
  const data = await res.json();
  return {
    temp: Math.round(data.current_weather.temperature),
    code: data.current_weather.weathercode,
    unit: '°F',
  };
}

async function loadWeather(): Promise<WeatherState> {
  // 1. Try browser geolocation (fast, 4s timeout)
  const fromBrowser = await new Promise<{ lat: number; lon: number } | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    const timer = setTimeout(() => resolve(null), 4000);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      () => { clearTimeout(timer); resolve(null); },
      { timeout: 4000, maximumAge: 300000 }
    );
  });

  if (fromBrowser) {
    return fetchWeatherForCoords(fromBrowser.lat, fromBrowser.lon);
  }

  // 2. Fallback: IP-based approximate location via server proxy (ipapi.co blocks browser CORS)
  const ipRes = await fetch('/api/geolocation');
  const ipData = await ipRes.json();
  if (ipData.latitude && ipData.longitude) {
    return fetchWeatherForCoords(ipData.latitude, ipData.longitude);
  }

  throw new Error('No location available');
}

interface Props {
  ownerName?: string;
  accentColor?: string;
  imageUrl?: string;
}

function GreetingCardInner({
  ownerName = 'Mr. Scott',
  accentColor = '#38BDF8',
  imageUrl,
}: Props) {
  if (Platform.OS !== 'web') return null;

  const [weather, setWeather] = useState<WeatherState | null>(null);

  const greeting = getTimeOfDay();
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  useEffect(() => {
    loadWeather().then(setWeather).catch(() => {});
  }, []);

  const [wmoLabel, wmoIcon] = weather ? getWmo(weather.code) : ['', ''];

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        height: 210,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      {/* Dark base */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0A0A0F' }} />

      {/* Story mode image — COVER fills the block completely */}
      {imageUrl && (
        <img
          key={imageUrl}
          src={imageUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            opacity: 0.55,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}

      {/* Accent tint overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: accentColor,
          opacity: 0.12,
          transition: 'background-color 0.4s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom-up gradient for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.1) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Left accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accentColor,
          opacity: 0.75,
          borderRadius: '14px 0 0 14px',
          transition: 'background-color 0.4s ease',
        }}
      />

      {/* Content pinned to bottom */}
      <div style={{ position: 'relative', zIndex: 1, padding: '14px 16px 16px 20px' }}>
        {/* Weather row */}
        {weather && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{wmoIcon}</span>
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600 }}>
              {weather.temp}{weather.unit}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.40)', fontSize: 12 }}>· {wmoLabel}</span>
          </div>
        )}

        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: '26px' }}>
          {greeting},
        </div>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 700, lineHeight: '26px', marginBottom: 5 }}>
          {ownerName}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: 11, letterSpacing: 0.3 }}>
          {dateStr}
        </div>
      </div>
    </div>
  );
}

export function GreetingCard(props: any) {
  return (
    <PageErrorBoundary pageName="greeting-card">
      <GreetingCardInner {...props} />
    </PageErrorBoundary>
  );
}
