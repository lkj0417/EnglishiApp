import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:provider/provider.dart';

import 'core/api_client.dart';
import 'core/app_state.dart';
import 'core/auth_store.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final apiClient = ApiClient();
  final authStore = AuthStore(apiClient: apiClient);
  await authStore.init();

  runApp(EasiTalkApp(apiClient: apiClient, authStore: authStore));
}

class EasiTalkApp extends StatelessWidget {
  const EasiTalkApp({
    required this.apiClient,
    required this.authStore,
    super.key,
  });

  final ApiClient apiClient;
  final AuthStore authStore;

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthStore>.value(value: authStore),
        ChangeNotifierProvider<AppState>(
          create: (_) => AppState(apiClient: apiClient),
        ),
      ],
      child: GetMaterialApp(
        title: 'EasiTalk AI',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF4F46E5)),
          useMaterial3: true,
        ),
        home: const RootGate(),
      ),
    );
  }
}

class RootGate extends StatelessWidget {
  const RootGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    if (!auth.initialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return auth.isAuthenticated ? const HomeScreen() : const LoginScreen();
  }
}

