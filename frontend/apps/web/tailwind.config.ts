import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary - NYS Blue
        primary: {
          DEFAULT: '#154973',
          strong: '#0e324f',
          stronger: '#081b2b',
          mid: '#457aa5',
          weak: '#cddde9',
          weaker: '#eff6fb',
          faint: '#f7fafd',
        },
        // Accent - NYS Yellow
        accent: {
          DEFAULT: '#face00',
          muted: '#fef3c7',
        },
        // Semantic colors
        success: {
          DEFAULT: '#1e752e',
          bg: '#dcfce7',
        },
        warning: {
          DEFAULT: '#b45309',
          bg: '#fef3c7',
        },
        danger: {
          DEFAULT: '#b52c2c',
          bg: '#fee2e2',
        },
        info: {
          DEFAULT: '#004dd1',
          bg: '#dbeafe',
        },
        // Surfaces
        surface: {
          DEFAULT: '#ffffff',
          raised: '#f6f6f6',
        },
        background: '#f7fafd',
        // Text
        text: {
          DEFAULT: '#1b1b1b',
          secondary: '#525252',
          muted: '#6b6b6b',
          inverse: '#ffffff',
        },
        // Links
        link: {
          DEFAULT: '#004dd1',
          hover: '#003ba1',
        },
        // Neutrals
        neutral: {
          50: '#f6f6f6',
          100: '#ededed',
          200: '#d4d4d4',
          300: '#b3b3b3',
          400: '#8c8c8c',
          500: '#6b6b6b',
          600: '#525252',
          700: '#404040',
          800: '#2d2d2d',
          900: '#1b1b1b',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter, "Inter")', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono, "JetBrains Mono")', 'SF Mono', 'Consolas', 'Monaco', 'monospace'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      borderRadius: {
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        DEFAULT: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
      },
      transitionDuration: {
        fast: '150ms',
        DEFAULT: '200ms',
        slow: '300ms',
      },
      maxWidth: {
        'container-sm': '640px',
        'container-md': '768px',
        'container-lg': '1024px',
        'container-xl': '1280px',
        'container-2xl': '1536px',
      },
    },
  },
  plugins: [],
};

export default config;
