import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding3'>;

type PermissionKey = 'createEvents' | 'editTasks' | 'deleteActivities';

type Permission = {
  key: PermissionKey;
  title: string;
  desc: string;
};

const PERMISSIONS: Permission[] = [
  {
    key: 'createEvents',
    title: 'Crear eventos',
    desc: 'Permite que los niños creen eventos en el calendario.',
  },
  {
    key: 'editTasks',
    title: 'Editar tareas',
    desc: 'Permite que los niños editen tareas asignadas.',
  },
  {
    key: 'deleteActivities',
    title: 'Eliminar actividades',
    desc: 'Permite que los niños eliminen actividades.',
  },
];

export function OnboardingStep3({ navigation }: Props) {
  const [allowed, setAllowed] = useState<Record<PermissionKey, boolean>>({
    createEvents: false,
    editTasks: false,
    deleteActivities: false,
  });

  const [parentApprovalRequired, setParentApprovalRequired] = useState(true);

  const enabledCount = useMemo(
    () => Object.values(allowed).filter(Boolean).length,
    [allowed]
  );

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <Text style={styles.title}>Permisos de Niños</Text>
        <Text style={styles.subtitle}>
          Configurá qué acciones pueden hacer los niños y si requieren supervisión.
        </Text>

        <View style={styles.section}>
          {PERMISSIONS.map((p) => (
            <View key={p.key} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{p.title}</Text>
                <Text style={styles.rowDesc}>{p.desc}</Text>
              </View>
              <Switch
                value={allowed[p.key]}
                onValueChange={(v) => setAllowed((prev) => ({ ...prev, [p.key]: v }))}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>Supervisión</Text>
              <Text style={styles.rowDesc}>Los padres deben aprobar cambios</Text>
            </View>
            <Switch value={parentApprovalRequired} onValueChange={setParentApprovalRequired} />
          </View>
        </View>

        <View style={styles.hintCard}>
          <Text style={styles.hintTitle}>Resumen</Text>
          <Text style={styles.hintText}>
            Permisos activos: {enabledCount} · Supervisión:{' '}
            {parentApprovalRequired ? 'activa' : 'desactivada'}
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Onboarding4')}>
          <Text style={styles.primaryBtnText}>Guardar y Continuar</Text>
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
  section: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 16,
    borderColor: theme.colors.border,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  rowDesc: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  hintCard: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: theme.radius.xl,
    padding: 14,
    marginTop: 4,
  },
  hintTitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  hintText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
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
