import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { WeekScreen } from '../screens/WeekScreen';
import { CalendarScreen } from '../screens/CalendarScreen';
import { FamilyScreen } from '../screens/FamilyScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { theme } from '../theme';

export type MainTabParamList = {
  Week: undefined;
  Calendar: undefined;
  Family: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
        tabBarIcon: ({ color, size }) => {
          const icon =
            route.name === 'Week'
              ? 'calendar-outline'
              : route.name === 'Calendar'
                ? 'grid-outline'
                : route.name === 'Family'
                  ? 'people-outline'
                  : 'settings-outline';
          return <Ionicons name={icon as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Week" component={WeekScreen} options={{ title: 'Semana' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendario' }} />
      <Tab.Screen name="Family" component={FamilyScreen} options={{ title: 'Familia' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
    </Tab.Navigator>
  );
}
