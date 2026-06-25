import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { authAPI } from '../../lib/api';
import { useAuthStore } from '../../stores';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const setAuth = useAuthStore(s => s.setAuth);

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert('提示', '请填写邮箱和密码');
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        if (!displayName) { Alert.alert('提示', '请填写昵称'); setLoading(false); return; }
        const res = await authAPI.register({ email, password, displayName });
        const { token, user } = res.data.data;
        setAuth(token, user.id);
        router.replace('/(auth)/onboarding');
      } else {
        const res = await authAPI.login({ email, password });
        const { token, user } = res.data.data;
        setAuth(token, user.id);
        if (!user.onboardingCompleted) {
          router.replace('/(auth)/onboarding');
        } else {
          router.replace('/(tabs)/today');
        }
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? '操作失败，请重试';
      Alert.alert('错误', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logoArea}>
          <Text style={s.logoEmoji}>🎓</Text>
          <Text style={s.logoText}>EnglishiApp</Text>
          <Text style={s.logoSub}>AI 原生自适应英语学习</Text>
        </View>

        {/* 表单 */}
        <View style={s.form}>
          {isRegister && (
            <View style={s.inputGroup}>
              <Text style={s.label}>昵称</Text>
              <TextInput
                style={s.input}
                placeholder="你的名字"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
              />
            </View>
          )}

          <View style={s.inputGroup}>
            <Text style={s.label}>邮箱</Text>
            <TextInput
              style={s.input}
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>密码{isRegister ? '（至少 8 位）' : ''}</Text>
            <TextInput
              style={s.input}
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[s.submitBtn, loading && s.submitBtnDisabled]}
            disabled={loading}
            onPress={handleSubmit}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.submitBtnText}>{isRegister ? '注册并开始' : '登录'}</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={s.switchBtn} onPress={() => setIsRegister(!isRegister)}>
            <Text style={s.switchBtnText}>
              {isRegister ? '已有账号？点此登录' : '没有账号？免费注册'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>零基础 → 雅思 8 分的 AI 私教</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  logoArea: { alignItems: 'center', marginBottom: 40 },
  logoEmoji: { fontSize: 56, marginBottom: 8 },
  logoText: { fontSize: 32, fontWeight: '800', color: '#1F2937' },
  logoSub: { fontSize: 14, color: '#9CA3AF', marginTop: 4 },
  form: { backgroundColor: '#fff', borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1F2937', backgroundColor: '#F9FAFB' },
  submitBtn: { backgroundColor: '#6366F1', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 8 },
  submitBtnDisabled: { backgroundColor: '#C7D2FE' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  switchBtn: { marginTop: 16, alignItems: 'center' },
  switchBtnText: { color: '#6366F1', fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: '#D1D5DB', fontSize: 13, marginTop: 32 },
});

