class AppConfig {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );

  static const hiveBoxName = 'easitalk_app';
  static const tokenKey = 'auth_token';
  static const userIdKey = 'user_id';
}

