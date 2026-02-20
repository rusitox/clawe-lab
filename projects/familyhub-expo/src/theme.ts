import { stitchTokens } from './theme.stitchTokens';

export const theme = {
  colors: {
    // Source of truth: Stitch tokens (Family Hub (Clean))
    bg: stitchTokens.colors.backgroundLight,
    card: stitchTokens.colors.surfaceLight,
    border: 'rgba(15, 23, 42, 0.08)',

    textPrimary: stitchTokens.colors.textMain,
    textSecondary: stitchTokens.colors.textMuted,

    primary: stitchTokens.colors.primary,
    primaryText: stitchTokens.colors.primaryContent,

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
    xl: stitchTokens.radius.xl,
    lg: stitchTokens.radius.lg,
    md: stitchTokens.radius.default,
    sm: stitchTokens.radius.default,
  },
  spacing: {
    xs: stitchTokens.spacing.sm,
    sm: stitchTokens.spacing.md,
    md: stitchTokens.spacing.lg,
    lg: stitchTokens.spacing.xxl,
    xl: 32,
  },
  typography: {
    title: { fontSize: stitchTokens.typography.h2.fontSize, fontWeight: '700' as const },
    h1: { fontSize: stitchTokens.typography.title.fontSize, fontWeight: '700' as const },
    body: { fontSize: stitchTokens.typography.body.fontSize, fontWeight: '500' as const },
    small: { fontSize: stitchTokens.typography.small.fontSize, fontWeight: '500' as const },
  },
  shadow: stitchTokens.shadow,
} as const;
