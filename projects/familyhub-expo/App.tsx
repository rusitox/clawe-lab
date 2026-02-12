import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Linking from 'expo-linking';

import type { RootStackParamList } from './src/types/navigation';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { InviteScreen } from './src/screens/InviteScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: ['familyhub://', 'https://familyhub.app'],
  config: {
    screens: {
      Invite: 'invite/:code',
      Welcome: 'welcome',
      Onboarding: 'onboarding',
      Home: 'home',
    },
  },
} as const;

export default function App() {
  return (
    <NavigationContainer
      linking={linking}
      fallback={null}
      onReady={() => {
        // For debugging in dev: where would an invite URL route?
        // eslint-disable-next-line no-console
        // console.log('Initial URL:', Linking.getInitialURL());
      }}
    >
      <Stack.Navigator
        initialRouteName="Welcome"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#0B0E14' },
        }}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Invite" component={InviteScreen} />
      </Stack.Navigator>
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
