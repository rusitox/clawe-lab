import React from 'react';
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

type RowProps = {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  badge?: string;
  onPress?: () => void;
};

function SettingRow({ icon, iconColor = theme.colors.primary, label, sublabel, badge, onPress }: RowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.rowIcon, { backgroundColor: `${iconColor}18` }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
      )}
    </Pressable>
  );
}

export function SettingsScreen() {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View
        style={[
          styles.header,
          Platform.OS === 'web'
            ? ({ position: 'sticky', top: 0, zIndex: 20 } as any)
            : null,
        ]}
      >
        <Text style={styles.title}>Ajustes</Text>
        <View style={[styles.userAvatar, { backgroundColor: stitchTokens.colors.memberMama }]}>
          <Text style={styles.userAvatarText}>La</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* FAMILIA */}
        <Text style={styles.sectionLabel}>FAMILIA</Text>
        <View style={styles.card}>
          <SettingRow
            icon="home-outline"
            label="Nombre de la familia"
            sublabel="Familia Rodriguez"
          />
          <View style={styles.divider} />
          <Pressable style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: `${theme.colors.primary}18` }]}>
              <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Gestionar miembros</Text>
            </View>
            <View style={styles.stackedAvatars}>
              {[
                stitchTokens.colors.memberPapa,
                stitchTokens.colors.memberMama,
              ].map((bg, i) => (
                <View
                  key={i}
                  style={[styles.miniAvatar, { backgroundColor: bg, marginLeft: i === 0 ? 0 : -8 }]}
                />
              ))}
              <View style={[styles.miniAvatar, styles.miniAvatarMore, { marginLeft: -8 }]}>
                <Text style={styles.miniAvatarMoreText}>+2</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.textSecondary} />
          </Pressable>
          <View style={styles.divider} />
          <SettingRow icon="lock-closed-outline" label="Permisos" />
        </View>

        {/* NOTIFICACIONES */}
        <Text style={styles.sectionLabel}>NOTIFICACIONES</Text>
        <View style={styles.card}>
          <SettingRow
            icon="notifications-outline"
            iconColor="#EF4444"
            label="Alertas de la app"
          />
        </View>

        {/* INTEGRACIONES */}
        <Text style={styles.sectionLabel}>INTEGRACIONES</Text>
        <View style={styles.card}>
          <SettingRow
            icon="calendar-outline"
            iconColor="#4285F4"
            label="Google Calendar"
            badge="Próximamente"
          />
          <View style={styles.divider} />
          <SettingRow
            icon="mail-outline"
            iconColor="#0078D4"
            label="Outlook"
            badge="Próximamente"
          />
        </View>
        <Text style={styles.integrationNote}>
          Conectá tus calendarios externos para ver todos tus eventos en un solo lugar.
        </Text>

        {/* CUENTA */}
        <Text style={styles.sectionLabel}>CUENTA</Text>
        <View style={styles.card}>
          <Pressable style={styles.row}>
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>Family Hub v2.4.1 | Build 2041</Text>
        <Text style={styles.footer}>Hecho con ♥ en Buenos Aires</Text>

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
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 20,
  },
  sectionLabel: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.0,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 6,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  rowSublabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  badge: {
    backgroundColor: `${theme.colors.primary}20`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    color: theme.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 62,
  },
  stackedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniAvatarMore: {
    backgroundColor: theme.colors.muted,
  },
  miniAvatarMoreText: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  integrationNote: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    marginBottom: 16,
    marginTop: 4,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  footer: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
});
