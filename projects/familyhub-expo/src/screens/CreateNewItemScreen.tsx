import React, { useCallback } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import type { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import { SvgXmlAsset } from '../components/SvgXmlAsset';
import {
  material_calendar_month_svgXml,
  material_check_circle_svgXml,
  material_stadia_controller_svgXml,
  material_chevron_right_svgXml,
} from '../assets/material/materialSymbolsSvgs';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateNewItem'>;

type Kind = 'event' | 'task' | 'activity';

function notify(kind: Kind){
  const label = kind === 'event' ? 'Crear evento' : kind === 'task' ? 'Crear tarea' : 'Crear actividad';
  if(Platform.OS === 'web'){
    // eslint-disable-next-line no-alert
    (globalThis as any).alert?.(label);
    return;
  }
  Alert.alert(label, 'Flow mock (pendiente)');
}

export function CreateNewItemScreen({ navigation }: Props) {
  const onSelect = useCallback((kind: Kind) => {
    notify(kind);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backTxt}>Volver</Text>
        </Pressable>
        <Text style={styles.title}>Nuevo</Text>
        <View style={{ width: 64 }} />
      </View>

      <Text style={styles.subtitle}>¿Qué querés crear?</Text>

      <View style={styles.list}>
        <Pressable style={styles.card} onPress={() => onSelect('event')}>
          <View style={styles.cardRow}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.pillBlueBg }]}>
              <SvgXmlAsset
                xml={material_calendar_month_svgXml}
                width={18}
                height={18}
                color={theme.colors.pillBlueText}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Evento</Text>
              <Text style={styles.cardDesc}>Cumpleaños, médico, reunión escolar…</Text>
            </View>
            <SvgXmlAsset
              xml={material_chevron_right_svgXml}
              width={18}
              height={18}
              color={theme.colors.textSecondary}
            />
          </View>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onSelect('task')}>
          <View style={styles.cardRow}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.pillOrangeBg }]}>
              <SvgXmlAsset
                xml={material_check_circle_svgXml}
                width={18}
                height={18}
                color={theme.colors.pillOrangeText}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Tarea</Text>
              <Text style={styles.cardDesc}>Algo que alguien tiene que hacer.</Text>
            </View>
            <SvgXmlAsset
              xml={material_chevron_right_svgXml}
              width={18}
              height={18}
              color={theme.colors.textSecondary}
            />
          </View>
        </Pressable>

        <Pressable style={styles.card} onPress={() => onSelect('activity')}>
          <View style={styles.cardRow}>
            <View style={[styles.iconWrap, { backgroundColor: theme.colors.pillGreenBg }]}>
              <SvgXmlAsset
                xml={material_stadia_controller_svgXml}
                width={18}
                height={18}
                color={theme.colors.pillGreenText}
              />
            </View>
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>Actividad</Text>
              <Text style={styles.cardDesc}>Rutinas, planes, recordatorios.</Text>
            </View>
            <SvgXmlAsset
              xml={material_chevron_right_svgXml}
              width={18}
              height={18}
              color={theme.colors.textSecondary}
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 18,
  },
  backBtn: {
    backgroundColor: theme.colors.controlBg,
    borderColor: theme.colors.controlBorder,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  backTxt: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
    fontSize: theme.typography.small.fontSize,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.title.fontSize,
    fontWeight: '800',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
    marginBottom: 12,
  },
  list: {
    gap: 12,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.xl,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.card,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDesc: {
    color: theme.colors.textSecondary,
    fontSize: theme.typography.body.fontSize,
  },
});
