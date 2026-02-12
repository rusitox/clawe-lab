import React, { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { WeekScreen } from '../screens/WeekScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { FamilyScreen } from '../screens/FamilyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NewBottomSheet, type NewAction } from '../components/NewBottomSheet';
import { theme } from '../theme';

export type MainTabParamList = {
  Week: undefined;
  Calendar: undefined;
  New: undefined;
  Family: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function NewPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;
}

function notifySelected(action: NewAction) {
  const msg =
    action === 'event'
      ? 'Crear Evento'
      : action === 'task'
        ? 'Crear Tarea'
        : 'Crear Actividad';

  // Happy-path placeholder until create flows/screens exist.
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    (globalThis as any).alert?.(msg);
    return;
  }

  Alert.alert(msg);
}

export function MainTabs() {
  const [newOpen, setNewOpen] = useState(false);

  const onSelectNew = useCallback((action: NewAction) => {
    setNewOpen(false);
    notifySelected(action);
  }, []);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
            height: 74,
            paddingBottom: Platform.OS === 'web' ? 12 : 10,
            paddingTop: 8,
          },
          tabBarIcon: ({ color, size, focused }) => {
            if (route.name === 'New') return null;
            const icon =
            route.name === 'Week'
              ? focused
                ? 'calendar'
                : 'calendar-outline'
              : route.name === 'Calendar'
                ? focused
                  ? 'grid'
                  : 'grid-outline'
                : route.name === 'Family'
                  ? focused
                    ? 'people'
                    : 'people-outline'
                  : focused
                    ? 'settings'
                    : 'settings-outline';
          return <Ionicons name={icon as any} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Week" component={WeekScreen} options={{ title: 'Semana' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendario' }} />
      <Tab.Screen
        name="New"
        component={NewPlaceholder}
        options={{
          title: '',
          tabBarButton: (props) => (
            <Pressable
              accessibilityRole="button"
              onPress={props.onPress}
              style={[styles.fabWrap, props.style as any]}
            >
              <View style={styles.fab}>
                <Ionicons name="add" size={28} color="#FFFFFF" />
              </View>
            </Pressable>
          ),
        }}
        listeners={() => ({
          tabPress: (e) => {
            e.preventDefault();
            setNewOpen(true);
          },
        })}
      />
      <Tab.Screen name="Family" component={FamilyScreen} options={{ title: 'Familia' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      </Tab.Navigator>

      <NewBottomSheet
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onSelect={onSelectNew}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -18,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
