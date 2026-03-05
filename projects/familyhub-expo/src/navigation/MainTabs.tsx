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
  New: undefined;
  Family: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

function NewPlaceholder() {
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;
}

export function MainTabs() {
  const navigation = useNavigation<any>();

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
            // Match Stitch: dedicated screen "Create New Item Selection"
            e.preventDefault();
            navigation.navigate('CreateNewItem');
          },
        })}
      />
      <Tab.Screen name="Family" component={FamilyScreen} options={{ title: 'Familia' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ajustes' }} />
      </Tab.Navigator>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    top: -30,
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
