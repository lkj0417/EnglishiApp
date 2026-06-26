import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface ErrorScreenProps {
  message?: string;
  onRetry?: () => void;
}

/** 全屏错误状态，附带重试按钮 */
export function ErrorScreen({ message = '出了点问题', onRetry }: ErrorScreenProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>😕</Text>
      <Text style={styles.title}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.btn} onPress={onRetry}>
          <Text style={styles.btnText}>重试</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    padding: 24,
    gap: 12,
  },
  emoji: { fontSize: 48 },
  title: { fontSize: 16, color: '#374151', textAlign: 'center', lineHeight: 24 },
  btn: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

