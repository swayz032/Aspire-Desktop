import React, { useState, useEffect } from 'react';
import { Platform } from 'react-native';

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

interface Props {
  ownerName?: string;
  accentColor?: string;
  imageUrl?: string;
}

export function GreetingCard({
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
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current_weather=true&temperature_unit=fahrenheit`
          );
          const data = await res.json();
          setWeather({
            temp: Math.round(data.current_weather.temperature),
            code: data.current_weather.weathercode,
            unit: '°F',
          });
        } catch {}
      },
      () => {},
      { timeout: 6000, maximumAge: 300000 }
    );
  }, []);

  const [wmoLabel, wmoIcon] = weather ? getWmo(weather.code) : ['', ''];

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
        minHeight: 190,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        height: '100%',
      }}
    >
      {/* Dark base */}
      <div style={{ position: 'absolute', inset: 0, backgroundColor: '#0A0A0F' }} />

      {/* Story mode image — contained, no cropping, blends into dark bg */}
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
            objectFit: 'contain',
            objectPosition: 'center',
            opacity: 0.5,
            transition: 'opacity 0.7s ease',
          }}
        />
      )}

      {/* Accent tint overlay — updates with story mode */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: accentColor,
          opacity: 0.1,
          transition: 'background-color 0.5s ease',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom-up gradient for text readability */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.08) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Accent left-edge accent bar */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: accentColor,
          opacity: 0.7,
          borderRadius: '14px 0 0 14px',
          transition: 'background-color 0.5s ease',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, padding: '16px 18px 18px 20px' }}>
        {weather && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 17, lineHeight: 1 }}>{wmoIcon}</span>
            <span style={{ color: 'rgba(255,255,255,0.80)', fontSize: 13, fontWeight: 600 }}>
              {weather.temp}{weather.unit}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12 }}>· {wmoLabel}</span>
          </div>
        )}

        <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: '27px' }}>
          {greeting},
        </div>
        <div style={{ color: '#fff', fontSize: 21, fontWeight: 700, lineHeight: '27px', marginBottom: 6 }}>
          {ownerName}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.38)',
            fontSize: 11,
            fontWeight: 400,
            letterSpacing: 0.3,
          }}
        >
          {dateStr}
        </div>
      </div>
    </div>
  );
}
