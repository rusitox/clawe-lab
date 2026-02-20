// Auto-extracted (lightly normalized) from Google Stitch exports
// Project: "Family Hub (Clean)" — app-first (Semana/Mes/Día) tailwind.config
// Source branch: family-hub/stitch-clean-v0-exports
// Note: Stitch exports define Tailwind theme colors + radii; spacing/typography still needs inference.

const remToPx = (rem: string) => {
  const m = rem.trim().match(/^([0-9.]+)rem$/);
  if (!m) return undefined;
  return Math.round(parseFloat(m[1]) * 16);
};

export const stitchTokens = {
  fontFamily: {
    display: 'Plus Jakarta Sans',
  },
  colors: {
    // core
    primary: '#ee8c2b',
    primaryFocus: '#d97b20',
    primaryContent: '#ffffff',

    backgroundLight: '#f8f7f6',
    backgroundDark: '#221910',

    surfaceLight: '#ffffff',
    surfaceDark: '#2d241b',

    textMain: '#181411',
    textMuted: '#897561',

    // members (variants observed across exports)
    memberMama: '#4facfe',
    memberPapa: '#43e97b',
    memberSofia: '#ff9a9e',
    memberMateo: '#f6d365',

    memberPurple: '#a855f7',
    memberBlue: '#3b82f6',
    memberPink: '#ec4899',
    memberTeal: '#14b8a6',
  },
  radius: {
    // Tailwind defaults in exports:
    // DEFAULT=0.5rem, lg=1rem, xl=1.5rem, 2xl=2rem, full=9999px
    default: remToPx('0.5rem') ?? 8,
    lg: remToPx('1rem') ?? 16,
    xl: remToPx('1.5rem') ?? 24,
    xxl: remToPx('2rem') ?? 32,
    full: 9999,
  },
  spacing: {
    // Inferred from Tailwind utility usage across Stitch exports (Semana/Mes/Día)
    // Most common: 8, 12, 16, 4, 2, 6, 20, 24
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
  typography: {
    // Inferred from text-* and font-* utilities
    // Common sizes: 12(xs), 14(sm), 18(lg), 16(base), 24(2xl)
    h1: { fontSize: 30, fontWeight: 700 },
    h2: { fontSize: 24, fontWeight: 700 },
    title: { fontSize: 18, fontWeight: 700 },
    body: { fontSize: 14, fontWeight: 500 },
    small: { fontSize: 12, fontWeight: 500 },
  },
  shadow: {
    // Tailwind shadows used: shadow-sm (most), shadow-md, shadow-lg
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 1,
    },
    floating: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
} as const;
