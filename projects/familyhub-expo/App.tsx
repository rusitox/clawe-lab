import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from './src/types/navigation';
import { InviteScreen } from './src/screens/InviteScreen';
import { OnboardingStep1 } from './src/screens/OnboardingStep1';
import { OnboardingStep2 } from './src/screens/OnboardingStep2';
import { OnboardingStep3 } from './src/screens/OnboardingStep3';
import { OnboardingStep4 } from './src/screens/OnboardingStep4';
import { MainTabs } from './src/navigation/MainTabs';
import { CreateNewItemScreen } from './src/screens/CreateNewItemScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { theme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['familyhub://', 'https://familyhub.app'],
  config: {
    screens: {
      Invite: 'invite/:code',
      Onboarding1: 'onboarding/1',
      Onboarding2: 'onboarding/2',
      Onboarding3: 'onboarding/3',
      Onboarding4: 'onboarding/4',
      MainTabs: 'home',
    },
  },
} as const;

export default function App() {
  return (
    <NavigationContainer linking={linking} fallback={null}>
      <Stack.Navigator
        initialRouteName="Onboarding1"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="Onboarding1" component={OnboardingStep1} />
        <Stack.Screen name="Onboarding2" component={OnboardingStep2} />
        <Stack.Screen name="Onboarding3" component={OnboardingStep3} />
        <Stack.Screen name="Onboarding4" component={OnboardingStep4} />
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="CreateNewItem" component={CreateNewItemScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Invite" component={InviteScreen} />
      </Stack.Navigator>
      <StatusBar style="dark" />
    </NavigationContainer>
  );
}
