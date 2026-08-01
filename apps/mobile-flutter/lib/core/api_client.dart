import 'package:dio/dio.dart';
import 'package:intl/intl.dart';

import 'app_config.dart';
import 'models.dart';

class ApiException implements Exception {
  ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 20),
        headers: {'Content-Type': 'application/json'},
      ),
    );
  }

  late final Dio _dio;
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Options _authOptions() {
    final token = _token;
    if (token == null || token.isEmpty) {
      return Options();
    }
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<AuthResult> login({required String email, required String password}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/auth/login',
      data: {'email': email, 'password': password},
    );
    final envelope = _decodeEnvelope<AuthResult>(
      response.data,
      (raw) => AuthResult.fromJson(raw as Map<String, dynamic>),
    );
    return envelope.data;
  }

  Future<AuthResult> register({
    required String email,
    required String password,
    required String nickname,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/auth/register',
      data: {'email': email, 'password': password, 'nickname': nickname},
    );
    final envelope = _decodeEnvelope<AuthResult>(
      response.data,
      (raw) => AuthResult.fromJson(raw as Map<String, dynamic>),
    );
    return envelope.data;
  }

  Future<List<DailyTask>> fetchDailyTasks({required int userId, DateTime? date}) async {
    final day = DateFormat('yyyy-MM-dd').format(date ?? DateTime.now());
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/users/$userId/daily-tasks',
      queryParameters: {'date': day},
      options: _authOptions(),
    );
    final envelope = _decodeEnvelope<List<DailyTask>>(
      response.data,
      (raw) {
        final items = (raw as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
        return items.map((item) => DailyTask.fromJson(item as Map<String, dynamic>)).toList();
      },
    );
    return envelope.data;
  }

  Future<void> completeTask({required int userId, required int taskId}) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/daily-tasks/$taskId/complete',
      options: _authOptions(),
    );
    _decodeEnvelope<Map<String, dynamic>>(
      response.data,
      (raw) => raw as Map<String, dynamic>,
    );
  }

  Future<void> generateDailyPlan({required int userId, int availableMinutes = 20}) async {
    final day = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/daily-tasks/generate',
      data: {'taskDate': day, 'availableMinutes': availableMinutes},
      options: _authOptions(),
    );
    _decodeEnvelope<Map<String, dynamic>>(
      response.data,
      (raw) => raw as Map<String, dynamic>,
    );
  }

  Future<List<UserWord>> fetchWords({required int userId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/users/$userId/words',
      options: _authOptions(),
    );
    final envelope = _decodeEnvelope<List<UserWord>>(
      response.data,
      (raw) {
        final items = (raw as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
        return items.map((item) => UserWord.fromJson(item as Map<String, dynamic>)).toList();
      },
    );
    return envelope.data;
  }

  Future<UserWord> upsertWord({
    required int userId,
    required String word,
    required String meaning,
    String exampleSentence = '',
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/words',
      data: {
        'word': word,
        'meaning': meaning,
        'exampleSentence': exampleSentence,
      },
      options: _authOptions(),
    );
    return _decodeEnvelope<UserWord>(
      response.data,
      (raw) => UserWord.fromJson(raw as Map<String, dynamic>),
    ).data;
  }

  Future<UserWord> reviewWord({
    required int userId,
    required int wordId,
    required bool remembered,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/words/$wordId/review',
      data: {'remembered': remembered},
      options: _authOptions(),
    );
    return _decodeEnvelope<UserWord>(
      response.data,
      (raw) => UserWord.fromJson(raw as Map<String, dynamic>),
    ).data;
  }

  Future<WritingSubmission> correctWriting({
    required int userId,
    required String title,
    required String content,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/writing-submissions/correct',
      data: {'title': title, 'content': content},
      options: _authOptions(),
    );
    return _decodeEnvelope<WritingSubmission>(
      response.data,
      (raw) => WritingSubmission.fromJson(raw as Map<String, dynamic>),
    ).data;
  }

  Future<List<WritingSubmission>> fetchWritingHistory({required int userId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/users/$userId/writing-submissions',
      options: _authOptions(),
    );
    return _decodeEnvelope<List<WritingSubmission>>(
      response.data,
      (raw) {
        final items = (raw as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
        return items.map((item) => WritingSubmission.fromJson(item as Map<String, dynamic>)).toList();
      },
    ).data;
  }

  Future<SpeakingSession> speakingChat({
    required int userId,
    required String sessionId,
    required String message,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/speaking/chat',
      data: {'sessionId': sessionId, 'message': message},
      options: _authOptions(),
    );
    return _decodeEnvelope<SpeakingSession>(
      response.data,
      (raw) => SpeakingSession.fromJson(raw as Map<String, dynamic>),
    ).data;
  }

  Future<List<SpeakingSession>> fetchSpeakingSessions({required int userId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/users/$userId/speaking-sessions',
      options: _authOptions(),
    );
    return _decodeEnvelope<List<SpeakingSession>>(
      response.data,
      (raw) {
        final items = (raw as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
        return items.map((item) => SpeakingSession.fromJson(item as Map<String, dynamic>)).toList();
      },
    ).data;
  }
  Future<SpeakingSession> speakingChat({
    required int userId,
    required String sessionId,
    required String message,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      '/v1/users/$userId/speaking/chat',
      data: {'sessionId': sessionId, 'message': message},
      options: _authOptions(),
    );
    return _decodeEnvelope<SpeakingSession>(
      response.data,
      (raw) => SpeakingSession.fromJson(raw as Map<String, dynamic>),
    ).data;
  }

  Future<List<SpeakingSession>> fetchSpeakingSessions({required int userId}) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/v1/users/$userId/speaking-sessions',
      options: _authOptions(),
    );
    return _decodeEnvelope<List<SpeakingSession>>(
      response.data,
      (raw) {
        final items = (raw as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
        return items.map((item) => SpeakingSession.fromJson(item as Map<String, dynamic>)).toList();
      },
    ).data;
  }

  ApiEnvelope<T> _decodeEnvelope<T>(
    Map<String, dynamic>? json,
    T Function(dynamic raw) decodeData,
  ) {
    if (json == null) {
      throw ApiException('Empty server response');
    }
    final envelope = ApiEnvelope<T>.fromJson(json, decodeData);
    if (envelope.code != 0) {
      throw ApiException(envelope.message);
    }
    return envelope;
  }
}

