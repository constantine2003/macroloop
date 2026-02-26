export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'scanin': 'scanin 0.4s ease-out',
        'glitch': 'glitch 0.3s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
        'ripple': 'ripple 1.5s ease-out infinite',
      },
      keyframes: {
        blink: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0 } },
        scanin: { '0%': { clipPath: 'inset(0 0 100% 0)' }, '100%': { clipPath: 'inset(0 0 0% 0)' } },
        glitch: { '0%,100%': { transform: 'translate(0)' }, '20%': { transform: 'translate(-2px, 2px)' }, '40%': { transform: 'translate(2px, -2px)' }, '60%': { transform: 'translate(-1px, 1px)' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        ripple: { '0%': { transform: 'scale(1)', opacity: '0.6' }, '100%': { transform: 'scale(2.5)', opacity: '0' } },
      }
    },
  },
  plugins: [],
}