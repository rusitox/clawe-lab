import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type Mode = 'Semana' | 'Mes' | 'Día';

type ItemType = 'Evento' | 'Tarea';

type WeekItem = {
  id: string;
  day: string;
  title: string;
  time?: string;
  type: ItemType;
  accent: string;
  people?: string[];
};

export function WeekScreen() {
  const [mode, setMode] = useState<Mode>('Semana');
  const [filterOpen, setFilterOpen] = useState(false);

  const items: WeekItem[] = useMemo(
    () => [
      {
        id: '1',
        day: '9  Lunes',
        title: 'Reunión padres de familia',
        time: '09:00 - 10:00',
        type: 'Evento',
        accent: '#3B82F6',
        people: ['Carlos', 'Ana'],
      },
      {
        id: '2',
        day: '9  Lunes',
        title: 'Comprar material escolar',
        type: 'Tarea',
        accent: theme.colors.primary,
        people: ['Ana'],
      },
    ],
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Family Hub</Text>

        <View style={styles.controlsRow}>
          <View style={styles.segmented}>
            {(['Semana', 'Mes', 'Día'] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{m}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ position: 'relative' }}>
            <Pressable
              onPress={() => setFilterOpen((v) => !v)}
              style={styles.filterBtn}
            >
              <Text style={styles.filterText}>Todos</Text>
              <Ionicons
                name={filterOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textSecondary}
              />
            </Pressable>

            {filterOpen && (
              <View style={styles.dropdown}>
                {['Todos', 'Eventos', 'Tareas'].map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      setFilterOpen(false);
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text style={styles.dropdownText}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.dayRow}>
          <View style={styles.dayPill}>
            <Text style={styles.dayPillText}>9</Text>
          </View>
          <Text style={styles.dayText}>Lunes</Text>
        </View>

        {items.map((it) => (
          <View key={it.id} style={styles.card}>
            <View style={[styles.cardAccent, { backgroundColor: it.accent }]} />

            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="calendar-outline" size={18} color={theme.colors.textSecondary} />
                <Text style={styles.cardTitle}>{it.title}</Text>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>{it.type}</Text>
                </View>
              </View>

              {it.time && (
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
                  <Text style={styles.metaText}>{it.time}</Text>
                </View>
              )}

              {!!it.people?.length && (
                <View style={styles.peopleRow}>
                  {it.people.slice(0, 2).map((p) => (
                    <View key={p} style={styles.avatar}>
                      <Text style={styles.avatarText}>{p[0].toUpperCase()}</Text>
                    </View>
                  ))}
                  <Text style={styles.peopleText}>{it.people.join(', ')}</Text>
                </View>
              )}
            </View>
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'web' ? 18 : 12,
    paddingBottom: 12,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 10,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  segmentBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  segmentText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  segmentTextActive: {
    color: theme.colors.textPrimary,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.card,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: 46,
    width: 160,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    zIndex: 20,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dropdownText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },

  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 6,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dayPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17,24,39,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayPillText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  dayText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },

  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cardAccent: {
    width: 6,
  },
  cardBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  typePill: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  typePillText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  peopleText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
