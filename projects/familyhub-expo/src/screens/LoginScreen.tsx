import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { SvgXmlAsset } from '../components/SvgXmlAsset';
import { loginSvgXml_1 as googleLogoSvgXml } from '../assets/stitch/loginInlineSvgs';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const onGoogle = useCallback(() => {
    // Flow mock: in real app this would auth then go to family picker.
    navigation.replace('Onboarding1');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.heroIconWrap}>
        {/* Placeholder: Stitch shows a rounded square badge with an app mark */}
        <View style={styles.heroIconBadge} />
      </View>

      <Text style={styles.title}>Family Hub</Text>
      <Text style={styles.subtitle}>Organizá la actividad de tu familia{`\n`}en un solo lugar</Text>

      {/* Illustration placeholder (Stitch uses a big centered illustration/card) */}
      <View style={styles.illustrationCard}>
        <View style={styles.illustrationInner} />
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
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: 'center',
  },
  heroIconWrap: {
    marginTop: 10,
    marginBottom: 10,
  },
  heroIconBadge: {
    width: 74,
    height: 74,
    borderRadius: 22,
    backgroundColor: 'rgba(238, 140, 43, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(238, 140, 43, 0.18)',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    marginTop: 6,
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 18,
  },
  illustrationCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 18,
    marginBottom: 18,
    ...theme.shadow.card,
  },
  illustrationInner: {
    height: 210,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(238, 140, 43, 0.10)',
  },
  googleBtn: {
    width: '100%',
    maxWidth: 520,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.card,
    borderRadius: 999,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.10)',
    marginTop: 6,
  },
  googleBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  linkWrap: {
    paddingVertical: 16,
  },
  link: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  legal: {
    color: 'rgba(24, 20, 17, 0.50)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 'auto',
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: 'rgba(24, 20, 17, 0.70)',
    fontWeight: '600',
  },
});
