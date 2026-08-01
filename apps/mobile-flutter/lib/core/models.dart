class ApiEnvelope<T> {
  ApiEnvelope({
    required this.code,
    required this.message,
    required this.data,
    required this.traceId,
  });

  final int code;
  final String message;
  final T data;
  final String traceId;

  factory ApiEnvelope.fromJson(
    Map<String, dynamic> json,
    T Function(dynamic raw) decodeData,
  ) {
    return ApiEnvelope<T>(
      code: (json['code'] as num?)?.toInt() ?? -1,
      message: json['message']?.toString() ?? 'unknown',
      data: decodeData(json['data']),
      traceId: json['traceId']?.toString() ?? '',
    );
  }
}

class User {
  User({required this.id, required this.nickname, this.email});

  final int id;
  final String nickname;
  final String? email;

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: (json['id'] as num).toInt(),
      nickname: json['nickname']?.toString() ?? 'EasiTalk Learner',
      email: json['email']?.toString(),
    );
  }
}

class AuthResult {
  AuthResult({required this.token, required this.expiresIn, required this.user});

  final String token;
  final int expiresIn;
  final User user;

  factory AuthResult.fromJson(Map<String, dynamic> json) {
    return AuthResult(
      token: json['token'].toString(),
      expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 0,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }
}

class DailyTask {
  DailyTask({
    required this.id,
    required this.taskType,
    required this.title,
    required this.estimatedMinutes,
    required this.status,
  });

  final int id;
  final String taskType;
  final String title;
  final int estimatedMinutes;
  final String status;

  factory DailyTask.fromJson(Map<String, dynamic> json) {
    return DailyTask(
      id: (json['id'] as num).toInt(),
      taskType: json['taskType']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      estimatedMinutes: (json['estimatedMinutes'] as num?)?.toInt() ?? 0,
      status: json['status']?.toString() ?? 'pending',
    );
  }
}

class UserWord {
  UserWord({
    required this.id,
    required this.word,
    required this.meaning,
    required this.exampleSentence,
    required this.masteryLevel,
    required this.reviewCount,
    required this.errorCount,
  });

  final int id;
  final String word;
  final String meaning;
  final String exampleSentence;
  final int masteryLevel;
  final int reviewCount;
  final int errorCount;

  factory UserWord.fromJson(Map<String, dynamic> json) {
    return UserWord(
      id: (json['id'] as num).toInt(),
      word: json['word']?.toString() ?? '',
      meaning: json['meaning']?.toString() ?? '',
      exampleSentence: json['exampleSentence']?.toString() ?? '',
      masteryLevel: (json['masteryLevel'] as num?)?.toInt() ?? 0,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      errorCount: (json['errorCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class WritingSubmission {
  WritingSubmission({
    required this.id,
    required this.title,
    required this.originalContent,
    required this.correctedContent,
    required this.bandScore,
    required this.status,
    required this.correctionResult,
  });

  final int id;
  final String title;
  final String originalContent;
  final String correctedContent;
  final double? bandScore;
  final String status;
  final Map<String, dynamic> correctionResult;

  factory WritingSubmission.fromJson(Map<String, dynamic> json) {
    return WritingSubmission(
      id: (json['id'] as num).toInt(),
      title: json['title']?.toString() ?? '',
      originalContent: json['originalContent']?.toString() ?? '',
      correctedContent: json['correctedContent']?.toString() ?? '',
      bandScore: (json['bandScore'] as num?)?.toDouble(),
      status: json['status']?.toString() ?? 'corrected',
      correctionResult: json['correctionResult'] is Map<String, dynamic>
          ? json['correctionResult'] as Map<String, dynamic>
          : <String, dynamic>{},
    );
  }
}

class SpeakingSession {
  SpeakingSession({
    required this.id,
    required this.sessionId,
    required this.userText,
    required this.aiReply,
    required this.score,
  });

  final int id;
  final String sessionId;
  final String userText;
  final String aiReply;
  final double? score;

  factory SpeakingSession.fromJson(Map<String, dynamic> json) {
    return SpeakingSession(
      id: (json['id'] as num).toInt(),
      sessionId: json['sessionId']?.toString() ?? '',
      userText: json['userText']?.toString() ?? '',
      aiReply: json['aiReply']?.toString() ?? '',
      score: (json['score'] as num?)?.toDouble(),
    );
  }
}

