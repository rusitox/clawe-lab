import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export type DayTimelineItem = {
  id: string;
  title: string;
  start: string; // HH:MM
  end: string; // HH:MM
  type: 'Evento' | 'Tarea';
  accent: string;
  location?: string;
  people?: string[];
};

function timeToMinutes(t: string) {
  const [hh, mm] = t.split(':').map((v) => Number(v));
  return hh * 60 + mm;
}

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_HEIGHT = 72; // px-ish

export function DayTimeline({
  datePill = '9',
  dayName = 'Lunes',
  items,
}: {
  datePill?: string;
  dayName?: string;
  items: DayTimelineItem[];
}) {
  const laidOut = useMemo(() => {
    const startMin = START_HOUR * 60;
    return items
      .map((it) => {
        const s = timeToMinutes(it.start);
        const e = timeToMinutes(it.end);
        const top = ((s - startMin) / 60) * HOUR_HEIGHT;
        const height = Math.max(((e - s) / 60) * HOUR_HEIGHT, 44);
        return { ...it, top, height };
      })
      .filter((it) => it.top + it.height > 0);
  }, [items]);

  const totalHours = END_HOUR - START_HOUR;
  const gridHeight = totalHours * HOUR_HEIGHT;

  return (
    <View>
      <View style={styles.dayRow}>
        <View style={styles.dayPill}>
          <Text style={styles.dayPillText}>{datePill}</Text>
        </View>
        <Text style={styles.dayText}>{dayName}</Text>
      </View>

      <View style={styles.timelineCard}>
        <View style={styles.timelineInner}>
          <View style={[styles.grid, { height: gridHeight }]}>
            {Array.from({ length: totalHours + 1 }).map((_, idx) => {
              const hour = START_HOUR + idx;
              const label = `${String(hour).padStart(2, '0')}:00`;
              return (
                <View key={label} style={[styles.hourRow, { top: idx * HOUR_HEIGHT }]}>
                  <Text style={styles.hourLabel}>{label}</Text>
                  <View style={styles.hourLine} />
                </View>
              );
            })}

            <View style={styles.nowLine} />

            {laidOut.map((it) => (
              <View
                key={it.id}
                style={[
                  styles.item,
                  {
                    top: it.top,
                    height: it.height,
                    borderLeftColor: it.accent,
                  },
                ]}
              >
                <View style={styles.itemTitleRow}>
                  <Ionicons
                    name={it.type === 'Evento' ? 'calendar-outline' : 'checkmark-circle-outline'}
                    size={16}
                    color={theme.colors.textSecondary}
                  />
                  <Text numberOfLines={1} style={styles.itemTitle}>
                    {it.title}
                  </Text>
                  <View
                    style={[
                      styles.typePill,
                      it.type === 'Tarea' ? styles.typePillTask : styles.typePillEvent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typePillText,
                        it.type === 'Tarea' ? styles.typePillTextTask : styles.typePillTextEvent,
                      ]}
                    >
                      {it.type}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={theme.colors.textSecondary} />
                  <Text style={styles.metaText}>
                    {it.start} - {it.end}
                  </Text>
                </View>

                {!!it.location && (
                  <View style={styles.metaRow}>
                    <Ionicons name="location-outline" size={14} color={theme.colors.textSecondary} />
                    <Text numberOfLines={1} style={styles.metaText}>
                      {it.location}
                    </Text>
                  </View>
                )}

                {!!it.people?.length && (
                  <View style={styles.peopleRow}>
                    <View style={[styles.dot, { backgroundColor: it.accent }]} />
                    <Text numberOfLines={1} style={styles.peopleText}>
                      {it.people.length === 1 ? it.people[0] : `${it.people[0]} +${it.people.length - 1}`}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const TIME_COL_W = 64;

const styles = StyleSheet.create({
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dayPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
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

  timelineCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  timelineInner: {
    paddingVertical: 10,
  },

  grid: {
    position: 'relative',
    paddingLeft: TIME_COL_W,
  },

  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: HOUR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourLabel: {
    width: TIME_COL_W,
    paddingTop: 8,
    paddingRight: 10,
    textAlign: 'right',
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  hourLine: {
    flex: 1,
    marginTop: 16,
    borderTopColor: 'rgba(0,0,0,0.07)',
    borderTopWidth: 1,
  },

  nowLine: {
    position: 'absolute',
    left: TIME_COL_W,
    right: 0,
    top: 0,
    height: 0,
  },

  item: {
    position: 'absolute',
    left: TIME_COL_W + 12,
    right: 14,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 8,
    ...theme.shadow.card,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  itemTitle: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typePillEvent: {
    backgroundColor: theme.colors.pillPurpleBg,
  },
  typePillTask: {
    backgroundColor: theme.colors.pillBlueBg,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  typePillTextEvent: {
    color: theme.colors.pillPurpleText,
  },
  typePillTextTask: {
    color: theme.colors.pillBlueText,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },

  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  peopleText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
});
