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
import { ItemCard, type ItemType } from '../components/ItemCard';

const WEEKDAYS_ES = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function isoDate(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function startOfMonth(year: number, month: number) {
  return { year, month };
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

// Monday-first: 0=Mon .. 6=Sun
function weekdayMonFirst(year: number, month: number, day: number) {
  const js = new Date(year, month - 1, day).getDay();
  return (js + 6) % 7;
}

type AgendaItem = {
  id: string;
  dateISO: string;
  title: string;
  time?: string;
  type: ItemType;
  accent: string;
  people?: string[];
  location?: string;
};

// Demo items alineados con Stitch 02-mes.png (Octubre 2023, día 24 seleccionado)
const DEMO_ITEMS: AgendaItem[] = [
  {
    id: '1',
    dateISO: '2023-10-24',
    title: 'Práctica de Fútbol',
    time: '17:00',
    type: 'Actividad',
    accent: stitchTokens.colors.memberSofia,
    people: ['Sofía'],
    location: 'Club Central',
  },
  {
    id: '2',
    dateISO: '2023-10-24',
    title: 'Cena Familiar',
    time: '20:00',
    type: 'Evento',
    accent: stitchTokens.colors.memberMama,
    people: ['Familia'],
    location: 'Casa',
  },
  {
    id: '3',
    dateISO: '2023-10-24',
    title: 'Lectura',
    time: '21:30',
    type: 'Actividad',
    accent: stitchTokens.colors.memberPapa,
    people: ['Papá'],
  },
  // Otros días con dots en el grid
  {
    id: '4',
    dateISO: '2023-10-04',
    title: 'Reunión escolar',
    time: '09:00',
    type: 'Evento',
    accent: stitchTokens.colors.memberMama,
    people: ['Mamá'],
  },
  {
    id: '5',
    dateISO: '2023-10-13',
    title: 'Dentista Mateo',
    time: '10:00',
    type: 'Evento',
    accent: stitchTokens.colors.memberMateo,
    people: ['Mateo'],
  },
  {
    id: '6',
    dateISO: '2023-10-13',
    title: 'Natación',
    time: '17:00',
    type: 'Actividad',
    accent: stitchTokens.colors.memberSofia,
    people: ['Sofía'],
  },
];

function personColor(name: string) {
  const n = name.toLowerCase();
  if (n.includes('mamá') || n.includes('mama') || n.includes('ana')) return stitchTokens.colors.memberMama;
  if (n.includes('papá') || n.includes('papa') || n.includes('carlos')) return stitchTokens.colors.memberPapa;
  if (n.includes('sofía') || n.includes('sofia')) return stitchTokens.colors.memberSofia;
  if (n.includes('mateo') || n.includes('lucas')) return stitchTokens.colors.memberMateo;
  return stitchTokens.colors.memberBlue;
}

export function CalendarScreen() {
  const [curYear, setCurYear] = useState(2023);
  const [curMonth, setCurMonth] = useState(10); // 1-based
  const [selectedISO, setSelectedISO] = useState('2023-10-24');

  const monthLabel = `${MONTHS_ES[curMonth - 1]} ${curYear}`;

  function prevMonth() {
    if (curMonth === 1) { setCurYear(y => y - 1); setCurMonth(12); }
    else setCurMonth(m => m - 1);
  }
  function nextMonth() {
    if (curMonth === 12) { setCurYear(y => y + 1); setCurMonth(1); }
    else setCurMonth(m => m + 1);
  }

  const monthGrid = useMemo(() => {
    const leading = weekdayMonFirst(curYear, curMonth, 1);
    const total = daysInMonth(curYear, curMonth);
    const cells: Array<{ kind: 'empty' } | { kind: 'day'; day: number; iso: string }> = [];
    for (let i = 0; i < leading; i++) cells.push({ kind: 'empty' });
    for (let d = 1; d <= total; d++) cells.push({ kind: 'day', day: d, iso: isoDate(curYear, curMonth, d) });
    while (cells.length % 7 !== 0) cells.push({ kind: 'empty' });
    const rows: typeof cells[] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [curYear, curMonth]);

  const dotMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const it of DEMO_ITEMS) {
      const colors = map.get(it.dateISO) ?? [];
      colors.push(personColor(it.people?.[0] ?? ''));
      map.set(it.dateISO, colors);
    }
    return map;
  }, []);

  const selectedItems = useMemo(
    () => DEMO_ITEMS.filter(it => it.dateISO === selectedISO),
    [selectedISO]
  );

  const selectedDate = useMemo(() => {
    const [y, m, d] = selectedISO.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const dayName = date.toLocaleDateString('es-AR', { weekday: 'long' });
    const dayNum = d;
    const monthName = MONTHS_ES[m - 1];
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)}, ${dayNum} de ${monthName}`;
  }, [selectedISO]);

  return (
    <View style={styles.container}>
      {/* Header estilo Stitch: mes + chevron a la izquierda, FAB + a la derecha */}
      <View
        style={[
          styles.header,
          Platform.OS === 'web'
            ? ({ position: 'sticky', top: 0, zIndex: 20 } as any)
            : null,
        ]}
      >
        <Pressable style={styles.monthBtn} onPress={() => {}}>
          <Text style={styles.monthTitle}>{monthLabel}</Text>
          <Ionicons name="chevron-down" size={18} color={theme.colors.textPrimary} />
        </Pressable>
        <Pressable style={styles.fabSmall}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Grid mensual */}
        <View style={styles.calendarCard}>
          {/* Navegación mes */}
          <View style={styles.monthNav}>
            <Pressable onPress={prevMonth} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={16} color={theme.colors.textSecondary} />
            </Pressable>
            <Pressable onPress={nextMonth} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          </View>

          {/* Cabecera días semana */}
          <View style={styles.weekHeaderRow}>
            {WEEKDAYS_ES.map((w, i) => (
              <Text key={i} style={styles.weekHeaderText}>{w}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {monthGrid.map((row, rIdx) => (
              <View key={rIdx} style={styles.gridRow}>
                {row.map((cell, cIdx) => {
                  if (cell.kind === 'empty') {
                    return <View key={cIdx} style={styles.dayCell} />;
                  }
                  const isSelected = cell.iso === selectedISO;
                  const dots = dotMap.get(cell.iso) ?? [];
                  return (
                    <Pressable
                      key={cIdx}
                      onPress={() => setSelectedISO(cell.iso)}
                      style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                        {cell.day}
                      </Text>
                      {dots.length > 0 && (
                        <View style={styles.dotsRow}>
                          {dots.slice(0, 3).map((c, i) => (
                            <View
                              key={i}
                              style={[styles.dot, { backgroundColor: isSelected ? 'rgba(255,255,255,0.8)' : c }]}
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

        {/* Detalle del día seleccionado */}
        <View style={styles.dayDetailHeader}>
          <View style={styles.dayDetailAccent} />
          <Text style={styles.dayDetailTitle}>{selectedDate}</Text>
        </View>

        {selectedItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sin eventos para este día.</Text>
          </View>
        ) : (
          selectedItems.map(it => (
            <ItemCard
              key={it.id}
              accent={it.accent}
              title={it.title}
              type={it.type}
              time={it.time}
              people={it.people}
              location={it.location}
              leadingIcon={
                it.type === 'Evento'
                  ? 'calendar-outline'
                  : it.type === 'Tarea'
                    ? 'checkmark-circle-outline'
                    : 'barbell-outline'
              }
            />
          ))
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: Platform.OS === 'web' ? 24 : 18,
    paddingBottom: 14,
    backgroundColor: theme.colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  monthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthTitle: {
    color: theme.colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  fabSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.floating,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
    marginBottom: 8,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.muted,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 14,
  },
  calendarCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    marginBottom: 20,
    ...theme.shadow.card,
  },
  weekHeaderRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekHeaderText: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  grid: {
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayCellSelected: {
    backgroundColor: theme.colors.primary,
  },
  dayText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 999,
  },
  dayDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dayDetailAccent: {
    width: 4,
    height: 20,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  dayDetailTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  empty: {
    paddingVertical: 18,
  },
  emptyText: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
