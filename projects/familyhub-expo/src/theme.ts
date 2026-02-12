export const theme = {
  colors: {
    // v0 parity targets (tuned iteratively by eyeballing v0 preview)
    bg: '#F5F1EA',
    card: '#FFFFFF',
    border: 'rgba(15, 23, 42, 0.08)',

    textPrimary: '#0F172A',
    textSecondary: 'rgba(15, 23, 42, 0.55)',

    primary: '#2FAF86',
    primaryText: '#FFFFFF',

    pillBlueBg: 'rgba(59, 130, 246, 0.14)',
    pillBlueText: '#2563EB',
    pillGreenBg: 'rgba(16, 185, 129, 0.14)',
    pillGreenText: '#059669',
    pillOrangeBg: 'rgba(245, 158, 11, 0.18)',
    pillOrangeText: '#B45309',

    // surfaces
    controlBg: 'rgba(255, 255, 255, 0.70)',
    controlBorder: 'rgba(15, 23, 42, 0.08)',
  },
  radius: {
    xl: 24,
    lg: 18,
    md: 16,
    sm: 14,
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    title: { fontSize: 28, fontWeight: '900' as const },
    h1: { fontSize: 22, fontWeight: '900' as const },
    body: { fontSize: 16, fontWeight: '600' as const },
    small: { fontSize: 13, fontWeight: '600' as const },
  },
  shadow: {
    card: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    floating: {
      shadowColor: '#0F172A',
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
} as const;
