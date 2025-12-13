import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'Deproceduralizer - Regulatory Analysis Tool';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #154973 0%, #0e324f 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 120,
            height: 120,
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            borderRadius: 24,
            marginBottom: 40,
          }}
        >
          <svg
            width="72"
            height="72"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: 'white',
            marginBottom: 16,
            letterSpacing: '-0.02em',
          }}
        >
          Deproceduralizer
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: 'rgba(255, 255, 255, 0.8)',
            textAlign: 'center',
            maxWidth: 800,
            lineHeight: 1.4,
          }}
        >
          Regulatory Analysis Tool for Identifying Compliance Issues
        </div>

        {/* Footer badge */}
        <div
          style={{
            position: 'absolute',
            bottom: 40,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 18,
            color: 'rgba(255, 255, 255, 0.6)',
          }}
        >
          <span>Powered by</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 600 }}>
            Recoding America Fund
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
