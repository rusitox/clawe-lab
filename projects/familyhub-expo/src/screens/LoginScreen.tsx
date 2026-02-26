import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { SvgXmlAsset } from '../components/SvgXmlAsset';
import { loginSvgXml_1 as googleLogoSvgXml } from '../assets/stitch/loginInlineSvgs';
import { appMarkSvgXml } from '../assets/stitch/appMarkSvg';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const onGoogle = useCallback(() => {
    // Flow mock: in real app this would auth then go to family picker.
    navigation.replace('Onboarding1');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.heroIconWrap}>
        <SvgXmlAsset xml={appMarkSvgXml} width={64} height={64} />
      </View>

      <Text style={styles.kicker}>Family Hub</Text>

      <View style={styles.welcome}>
        <Text style={styles.h1}>Bienvenido a Family Hub</Text>
        <Text style={styles.subtitle}>Organizá la semana de tu familia en un solo lugar.</Text>
      </View>

      <Pressable style={styles.googleBtn} onPress={onGoogle}>
        <SvgXmlAsset xml={googleLogoSvgXml} width={18} height={18} />
        <Text style={styles.googleBtnText}>Continuar con Google</Text>
      </Pressable>

      <Pressable onPress={() => navigation.navigate('Onboarding1')} style={styles.linkWrap}>
        <Text style={styles.link}>Ya tengo cuenta</Text>
      </Pressable>

      <Text style={styles.legal}>
        Al continuar, aceptás nuestra{' '}
        <Text style={styles.legalLink}>política de privacidad</Text> y{'\n'}nuestros{' '}
        <Text style={styles.legalLink}>términos de servicio</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: 24,
    paddingTop: 80, // ~pt-20
    paddingBottom: 18,
    alignItems: 'center',
  },
  heroIconWrap: {
    marginBottom: 24,
  },
  kicker: {
    color: 'rgba(24, 20, 17, 0.85)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  welcome: {
    alignItems: 'center',
    marginBottom: 48, // ~mb-12
    paddingHorizontal: 16,
  },
  h1: {
    color: theme.colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 16,
  },
  subtitle: {
    color: 'rgba(24, 20, 17, 0.55)',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
  },
  googleBtn: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.xl,
    paddingVertical: 16,
    borderWidth: 0,
    marginTop: 'auto',
  },
  googleBtnText: {
    color: theme.colors.primaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  linkWrap: {
    paddingVertical: 16,
  },
  link: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  legal: {
    color: 'rgba(24, 20, 17, 0.50)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 12,
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: 'rgba(24, 20, 17, 0.70)',
    fontWeight: '600',
  },
});
