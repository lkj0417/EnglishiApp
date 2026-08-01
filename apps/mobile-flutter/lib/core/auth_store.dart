import 'package:flutter/foundation.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'api_client.dart';
import 'app_config.dart';
import 'models.dart';

class AuthStore extends ChangeNotifier {
  AuthStore({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;
  Box<dynamic>? _box;

  String? _token;
  int? _userId;
  User? _user;
  bool _initialized = false;
  bool _loading = false;

  bool get initialized => _initialized;
  bool get loading => _loading;
  bool get isAuthenticated => _token != null && _userId != null;
  String? get token => _token;
  int? get userId => _userId;
  User? get user => _user;

  Future<void> init() async {
    await Hive.initFlutter();
    _box = await Hive.openBox<dynamic>(AppConfig.hiveBoxName);
    _token = _box!.get(AppConfig.tokenKey) as String?;
    _userId = _box!.get(AppConfig.userIdKey) as int?;
    _apiClient.setToken(_token);
    _initialized = true;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    await _authenticate(() => _apiClient.login(email: email, password: password));
  }

  Future<void> register(String email, String password, String nickname) async {
    await _authenticate(
      () => _apiClient.register(email: email, password: password, nickname: nickname),
    );
  }

  Future<void> logout() async {
    _token = null;
    _userId = null;
    _user = null;
    _apiClient.setToken(null);
    await _box?.delete(AppConfig.tokenKey);
    await _box?.delete(AppConfig.userIdKey);
    notifyListeners();
  }

  Future<void> _authenticate(Future<AuthResult> Function() action) async {
    _loading = true;
    notifyListeners();
    try {
      final result = await action();
      _token = result.token;
      _userId = result.user.id;
      _user = result.user;
      _apiClient.setToken(_token);
      await _box?.put(AppConfig.tokenKey, _token);
      await _box?.put(AppConfig.userIdKey, _userId);
    } finally {
      _loading = false;
      notifyListeners();
    }
  }
}

