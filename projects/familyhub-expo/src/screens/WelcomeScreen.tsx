import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

// Legacy screen kept for reference. We keep types loose so it doesn't break builds.
type Props = { navigation: any };

export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Family Hub</Text>
      <Text style={styles.subtitle}>Organizá tu semana familiar.</Text>

      <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('Onboarding1')}>
        <Text style={styles.primaryBtnText}>Empezar</Text>
      </Pressable>

      <Pressable style={styles.secondaryBtn} onPress={() => navigation.navigate('MainTabs')}>
        <Text style={styles.secondaryBtnText}>Entrar (skip)</Text>
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
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#B7C0D8',
    marginBottom: 24,
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
