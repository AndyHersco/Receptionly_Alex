/** @type {import('tailwindcss').Config} */
// Theme moved verbatim from the per-page `tailwind.config` inline blocks that
// the CDN build used. Colors are the union across all pages (the app pages use
// warm/rose/amber; the sign-in page uses danger/dangerSoft) so every page keeps
// its exact palette.
export default {
  content: [
    './index.html',
    './Employee.html',
    './onboarding.html',
    './onboarding_new.html',
    './signin.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#FAF8F4',
        surface: '#FFFFFF',
        ink: '#1A1815',
        ink2: '#5C5852',
        muted: '#8A857B',
        line: '#EDE9E0',
        line2: '#E2DDD1',
        accent: '#3F5D43',
        accentSoft: '#EAEFE8',
        accentInk: '#2A3F2D',
        warm: '#C97A4F',
        warmSoft: '#F5E8DE',
        rose: '#B8556A',
        roseSoft: '#F5E2E6',
        amber: '#B58300',
        amberSoft: '#F5ECCF',
        danger: '#B8556A',
        dangerSoft: '#F5E2E6',
      },
      fontFamily: {
        serif: ['"Instrument Serif"', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,18,15,.04), 0 0 0 1px rgba(20,18,15,.04)',
        pop: '0 12px 32px rgba(20,18,15,.10), 0 2px 6px rgba(20,18,15,.06)',
      },
      borderRadius: {
        xl2: '14px',
      },
    },
  },
  plugins: [],
};
