import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { theme } from '../theme';
import { stitchTokens } from '../theme.stitchTokens';
import { DayTimeline, type DayTimelineItem } from '../components/DayTimeline';

type Mode = 'Semana' | 'Mes' | 'Día';

type ItemType = 'Evento' | 'Tarea';

type AgendaItem = {
  id: string;
  title: string;
  time?: string;
  type: ItemType;
  accent: string;
  people?: string[];
  dateISO: string; // YYYY-MM-DD
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
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export function CalendarScreen() {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();

  const [mode, setMode] = useState<Mode>('Mes');
  const [filterOpen, setFilterOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(today));
  const [selectedISO, setSelectedISO] = useState(() => isoDate(today));

  const items: AgendaItem[] = useMemo(
    () => [
      {
        id: '1',
        dateISO: selectedISO,
        title: 'Reunión padres de familia',
        time: '09:00 - 10:00',
        type: 'Evento',
        accent: '#3B82F6',
        people: ['Carlos', 'Ana'],
      },
      {
        id: '2',
        dateISO: selectedISO,
        title: 'Comprar material escolar',
        time: '13:00 - 13:30',
        type: 'Tarea',
        accent: theme.colors.primary,
        people: ['Ana'],
      },
      {
        id: '3',
        dateISO: (() => {
          const d = new Date(selectedISO);
          d.setDate(d.getDate() + 2);
          return isoDate(d);
        })(),
        title: 'Vacunas mascota',
        time: '18:30',
        type: 'Evento',
        accent: '#A855F7',
        people: ['Carlos'],
      },
    ],
    [selectedISO]
  );

  const agendaForDay = useMemo(
    () => items.filter((it) => it.dateISO === selectedISO),
    [items, selectedISO]
  );

  const dotMap = useMemo(() => {
    const personColor = (name: string) => {
      const n = name.toLowerCase();
      if (n.includes('ana') || n.includes('mama')) return stitchTokens.colors.memberMama;
      if (n.includes('carlos') || n.includes('papa')) return stitchTokens.colors.memberPapa;
      if (n.includes('sofi')) return stitchTokens.colors.memberSofia;
      if (n.includes('lucas') || n.includes('mateo')) return stitchTokens.colors.memberMateo;
      return stitchTokens.colors.memberBlue;
    };

    const map = new Map<string, string[]>();
    for (const it of items) {
      const colors = map.get(it.dateISO) ?? [];
      const people = it.people?.length ? it.people : ['Familia'];
      // push at most one dot per item, prefer first person color
      colors.push(personColor(people[0]));
      map.set(it.dateISO, colors);
    }
    return map;
  }, [items]);

  const monthGrid = useMemo(() => {
    const first = startOfMonth(cursorMonth);
    const leading = weekdayIndexMonFirst(first);
    const totalDays = daysInMonth(cursorMonth);

    const cells: Array<{ kind: 'empty' } | { kind: 'day'; day: number; iso: string }>
      = [];

    for (let i = 0; i < leading; i++) cells.push({ kind: 'empty' });
    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), day);
      cells.push({ kind: 'day', day, iso: isoDate(d) });
    }

    // pad to full weeks (6 rows max typical)
    while (cells.length % 7 !== 0) cells.push({ kind: 'empty' });

    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursorMonth]);

  const isWide = width >= 920;

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
                  onPress={() => {
                    setMode(m);
                    if (m === 'Semana') navigation.navigate('Week');
                    if (m === 'Mes') navigation.navigate('Calendar');
                    // Día stays inside this screen (timeline)
                  }}
                  style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                    {m}
                  </Text>
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
                color={theme.colors.chipDarkText}
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
        <View style={[styles.layout, isWide && styles.layoutWide]}>
          <View style={[styles.panel, styles.calendarPanel]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>{monthLabelEs(cursorMonth)}</Text>
              <View style={styles.monthNav}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCursorMonth((m) => addMonths(m, -1))}
                  style={styles.iconBtn}
                >
                  <Ionicons name="chevron-back" size={18} color={theme.colors.textSecondary} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCursorMonth((m) => addMonths(m, 1))}
                  style={styles.iconBtn}
                >
                  <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
                </Pressable>
              </View>
            </View>

            <View style={styles.weekHeaderRow}>
              {WEEKDAYS_ES.map((w) => (
                <Text key={w} style={styles.weekHeaderText}>
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {monthGrid.map((row, rIdx) => (
                <View key={rIdx} style={styles.gridRow}>
                  {row.map((cell, cIdx) => {
                    if (cell.kind === 'empty') {
                      return <View key={cIdx} style={styles.dayCell} />;
                    }
                    const isSelected = cell.iso === selectedISO;
                    const dots = dotMap.get(cell.iso) ?? [];
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
                            styles.dayText,
                            isSelected && styles.dayTextSelected,
                            isToday && !isSelected && styles.dayTextToday,
                          ]}
                        >
                          {cell.day}
                        </Text>

                        {dots.length > 0 && (
                          <View style={styles.dotsRow}>
                            {dots.slice(0, 4).map((c, i) => (
                              <View
                                // eslint-disable-next-line react/no-array-index-key
                                key={i}
                                style={[styles.dot, { backgroundColor: c }, isSelected && styles.dotSelected]}
                              />
                            ))}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.panel, styles.agendaPanel]}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Agenda</Text>
              <Text style={styles.panelSubtitle}>{selectedISO}</Text>
            </View>

            {mode === 'Día' ? (
              <DayTimeline
                datePill={String(Number(selectedISO.slice(-2)))}
                dayName={new Date(selectedISO).toLocaleDateString('es-ES', { weekday: 'long' })}
                items={agendaForDay.map((it, idx) => {
                  const parseRange = (t?: string) => {
                    if (!t) return undefined;
                    const parts = t.split('-').map((s) => s.trim());
                    const start = parts[0];
                    const end = parts[1] ?? parts[0];
                    return { start, end };
                  };

                  // Default slots (if missing time) so tasks/events don't disappear from the timeline
                  const fallback = () => {
                    // stagger by index (simple + deterministic)
                    const base = it.type === 'Tarea' ? 13 * 60 : 9 * 60;
                    const startMin = base + idx * 30;
                    const endMin = startMin + 30;
                    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
                    return { start: fmt(startMin), end: fmt(endMin) };
                  };

                  const r = parseRange(it.time) ?? fallback();

                  return {
                    id: it.id,
                    title: it.title,
                    start: r.start,
                    end: r.end,
                    type: it.type,
                    accent: it.accent,
                    people: it.people,
                  } satisfies DayTimelineItem;
                })}
              />
            ) : agendaForDay.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Sin items</Text>
                <Text style={styles.emptyText}>No hay eventos ni tareas para este día.</Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {agendaForDay.map((it) => (
                  <View key={it.id} style={styles.card}>
                    <View style={[styles.cardAccent, { backgroundColor: it.accent }]} />

                    <View style={styles.cardBody}>
                      <View style={styles.cardTitleRow}>
                        <Ionicons
                          name={it.type === 'Evento' ? 'calendar-outline' : 'checkbox-outline'}
                          size={18}
                          color={theme.colors.textSecondary}
                        />
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
              </View>
            )}
          </View>
        </View>

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
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 23, 42, 0.06)',
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 14,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 18,
    padding: 4,
  },
  segmentBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.card,
    ...theme.shadow.card,
  },
  segmentText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    ...theme.shadow.card,
  },
  filterText: {
    color: theme.colors.chipDarkText,
    fontSize: 14,
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

  layout: {
    gap: 12,
  },
  layoutWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
  },
  panel: {
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: 14,
  },
  calendarPanel: {
    flex: 1,
  },
  agendaPanel: {
    flex: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  panelTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'capitalize',
  },
  panelSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
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
  dayText: {
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
  dotsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 6,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  dotSelected: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  empty: {
    paddingVertical: 18,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },

  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: 22,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
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
