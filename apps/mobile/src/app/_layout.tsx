import React from 'react';
import { Tabs } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: '#F8FAFC' },
          headerTintColor: '#1F2937',
          headerTitleStyle: { fontWeight: '700' },
          tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#E5E7EB' },
          tabBarActiveTintColor: '#6366F1',
          tabBarInactiveTintColor: '#9CA3AF',
        }}
      >
        <Tabs.Screen
          name="(tabs)/today"
          options={{
            title: '今日学习',
            headerTitle: 'EnglishiApp',
            tabBarLabel: '今日',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📚</Text>,
          }}
        />
        <Tabs.Screen
          name="(tabs)/progress"
          options={{
            title: '我的进度',
            tabBarLabel: '进度',
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📊</Text>,
          }}
        />
        <Tabs.Screen name="(auth)/login" options={{ href: null }} />
        <Tabs.Screen name="(auth)/onboarding" options={{ href: null }} />
        <Tabs.Screen name="(auth)/assessment" options={{ href: null }} />
        <Tabs.Screen name="reading/[id]" options={{ href: null, title: '阅读' }} />
        <Tabs.Screen name="writing/[id]" options={{ href: null, title: '写作' }} />
        <Tabs.Screen name="speaking/session" options={{ href: null, title: '口语对练' }} />
        <Tabs.Screen name="vocabulary/review" options={{ href: null, title: '词汇复习' }} />
      </Tabs>
    </QueryClientProvider>
  );
}

