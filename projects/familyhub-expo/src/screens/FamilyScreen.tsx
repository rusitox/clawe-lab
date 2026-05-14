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

type Member = {
  id: string;
  name: string;
  role: 'Administrador' | 'Adulto' | 'Niño';
  age?: number;
  avatarBg: string;
  avatarFg: string;
  initials: string;
};

const MEMBERS: Member[] = [
  {
    id: '1',
    name: 'Martín',
    role: 'Administrador',
    initials: 'Ma',
    avatarBg: stitchTokens.colors.memberPapa,
    avatarFg: '#181411',
  },
  {
    id: '2',
    name: 'Laura',
    role: 'Adulto',
    initials: 'La',
    avatarBg: stitchTokens.colors.memberMama,
    avatarFg: '#FFFFFF',
  },
  {
    id: '3',
    name: 'Sofía',
    role: 'Niño',
    age: 12,
    initials: 'So',
    avatarBg: stitchTokens.colors.memberSofia,
    avatarFg: '#FFFFFF',
  },
  {
    id: '4',
    name: 'Lucas',
    role: 'Niño',
    age: 8,
    initials: 'Lu',
    avatarBg: stitchTokens.colors.memberMateo,
    avatarFg: '#181411',
  },
];

const adultos = MEMBERS.filter(m => m.role !== 'Niño');
const ninos = MEMBERS.filter(m => m.role === 'Niño');

function Avatar({ member, size = 48 }: { member: Member; size?: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: member.avatarBg },
      ]}
    >
      <Text style={[styles.avatarText, { color: member.avatarFg, fontSize: size * 0.33 }]}>
        {member.initials}
      </Text>
    </View>
  );
}

function MemberRow({ member }: { member: Member }) {
  const subtitle =
    member.role === 'Administrador'
      ? 'Administrador'
      : member.role === 'Adulto'
        ? 'Adulto'
        : `Niño • ${member.age} años`;

  return (
    <Pressable style={styles.memberRow}>
      <Avatar member={member} size={48} />
      <View style={styles.memberInfo}>
        <Text style={styles.memberName}>{member.name}</Text>
        <Text style={styles.memberSub}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textSecondary} />
    </Pressable>
  );
}

export function FamilyScreen() {
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
        <View>
          <Text style={styles.kicker}>GESTIÓN DEL HOGAR</Text>
          <Text style={styles.title}>Familia</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Avatares apilados */}
          <View style={styles.stackedAvatars}>
            {MEMBERS.slice(0, 2).map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.stackedAvatar,
                  { backgroundColor: m.avatarBg, marginLeft: i === 0 ? 0 : -10 },
                ]}
              >
                <Text style={[styles.stackedAvatarText, { color: m.avatarFg }]}>{m.initials}</Text>
              </View>
            ))}
            <View style={[styles.stackedAvatar, styles.stackedAvatarMore, { marginLeft: -10 }]}>
              <Text style={styles.stackedAvatarMoreText}>+2</Text>
            </View>
          </View>
          <Pressable style={styles.gearBtn}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.textPrimary} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Sección Adultos */}
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Adultos</Text>
        </View>
        <View style={styles.card}>
          {adultos.map((m, i) => (
            <View key={m.id}>
              <MemberRow member={m} />
              {i < adultos.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Sección Niños */}
        <View style={styles.sectionHeader}>
          <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
          <Text style={styles.sectionTitle}>Niños</Text>
          <Pressable style={styles.configPill}>
            <Text style={styles.configPillText}>Configurar permisos</Text>
          </Pressable>
        </View>
        <View style={styles.card}>
          {ninos.map((m, i) => (
            <View key={m.id}>
              <MemberRow member={m} />
              {i < ninos.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Botón agregar */}
        <Pressable style={styles.addBtn}>
          <Ionicons name="person-add-outline" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Agregar miembro</Text>
        </Pressable>

        <Text style={styles.planNote}>
          Podés tener hasta 6 miembros en el plan gratuito.
        </Text>

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
    alignItems: 'flex-start',
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
    marginBottom: 4,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  stackedAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: theme.colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackedAvatarText: {
    fontSize: 10,
    fontWeight: '800',
  },
  stackedAvatarMore: {
    backgroundColor: theme.colors.muted,
  },
  stackedAvatarMoreText: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.colors.textSecondary,
  },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.card,
  },
  scroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    flex: 1,
  },
  configPill: {
    backgroundColor: theme.colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  configPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 20,
    overflow: 'hidden',
    ...theme.shadow.card,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontWeight: '800',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  memberSub: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginLeft: 78,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingVertical: 16,
    marginBottom: 12,
    ...theme.shadow.floating,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  planNote: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
