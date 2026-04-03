import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        assistant: ['Assistant', 'sans-serif'],
      },
      colors: {
        brand: {
          teal: '#2dd4bf',
          cyan: '#a5f3fc',
          indigo: '#1e1b4b',
        },
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 0.5s ease forwards',
        'pulse-green': 'pulseGreen 1.5s infinite ease-in-out',
      },
      keyframes: {
        fadeSlideIn: {
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseGreen: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.8' },
          '50%': { transform: 'scale(1.1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
