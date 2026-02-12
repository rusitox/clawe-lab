export const theme = {
  colors: {
    // v0-like (approx) — will refine by eyeballing parity
    bg: '#F6F3EE',
    card: '#FFFFFF',
    border: 'rgba(0,0,0,0.08)',

    textPrimary: '#111827',
    textSecondary: '#6B7280',

    primary: '#2FAF86',
    primaryText: '#FFFFFF',

    muted: '#EEF2F7',
  },
  radius: {
    xl: 22,
    lg: 18,
    md: 14,
    sm: 12,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  font: {
    title: 28,
    h1: 24,
    body: 16,
    small: 14,
  },
} as const;
