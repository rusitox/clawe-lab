import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export type NewAction = 'event' | 'task' | 'activity';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (action: NewAction) => void;
};

export function NewBottomSheet({ open, onClose, onSelect }: Props) {
  const translateY = useRef(new Animated.Value(40)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const options = useMemo(
    () => [
      {
        key: 'event' as const,
        title: 'Crear Evento',
        icon: 'calendar-outline',
      },
      {
        key: 'task' as const,
        title: 'Crear Tarea',
        icon: 'checkbox-outline',
      },
      {
        key: 'activity' as const,
        title: 'Crear Actividad',
        icon: 'walk-outline',
      },
    ],
    []
  );

  useEffect(() => {
    if (!open) return;

    translateY.setValue(40);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.spring(translateY, {
        toValue: 0,
        damping: 18,
        stiffness: 180,
        mass: 0.8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [open, opacity, translateY]);

  useEffect(() => {
    if (!open) return;
    if (Platform.OS !== 'web') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <Modal
      transparent
      visible={open}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />

        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <Text style={styles.title}>Nuevo</Text>

          <View style={styles.list}>
            {options.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => onSelect(opt.key)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.iconCircle}>
                    <Ionicons name={opt.icon as any} size={20} color={theme.colors.primary} />
                  </View>
                  <Text style={styles.rowTitle}>{opt.title}</Text>
                </View>

                <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
              </Pressable>
            ))}
          </View>

          <View style={{ height: 10 }} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  sheet: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'web' ? 18 : 12,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.16)',
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.colors.textPrimary,
    marginBottom: 12,
  },
  list: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },
  rowPressed: {
    backgroundColor: theme.colors.muted,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(47,175,134,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
});
