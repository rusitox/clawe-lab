import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
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

function FabCreateButton() {
  const navigation = useNavigation<any>();
  return (
    <View pointerEvents="box-none" style={styles.fabOverlay}>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('CreateNewItem')}
        style={styles.fab}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

export function MainTabs() {
  return (
    <>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: theme.colors.primary,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: theme.typography.small.fontSize,
            fontWeight: theme.typography.small.fontWeight,
            marginTop: 4,
          },
          tabBarStyle: {
            backgroundColor: theme.colors.card,
            borderTopColor: theme.colors.border,
            height: 86,
            paddingBottom: Platform.OS === 'web' ? 14 : 12,
            paddingTop: 12,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
          },
          tabBarIcon: ({ color, focused }) => {
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
        <Tab.Screen name="Family" component={FamilyScreen} options={{ title: 'Familia' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      </Tab.Navigator>

      {/* Match Stitch: no dedicated tab for "+"; use a floating action button */}
      <FabCreateButton />
    </>
  );
}

const styles = StyleSheet.create({
  fabOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    // Raise FAB so it visually sits above the tab bar (closer to Stitch)
    bottom: Platform.OS === 'web' ? 32 : 44,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.floating,
  },
});
