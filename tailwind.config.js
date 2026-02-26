/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
          light: '#e0e7ff',
        },
        danger: '#ef4444',
        success: '#22c55e',
        warning: '#f59e0b',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'blink': 'blink 1s ease-in-out infinite',
        'ripple': 'ripple 1.5s ease-out infinite',
        'countdown': 'countdown 1s ease-in-out infinite',
        'slide-up': 'slideUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        blink: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
        ripple: { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(2.2)', opacity: '0' } },
        countdown: { '0%': { transform: 'scale(1.2)', opacity: '0.5' }, '50%': { transform: 'scale(1)', opacity: '1' }, '100%': { transform: 'scale(0.9)', opacity: '0.5' } },
        slideUp: { '0%': { transform: 'translateY(8px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      }
    },
  },
  plugins: [],
}
