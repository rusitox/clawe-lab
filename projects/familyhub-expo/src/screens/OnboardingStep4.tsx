import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';

import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding4'>;

export function OnboardingStep4({ navigation }: Props) {
  const [inviteCode] = useState('ABC123');
  const inviteUrl = useMemo(() => `https://familyhub.app/invite/${inviteCode}`, [inviteCode]);

  const copyLink = useCallback(async () => {
    await Clipboard.setStringAsync(inviteUrl);
    Alert.alert('Copiado', 'Link de invitación copiado.');
  }, [inviteUrl]);

  const shareLink = useCallback(async () => {
    const msg = `Sumate a mi familia en Family Hub: ${inviteUrl}`;

    // Prefer native file share API if available
    if (await Sharing.isAvailableAsync()) {
      // Share text via Share API (Sharing is file-based; still useful as availability check)
    }

    await Share.share({ message: msg });
  }, [inviteUrl]);

  const whatsappLink = useCallback(async () => {
    const msg = encodeURIComponent(`Sumate a mi familia en Family Hub: ${inviteUrl}`);
    // For demo we just copy a WA deep link; actual linking can be added later.
    const waUrl = `https://wa.me/?text=${msg}`;
    await Clipboard.setStringAsync(waUrl);
    Alert.alert('WhatsApp', 'Link de WhatsApp copiado.');
  }, [inviteUrl]);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.title}>Invitar miembros</Text>
        <Text style={styles.subtitle}>Compartí un QR, un link o mandalo por WhatsApp.</Text>

        <View style={styles.qrCard}>
          <Text style={styles.qrTitle}>Código QR</Text>
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrPlaceholderText}>QR (mock)</Text>
          </View>
          <Text style={styles.qrHint}>En el MVP esto se genera a partir del link de invitación.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Link de invitación</Text>
          <Text style={styles.cardText}>{inviteUrl.replace('https://', '')}</Text>

          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={copyLink}>
              <Text style={styles.actionBtnText}>Copiar link</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={shareLink}>
              <Text style={styles.actionBtnText}>Compartir</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={whatsappLink}>
              <Text style={styles.actionBtnText}>WhatsApp</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.replace('MainTabs')}>
          <Text style={styles.primaryBtnText}>Comenzar</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.secondaryBtnText}>Volver</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
    justifyContent: 'space-between',
  },
  top: {
    marginTop: 40,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    maxWidth: 520,
    marginBottom: 18,
  },
  qrCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 18,
    borderColor: theme.colors.border,
    borderWidth: 1,
    marginBottom: 12,
  },
  qrTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 10,
  },
  qrPlaceholder: {
    height: 160,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  qrPlaceholderText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  qrHint: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 18,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  cardTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionBtn: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  actionBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  bottom: {
    paddingBottom: 10,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  primaryBtnText: {
    color: theme.colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});
