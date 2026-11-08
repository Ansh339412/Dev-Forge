/** Palette: a cool working surface, ink for action, and a "heat" scale for work moving from raw to tempered. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Instrument Sans Variable"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { DEFAULT: '#1B2236', soft: '#2C3550' },
        surface: '#F4F6F8',
        line: '#DDE2E9',
        muted: '#5B6577',
        danger: '#C62828',
        heat: {
          ore: '#8A94A6',
          warm: '#B7791F',
          ember: '#D9480F',
          quench: '#2F6FDB',
          temper: '#1E8E7E',
        },
      },
      borderRadius: { DEFAULT: '6px' },
    },
  },
  plugins: [],
};
