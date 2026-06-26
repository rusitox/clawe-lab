import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding1'>;

const TOTAL_STEPS = 3;
const CURRENT_STEP = 1;

export function OnboardingStep1({ navigation }: Props) {
  const [familyName, setFamilyName] = useState('');

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.stepLabel}>Paso {CURRENT_STEP} de {TOTAL_STEPS}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }]} />
      </View>

      {/* Contenido */}
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="people" size={36} color={theme.colors.primary} />
        </View>

        <Text style={styles.title}>Creá tu familia</Text>
        <Text style={styles.subtitle}>
          Dale una identidad a tu espacio compartido. Para empezar, elegí un nombre para tu grupo.
        </Text>

        <Text style={styles.inputLabel}>Nombre de tu familia</Text>
        <TextInput
          style={styles.input}
          placeholder="Ej: Familia Martínez"
          placeholderTextColor={theme.colors.textSecondary}
          value={familyName}
          onChangeText={setFamilyName}
          autoCapitalize="words"
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.primaryBtn, !familyName.trim() && styles.primaryBtnDisabled]}
          onPress={() => navigation.navigate('Onboarding2')}
          disabled={!familyName.trim()}
        >
          <Text style={styles.primaryBtnText}>Continuar →</Text>
        </Pressable>

        <Pressable onPress={() => navigation.replace('MainTabs')} style={styles.linkWrap}>
          <Text style={styles.linkText}>
            ¿Ya tenés un link de invitación?{' '}
            <Text style={styles.linkTextBold}>Ingresá acá</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

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
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.muted,
    marginHorizontal: theme.spacing.lg,
    borderRadius: 2,
    marginBottom: 32,
  },
  progressFill: {
    height: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${theme.colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 32,
  },
  inputLabel: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: theme.colors.textPrimary,
    ...theme.shadow.card,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: Platform.OS === 'web' ? 24 : 32,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  linkWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  linkText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  linkTextBold: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
});
