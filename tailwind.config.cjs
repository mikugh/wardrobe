module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#faf8f5',
        // A slightly deeper paper tone for wells and image backdrops.
        sand: '#f2eee8',
        // Hairline borders, warmer than stone-200.
        line: '#e9e3db',
        ink: '#1c1917',
        accent: {
          DEFAULT: '#b4583a',
          dark: '#8f4229',
          light: '#f6e7df',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['Fraunces Variable', 'Georgia', 'serif'],
      },
      boxShadow: {
        // Soft, layered, warm-tinted shadows.
        hairline: '0 0 0 1px rgb(28 25 23 / 0.07)',
        card: '0 0 0 1px rgb(28 25 23 / 0.05), 0 1px 2px rgb(28 25 23 / 0.04), 0 4px 12px -6px rgb(28 25 23 / 0.08)',
        lift: '0 0 0 1px rgb(28 25 23 / 0.05), 0 2px 4px rgb(28 25 23 / 0.04), 0 18px 36px -18px rgb(28 25 23 / 0.28)',
        sheet: '0 -1px 0 rgb(28 25 23 / 0.04), 0 -16px 48px -16px rgb(28 25 23 / 0.30)',
        bar: '0 -1px 0 rgb(28 25 23 / 0.06), 0 -8px 24px -12px rgb(28 25 23 / 0.10)',
        fab: '0 1px 2px rgb(143 66 41 / 0.30), 0 10px 24px -6px rgb(180 88 58 / 0.55), inset 0 1px 0 rgb(255 255 255 / 0.20)',
        button: '0 1px 2px rgb(143 66 41 / 0.25), 0 4px 12px -4px rgb(180 88 58 / 0.45), inset 0 1px 0 rgb(255 255 255 / 0.14)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
      keyframes: {
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
        sheet: { from: { transform: 'translateY(40px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        dialog: { from: { transform: 'translateY(12px) scale(0.98)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        rise: { from: { transform: 'translateY(10px)', opacity: '0' }, to: { transform: 'none', opacity: '1' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.22)' }, '100%': { transform: 'scale(1)' } },
      },
      animation: {
        fade: 'fade 220ms ease-out',
        sheet: 'sheet 360ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        dialog: 'dialog 280ms cubic-bezier(0.2, 0.8, 0.2, 1)',
        rise: 'rise 480ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        pop: 'pop 320ms cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
