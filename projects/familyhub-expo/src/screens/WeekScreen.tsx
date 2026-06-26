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
import { stitchTokens } from '../theme.stitchTokens';
import { DayTimeline, DayTimelineItem } from '../components/DayTimeline';
import { ItemCard, type ItemType } from '../components/ItemCard';

type Mode = 'Semana' | 'Mes' | 'Día';

type WeekItem = {
  id: string;
  day: string;
  title: string;
  time?: string;
  type: ItemType;
  accent: string;
  people?: string[];
};

const WEEKDAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function isoDate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number) {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// Monday-first index: 0=Mon ... 6=Sun
function weekdayIndexMonFirst(d: Date) {
  const js = d.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7;
}

function monthLabelEs(d: Date) {
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}

export function WeekScreen() {
  const [mode, setMode] = useState<Mode>('Semana');
  const [filterOpen, setFilterOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(today));
  const [selectedISO, setSelectedISO] = useState(() => isoDate(today));

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
      {
        id: '3',
        day: '9  Lunes',
        title: 'Fútbol - Entrenamiento',
        time: '16:00 - 17:30',
        type: 'Actividad',
        accent: '#F59E0B',
        people: ['Lucas'],
      },
    ],
    []
  );

  const monthGrid = useMemo(() => {
    const first = startOfMonth(cursorMonth);
    const leading = weekdayIndexMonFirst(first);
    const totalDays = daysInMonth(cursorMonth);

    const cells: Array<{ kind: 'empty' } | { kind: 'day'; day: number; iso: string }> = [];
    for (let i = 0; i < leading; i++) cells.push({ kind: 'empty' });
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), day);
      cells.push({ kind: 'day', day, iso: isoDate(d) });
    }
    while (cells.length % 7 !== 0) cells.push({ kind: 'empty' });

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursorMonth]);

  const dayItems: DayTimelineItem[] = useMemo(
    () => [
      {
        id: 'd1',
        title: 'Reunión padres de familia',
        start: '09:00',
        end: '10:00',
        type: 'Evento',
        accent: '#3B82F6',
        location: 'Colegio',
        people: ['Carlos', 'Ana'],
      },
      {
        id: 'd2',
        title: 'Comprar material escolar',
        start: '12:30',
        end: '13:00',
        type: 'Tarea',
        accent: theme.colors.primary,
        people: ['Ana'],
      },
      {
        id: 'd3',
        title: 'Natación (Mateo)',
        start: '17:00',
        end: '18:00',
        type: 'Evento',
        accent: '#F59E0B',
        location: 'Club',
        people: ['Mateo'],
      },
    ],
    []
  );

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          Platform.OS === 'web'
            ? ({ position: 'sticky', top: 0, zIndex: 20, backdropFilter: 'blur(12px)' } as any)
            : null,
        ]}
      >
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
            <View style={styles.filterRow}>
              <Pressable
                onPress={() => setFilterOpen((v) => !v)}
                style={styles.filterBtn}
              >
                <Ionicons name="people" size={18} color={theme.colors.chipDarkText} />
                <Text style={styles.filterText}>Todos</Text>
                <Ionicons
                  name={filterOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={theme.colors.chipDarkText}
                />
              </Pressable>

              <View style={styles.avatarsRow}>
                {[
                  { label: 'M', bg: stitchTokens.colors.memberMama, fg: '#FFFFFF' },
                  { label: 'P', bg: stitchTokens.colors.memberPapa, fg: theme.colors.textPrimary },
                  { label: 'S', bg: stitchTokens.colors.memberSofia, fg: theme.colors.textPrimary },
                  { label: 'M', bg: stitchTokens.colors.memberMateo, fg: theme.colors.textPrimary },
                ].map((a, idx) => (
                  <View key={idx} style={[styles.avatarChip, { backgroundColor: a.bg }]}
                    >
                    <Text style={[styles.avatarChipText, { color: a.fg }]}>{a.label}</Text>
                  </View>
                ))}
              </View>
            </View>

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
        {mode === 'Día' ? (
          <DayTimeline datePill="9" dayName="Lunes" items={dayItems} />
        ) : mode === 'Mes' ? (
          <View style={{ gap: 12 }}>
            <View style={styles.monthHeaderRow}>
              <Text style={styles.monthTitle}>{monthLabelEs(cursorMonth)}</Text>
              <View style={styles.monthNav}>
                <Pressable
                  onPress={() => setCursorMonth((m) => addMonths(m, -1))}
                  style={styles.iconBtn}
                >
                  <Ionicons name="chevron-back" size={18} color={theme.colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => setCursorMonth((m) => addMonths(m, 1))}
                  style={styles.iconBtn}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekHeaderRow}>
              {WEEKDAYS_ES.map((d) => (
                <Text key={d} style={styles.weekHeaderText}>
                  {d}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {monthGrid.map((row, rIdx) => (
                <View key={rIdx} style={styles.gridRow}>
                  {row.map((cell, cIdx) => {
                    if (cell.kind === 'empty') return <View key={cIdx} style={{ flex: 1, aspectRatio: 1 }} />;
                    const isSelected = cell.iso === selectedISO;
                    const isToday = cell.iso === isoDate(today);
                    return (
                      <Pressable
                        key={cIdx}
                        onPress={() => {
                          setSelectedISO(cell.iso);
                          setMode('Día');
                        }}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayTextMonth,
                            isSelected && styles.dayTextSelected,
                            isToday && !isSelected && styles.dayTextToday,
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.dayRow}>
              <View style={styles.dayPill}>
                <Text style={styles.dayPillText}>9</Text>
              </View>
              <Text style={styles.dayText}>Lunes</Text>
            </View>

            {items.map((it) => (
              <ItemCard
                key={it.id}
                accent={it.accent}
                title={it.title}
                type={it.type}
                time={it.time}
                people={it.people}
                leadingIcon={
                  it.type === 'Evento'
                    ? 'calendar-outline'
                    : it.type === 'Tarea'
                      ? 'checkmark-circle-outline'
                      : 'barbell-outline'
                }
              />
            ))}
          </>
        )}

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
    paddingTop: Platform.OS === 'web' ? 24 : 18,
    paddingBottom: 14,
    // Match Stitch: header blends into the light background instead of a hard white bar
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.h1.fontSize,
    // Slightly less heavy than before; closer to Stitch exports
    fontWeight: '800',
    marginBottom: theme.spacing.md,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.colors.muted,
    borderRadius: 18,
    padding: 3,
  },
  segmentBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
  },
  segmentText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.chipDarkBg,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 14,
    ...theme.shadow.card,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarsRow: {
    flexDirection: 'row',
    marginLeft: 2,
  },
  avatarChip: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
    ...theme.shadow.card,
  },
  avatarChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  filterText: {
    color: theme.colors.chipDarkText,
    fontSize: 13,
    fontWeight: '700',
  },
  dropdown: {
    position: 'absolute',
    right: 0,
    top: 46,
    width: 160,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    borderWidth: 1,
    overflow: 'hidden',
    ...theme.shadow.card,
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
    marginBottom: theme.spacing.lg,
  },
  dayPill: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  dayPillText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  dayText: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  monthTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  monthNav: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: '#FFFFFF',
  },

  weekHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  weekHeaderText: {
    width: '14.2857%' as any,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },

  grid: {
    gap: 6,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    ...theme.shadow.card,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  dayCellToday: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.card,
  },
  dayTextMonth: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  dayTextSelected: {
    color: '#FFFFFF',
  },
  dayTextToday: {
    color: '#2563EB',
  },

  monthPlaceholder: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    gap: 8,
  },
  monthPlaceholderTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
  },
  monthPlaceholderText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
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
