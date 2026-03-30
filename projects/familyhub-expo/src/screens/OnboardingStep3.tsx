import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding3'>;

const TOTAL_STEPS = 3;
const CURRENT_STEP = 3;

type Permission = {
  id: string;
  icon: string;
  label: string;
  description: string;
};

const PERMISSIONS: Permission[] = [
  {
    id: 'create_events',
    icon: 'calendar-outline',
    label: 'Crear eventos',
    description: 'Agregar nuevas citas al calendario familiar',
  },
  {
    id: 'edit_tasks',
    icon: 'checkmark-circle-outline',
    label: 'Editar tareas',
    description: 'Marcar tareas completas o editar detalles',
  },
  {
    id: 'delete_activities',
    icon: 'trash-outline',
    label: 'Eliminar actividades',
    description: 'Borrar elementos del historial de actividades',
  },
];

export function OnboardingStep3({ navigation }: Props) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    create_events: true,
    edit_tasks: true,
    delete_activities: false,
  });
  const [parentApproval, setParentApproval] = useState(false);

  function togglePermission(id: string) {
    setPermissions(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </Pressable>
        <Text style={styles.stepLabel}>Permisos de Niños</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Barra de progreso */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Definí qué pueden hacer tus hijos en Family Hub. Estos ajustes se aplicarán a todas las cuentas infantiles vinculadas.
        </Text>

        <Text style={styles.sectionLabel}>ACCIONES PERMITIDAS</Text>
        <View style={styles.card}>
          {PERMISSIONS.map((perm, i) => (
            <View key={perm.id}>
              <View style={styles.permRow}>
                <View style={[styles.permIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
                  <Ionicons name={perm.icon as any} size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.permContent}>
                  <Text style={styles.permLabel}>{perm.label}</Text>
                  <Text style={styles.permDesc}>{perm.description}</Text>
                </View>
                <Switch
                  value={permissions[perm.id]}
                  onValueChange={() => togglePermission(perm.id)}
                  trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {i < PERMISSIONS.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>
          SUPERVISIÓN{' '}
          <Ionicons name="information-circle-outline" size={13} color={theme.colors.textSecondary} />
        </Text>
        <View style={styles.card}>
          <View style={styles.permRow}>
            <View style={styles.permContent}>
              <Text style={styles.permLabel}>Los padres deben aprobar cambios</Text>
              <Text style={styles.permDesc}>
                Recibirás una notificación para confirmar cualquier edición importante antes de que se guarde.
              </Text>
            </View>
            <Switch
              value={parentApproval}
              onValueChange={setParentApproval}
              trackColor={{ false: theme.colors.muted, true: theme.colors.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Onboarding4')}>
          <Text style={styles.primaryBtnText}>Guardar y Continuar</Text>
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
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
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
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 16,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  permIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permContent: {
    flex: 1,
  },
  permLabel: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  permDesc: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 64,
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
