import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding2'>;

type Role = 'Adulto' | 'Niño';

type Member = {
  id: string;
  name: string;
  role: Role;
};

function uid() {
  return String(Date.now()) + '-' + Math.random().toString(16).slice(2);
}

function roleLabel(role: Role) {
  return role;
}

export function OnboardingStep2({ navigation }: Props) {
  const [members, setMembers] = useState<Member[]>(() => [
    { id: uid(), name: 'Mamá', role: 'Adulto' },
    { id: uid(), name: 'Papá', role: 'Adulto' },
    { id: uid(), name: 'Sofi', role: 'Niño' },
  ]);

  const canContinue = useMemo(
    () => members.length >= 2 && members.every((m) => m.name.trim().length > 0),
    [members]
  );

  const addMember = useCallback(() => {
    setMembers((prev) => [...prev, { id: uid(), name: '', role: 'Niño' }]);
  }, []);

  const removeMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const setMemberName = useCallback((id: string, name: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, name } : m)));
  }, []);

  const setMemberRole = useCallback((id: string, role: Role) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.title}>Agregá miembros</Text>
        <Text style={styles.subtitle}>
          Sumá a tu familia para organizar actividades y responsabilidades.
        </Text>

        <View style={styles.list}>
          {members.map((m) => (
            <View key={m.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Miembro</Text>
                <Pressable onPress={() => removeMember(m.id)} hitSlop={10}>
                  <Text style={styles.remove}>Quitar</Text>
                </Pressable>
              </View>

              <TextInput
                value={m.name}
                onChangeText={(t) => setMemberName(m.id, t)}
                placeholder="Nombre"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
              />

              <View style={styles.roleRow}>
                <Text style={styles.roleLabel}>Rol</Text>
                <View style={styles.roleSeg}>
                  {(['Adulto', 'Niño'] as Role[]).map((r) => {
                    const active = m.role === r;
                    return (
                      <Pressable
                        key={r}
                        onPress={() => setMemberRole(m.id, r)}
                        style={[styles.roleBtn, active && styles.roleBtnActive]}
                      >
                        <Text style={[styles.roleBtnText, active && styles.roleBtnTextActive]}>
                          {roleLabel(r)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          ))}

          <Pressable style={styles.addBtn} onPress={addMember}>
            <Text style={styles.addBtnText}>+ Agregar otro miembro</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottom}>
        <Pressable
          style={[styles.primaryBtn, !canContinue && { opacity: 0.5 }]}
          disabled={!canContinue}
          onPress={() => navigation.navigate('Onboarding3')}
        >
          <Text style={styles.primaryBtnText}>Continuar</Text>
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
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 16,
    borderColor: theme.colors.border,
    borderWidth: 1,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  remove: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  roleLabel: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  roleSeg: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 999,
    padding: 4,
  },
  roleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  roleBtnActive: {
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
  },
  roleBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  roleBtnTextActive: {
    color: theme.colors.primary,
  },
  addBtn: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: theme.radius.xl,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: {
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
