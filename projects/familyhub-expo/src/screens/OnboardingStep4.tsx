import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding4'>;

const INVITE_LINK = 'familyhub.app/invite/familia-p...';

export function OnboardingStep4({ navigation }: Props) {
  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <Pressable style={styles.helpBtn}>
          <Text style={styles.helpText}>Ayuda</Text>
        </Pressable>
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={36} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>¡Invitá a tu familia!</Text>
        <Text style={styles.subtitle}>
          Escaneá el código o compartí el link para que se unan a tu Family Hub.
        </Text>

        {/* QR placeholder */}
        <View style={styles.qrContainer}>
          <View style={styles.qrBox}>
            <View style={styles.qrCornerTL} />
            <View style={styles.qrCornerTR} />
            <View style={styles.qrCornerBL} />
            <View style={styles.qrCornerBR} />
            <View style={styles.qrInner}>
              <Ionicons name="qr-code-outline" size={80} color={theme.colors.textPrimary} />
            </View>
          </View>
          <Text style={styles.scanLabel}>ESCANEAR PARA UNIRSE</Text>
        </View>

        {/* Link único */}
        <Text style={styles.linkLabel}>TU LINK ÚNCO</Text>
        <View style={styles.linkRow}>
          <Text style={styles.linkValue} numberOfLines={1}>{INVITE_LINK}</Text>
          <Pressable style={styles.copyBtn}>
            <Ionicons name="copy-outline" size={18} color={theme.colors.primary} />
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.replace('MainTabs')}>
          <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Compartir invitación</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn}>
          <Ionicons name="link-outline" size={16} color={theme.colors.textPrimary} />
          <Text style={styles.secondaryBtnText}>Copiar link</Text>
        </Pressable>

        <Pressable onPress={() => navigation.replace('MainTabs')} style={styles.skipWrap}>
          <Text style={styles.skipText}>Ir al Dashboard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const CORNER_SIZE = 20;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingTop: Platform.OS === 'web' ? 24 : 12,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 8,
    marginBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtn: {
    paddingHorizontal: 4,
  },
  helpText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${theme.colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrBox: {
    width: 180,
    height: 180,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...theme.shadow.card,
  },
  qrCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: theme.colors.primary,
    borderTopLeftRadius: 4,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: theme.colors.primary,
    borderTopRightRadius: 4,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderColor: theme.colors.primary,
    borderBottomLeftRadius: 4,
  },
  qrCornerBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderColor: theme.colors.primary,
    borderBottomRightRadius: 4,
  },
  qrInner: {
    opacity: 0.3,
  },
  scanLabel: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 10,
  },
  linkLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    width: '100%',
    gap: 10,
    ...theme.shadow.card,
  },
  linkValue: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  copyBtn: {
    padding: 4,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: Platform.OS === 'web' ? 24 : 32,
    paddingTop: 12,
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingVertical: 16,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  secondaryBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  skipWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  skipText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
