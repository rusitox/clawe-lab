import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { stitchTokens } from '../theme.stitchTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding2'>;

const TOTAL_STEPS = 3;
const CURRENT_STEP = 2;

const PROFILE_COLORS = [
  stitchTokens.colors.memberMama,
  stitchTokens.colors.memberPapa,
  stitchTokens.colors.memberSofia,
  stitchTokens.colors.memberMateo,
  stitchTokens.colors.memberPurple,
  stitchTokens.colors.memberBlue,
];

type MemberDraft = {
  id: string;
  name: string;
  role: 'Adulto' | 'Niño';
  color: string;
};

export function OnboardingStep2({ navigation }: Props) {
  const [members, setMembers] = useState<MemberDraft[]>([
    { id: '1', name: 'Ana', role: 'Adulto', color: PROFILE_COLORS[0] },
    { id: '2', name: '', role: 'Niño', color: PROFILE_COLORS[1] },
  ]);

  function updateMember(id: string, patch: Partial<MemberDraft>) {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }

  function addMember() {
    const colorIdx = members.length % PROFILE_COLORS.length;
    setMembers(prev => [
      ...prev,
      { id: String(Date.now()), name: '', role: 'Adulto', color: PROFILE_COLORS[colorIdx] },
    ]);
  }

  function removeMember(id: string) {
    setMembers(prev => prev.filter(m => m.id !== id));
  }

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

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>¿Quiénes forman tu{'\n'}familia?</Text>
        <Text style={styles.subtitle}>
          Agregá a cada integrante para personalizar su experiencia.
        </Text>

        {members.map((member) => (
          <View key={member.id} style={styles.memberCard}>
            <View style={styles.memberCardHeader}>
              <Text style={styles.fieldLabel}>NOMBRE</Text>
              {members.length > 1 && (
                <Pressable onPress={() => removeMember(member.id)}>
                  <Ionicons name="trash-outline" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              )}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Escribí el nombre"
              placeholderTextColor={theme.colors.textSecondary}
              value={member.name}
              onChangeText={v => updateMember(member.id, { name: v })}
              autoCapitalize="words"
            />

            <Text style={styles.fieldLabel}>ROL</Text>
            <View style={styles.roleRow}>
              {(['Adulto', 'Niño'] as const).map(role => (
                <Pressable
                  key={role}
                  onPress={() => updateMember(member.id, { role })}
                  style={[styles.roleBtn, member.role === role && styles.roleBtnActive]}
                >
                  <Ionicons
                    name={role === 'Adulto' ? 'person-outline' : 'happy-outline'}
                    size={15}
                    color={member.role === role ? '#FFFFFF' : theme.colors.textSecondary}
                  />
                  <Text style={[styles.roleBtnText, member.role === role && styles.roleBtnTextActive]}>
                    {role}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>COLOR DE PERFIL</Text>
            <View style={styles.colorsRow}>
              {PROFILE_COLORS.map(color => (
                <Pressable
                  key={color}
                  onPress={() => updateMember(member.id, { color })}
                  style={[styles.colorDot, { backgroundColor: color }]}
                >
                  {member.color === color && (
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {/* Agregar otro miembro */}
        <Pressable style={styles.addMemberBtn} onPress={addMember}>
          <Ionicons name="add-circle-outline" size={18} color={theme.colors.primary} />
          <Text style={styles.addMemberText}>Agregar otro miembro</Text>
        </Pressable>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Onboarding3')}>
          <Text style={styles.primaryBtnText}>Continuar →</Text>
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
    marginBottom: 24,
  },
  progressFill: {
    height: 4,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  memberCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
    ...theme.shadow.card,
  },
  memberCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.textPrimary,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  roleBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  roleBtnTextActive: {
    color: '#FFFFFF',
  },
  colorsRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  addMemberText: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: Platform.OS === 'web' ? 24 : 32,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  primaryBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
