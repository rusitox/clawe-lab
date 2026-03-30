import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
import { stitchTokens } from '../theme.stitchTokens';
import { ItemCard } from '../components/ItemCard';

type DayItem = {
  id: string;
  type: 'Evento' | 'Tarea' | 'Actividad';
  title: string;
  person: string;
  personColor: string;
  time?: string;
  location?: string;
  pill?: string;
  pillColor?: string;
  pillBg?: string;
  completed?: boolean;
};

type DayBlock = {
  iso: string;
  label: string;
  dayNum: number;
  isToday?: boolean;
  items: DayItem[];
};

const DAYS: DayBlock[] = [
  {
    iso: '2023-10-12',
    label: 'Lunes',
    dayNum: 12,
    isToday: true,
    items: [
      {
        id: '1',
        type: 'Evento',
        title: 'Colegio',
        person: 'Mateo',
        personColor: stitchTokens.colors.memberMateo,
        time: '08:00',
        pill: 'EVENTO',
        pillBg: theme.colors.pillBlueBg,
        pillColor: theme.colors.pillBlueText,
      },
      {
        id: '2',
        type: 'Tarea',
        title: 'Comprar útiles',
        person: 'Mamá',
        personColor: stitchTokens.colors.memberMama,
        location: 'Librería Central',
        pill: 'TAREA',
        pillBg: theme.colors.pillOrangeBg,
        pillColor: theme.colors.pillOrangeText,
      },
    ],
  },
  {
    iso: '2023-10-13',
    label: 'Martes',
    dayNum: 13,
    items: [
      {
        id: '3',
        type: 'Actividad',
        title: 'Fútbol',
        person: 'Sofía',
        personColor: stitchTokens.colors.memberSofia,
        time: '17:30',
        location: 'Club Deportivo',
        pill: 'ACTIVIDAD',
        pillBg: theme.colors.pillGreenBg,
        pillColor: theme.colors.pillGreenText,
      },
    ],
  },
  {
    iso: '2023-10-14',
    label: 'Miércoles',
    dayNum: 14,
    items: [
      {
        id: '4',
        type: 'Evento',
        title: 'Cena con Abuelos',
        person: 'Familia',
        personColor: theme.colors.primary,
        time: '20:00',
        pill: 'EVENTO',
        pillBg: theme.colors.pillBlueBg,
        pillColor: theme.colors.pillBlueText,
      },
      {
        id: '5',
        type: 'Tarea',
        title: 'Pagar Luz',
        person: 'Papá',
        personColor: stitchTokens.colors.memberPapa,
        completed: true,
      },
    ],
  },
];

export function WeekScreen() {
  const [activeDay, setActiveDay] = useState('2023-10-12');

  const activeBlock = DAYS.find(d => d.iso === activeDay) ?? DAYS[0];

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          Platform.OS === 'web'
            ? ({ position: 'sticky', top: 0, zIndex: 20 } as any)
            : null,
        ]}
      >
        <View>
          <Text style={styles.kicker}>SEMANA DEL 12–18 OCT</Text>
          <Text style={styles.title}>Esta Semana</Text>
        </View>
        <Pressable style={styles.bellBtn}>
          <Ionicons name="notifications-outline" size={22} color={theme.colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayStrip}
        contentContainerStyle={styles.dayStripContent}
      >
        {DAYS.map(day => {
          const active = day.iso === activeDay;
          return (
            <Pressable
              key={day.iso}
              onPress={() => setActiveDay(day.iso)}
              style={[styles.dayBtn, active && styles.dayBtnActive]}
            >
              <Text style={[styles.dayLabel, active && styles.dayLabelActive]}>
                {day.label.slice(0, 3)}
              </Text>
              <Text style={[styles.dayNum, active && styles.dayNumActive]}>{day.dayNum}</Text>
              {day.isToday && <View style={[styles.todayDot, active && styles.todayDotActive]} />}
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.dayHeader}>
          <Text style={styles.dayTitle}>
            {activeBlock.label} {activeBlock.dayNum}
          </Text>
          {activeBlock.isToday && (
            <View style={styles.todayPill}>
              <Text style={styles.todayPillText}>Hoy</Text>
            </View>
          )}
        </View>

        {activeBlock.items.map(item => (
          <ItemCard
            key={item.id}
            type={item.type}
            title={item.title}
            person={item.person}
            personColor={item.personColor}
            time={item.time}
            location={item.location}
            pill={item.pill}
            pillColor={item.pillColor}
            pillBg={item.pillBg}
            completed={item.completed}
          />
        ))}

        <View style={{ height: 40 }} />
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
  kicker: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
  },
  bellBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayStrip: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  dayStripContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    gap: 8,
  },
  dayBtn: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.lg,
    minWidth: 52,
  },
  dayBtnActive: {
    backgroundColor: theme.colors.primary,
  },
  dayLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  dayLabelActive: {
    color: '#FFFFFF',
  },
  dayNum: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  dayNumActive: {
    color: '#FFFFFF',
  },
  todayDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
    marginTop: 3,
  },
  todayDotActive: {
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 20,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  dayTitle: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  todayPill: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  todayPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
