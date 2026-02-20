import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

export type ItemType = 'Evento' | 'Tarea' | 'Actividad';

export type ItemCardProps = {
  accent: string;
  title: string;
  type: ItemType;
  time?: string;
  people?: string[];
  leadingIcon?: 'calendar-outline' | 'checkmark-circle-outline' | 'barbell-outline';
};

function pillColors(type: ItemType) {
  if (type === 'Tarea') return { bg: theme.colors.pillBlueBg, text: theme.colors.pillBlueText };
  if (type === 'Actividad') return { bg: theme.colors.pillOrangeBg, text: theme.colors.pillOrangeText };
  // Evento (Stitch uses purple)
  return { bg: theme.colors.pillPurpleBg, text: theme.colors.pillPurpleText };
}

export function ItemCard({ accent, title, type, time, people, leadingIcon = 'calendar-outline' }: ItemCardProps) {
  const pill = pillColors(type);
  const startTime = time ? time.split('-')[0].trim() : undefined;

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: accent }]} />

      <View style={styles.cardBody}>
        <View style={styles.leftCol}>
          {startTime ? <Text style={styles.timeText}>{startTime}</Text> : <View style={{ height: 16 }} />}
          <Ionicons name={leadingIcon as any} size={20} color={theme.colors.textSecondary} />
        </View>

        <View style={styles.contentCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.pillText, { color: pill.text }]}>{type}</Text>
            </View>
          </View>

          {!!people?.length ? (
            <View style={styles.peopleRow}>
              {people.slice(0, 2).map((p) => (
                <View key={p} style={styles.avatar}>
                  <Text style={styles.avatarText}>{p[0].toUpperCase()}</Text>
                </View>
              ))}
              <Text style={styles.peopleText} numberOfLines={1}>
                {people.join(', ')}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
    ...theme.shadow.card,
  },
  cardAccent: {
    width: 10,
    borderTopLeftRadius: theme.radius.xl,
    borderBottomLeftRadius: theme.radius.xl,
  },
  cardBody: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 16,
    gap: 14,
  },
  leftCol: {
    width: 46,
    alignItems: 'center',
    paddingTop: 2,
    gap: 6,
  },
  timeText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  contentCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  title: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: theme.typography.title.fontWeight,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
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
