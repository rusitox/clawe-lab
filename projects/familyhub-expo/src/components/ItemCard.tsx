import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

type Props = {
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

export function ItemCard({
  type,
  title,
  person,
  personColor,
  time,
  location,
  pill,
  pillColor,
  pillBg,
  completed = false,
}: Props) {
  const accentColor = completed ? theme.colors.muted : personColor;
  const iconName = completed
    ? 'checkmark-circle'
    : type === 'Evento'
    ? 'calendar'
    : type === 'Actividad'
    ? 'football'
    : 'checkmark-circle-outline';

  const resolvedPill = completed ? 'COMPLETADO' : pill;
  const resolvedPillBg = completed ? theme.colors.pillGreenBg : pillBg;
  const resolvedPillColor = completed ? theme.colors.pillGreenText : pillColor;

  return (
    <View style={[styles.card, completed && styles.cardCompleted]}>
      <View style={[styles.accent, { backgroundColor: accentColor }]} />
      <View style={styles.icon}>
        <Ionicons name={iconName as any} size={18} color={accentColor} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, completed && styles.titleCompleted]}>{title}</Text>
        <View style={styles.meta}>
          <View style={[styles.personDot, { backgroundColor: personColor }]} />
          <Text style={styles.metaText}>{person}</Text>
          {location ? (
            <>
              <Text style={styles.bullet}> • </Text>
              <Text style={styles.metaText}>{location}</Text>
            </>
          ) : null}
          {time ? (
            <>
              <Text style={styles.bullet}> • </Text>
              <Text style={styles.metaText}>{time}</Text>
            </>
          ) : null}
        </View>
      </View>
      {resolvedPill ? (
        <View style={[styles.pill, { backgroundColor: resolvedPillBg }]}>
          <Text style={[styles.pillText, { color: resolvedPillColor }]}>{resolvedPill}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  cardCompleted: {
    opacity: 0.7,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  icon: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  body: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  titleCompleted: {
    textDecorationLine: 'line-through',
    color: theme.colors.textSecondary,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  personDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  metaText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  bullet: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 12,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
