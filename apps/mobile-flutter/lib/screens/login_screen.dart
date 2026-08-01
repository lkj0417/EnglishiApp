import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/auth_store.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController(text: 'demo@easitalk.local');
  final _passwordController = TextEditingController(text: 'Password123');
  final _nicknameController = TextEditingController(text: 'EasiTalk Learner');
  bool _registerMode = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nicknameController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _error = null);
    final auth = context.read<AuthStore>();
    try {
      if (_registerMode) {
        await auth.register(
          _emailController.text.trim(),
          _passwordController.text,
          _nicknameController.text.trim(),
        );
      } else {
        await auth.login(_emailController.text.trim(), _passwordController.text);
      }
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const HomeScreen()));
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final loading = context.watch<AuthStore>().loading;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(Icons.record_voice_over, size: 64, color: Color(0xFF4F46E5)),
                    const SizedBox(height: 16),
                    Text(
                      _registerMode ? '创建 EasiTalk 账号' : '登录 EasiTalk AI',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 24),
                    TextFormField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(labelText: '邮箱', border: OutlineInputBorder()),
                      validator: (value) => (value == null || !value.contains('@')) ? '请输入有效邮箱' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: '密码', border: OutlineInputBorder()),
                      validator: (value) => (value == null || value.length < 8) ? '密码至少 8 位' : null,
                    ),
                    if (_registerMode) ...[
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _nicknameController,
                        decoration: const InputDecoration(labelText: '昵称', border: OutlineInputBorder()),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: const TextStyle(color: Colors.red)),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: loading ? null : _submit,
                      child: loading ? const CircularProgressIndicator() : Text(_registerMode ? '注册并登录' : '登录'),
                    ),
                    TextButton(
                      onPressed: loading ? null : () => setState(() => _registerMode = !_registerMode),
                      child: Text(_registerMode ? '已有账号？去登录' : '没有账号？创建账号'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

