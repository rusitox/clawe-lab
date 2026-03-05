import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

// Legacy screen kept for deep-link testing. Keep types loose so it doesn't break builds.
type Props = { route: any; navigation: any };

export function InviteScreen({ route, navigation }: Props) {
  const { code } = route.params ?? { code: '—' };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Invite</Text>
      <Text style={styles.subtitle}>Código: {code}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Siguiente paso</Text>
        <Text style={styles.cardText}>
          En el v1 esto debería llevar a un flujo de “join family” (o login si no hay sesión).
        </Text>
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Login' }] })}
      >
        <Text style={styles.primaryBtnText}>Continuar</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('MainTabs')}>
        <Text style={styles.secondaryBtnText}>Ir a Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#0B0E14',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#B7C0D8',
    marginBottom: 18,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 16,
    borderColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    marginBottom: 18,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardText: {
    color: '#B7C0D8',
    fontSize: 14,
  },
  primaryBtn: {
    backgroundColor: '#4F7CFF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
