import 'package:easitalk_mobile/core/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('AuthResult parses wrapped user payload', () {
    final auth = AuthResult.fromJson({
      'token': 'token',
      'expiresIn': 3600,
      'user': {'id': 1, 'nickname': 'Demo', 'email': 'demo@example.com'},
    });

    expect(auth.token, 'token');
    expect(auth.user.id, 1);
    expect(auth.user.nickname, 'Demo');
  });

  test('DailyTask parses Go API payload', () {
    final task = DailyTask.fromJson({
      'id': 9,
      'taskType': 'review',
      'title': '旧知识复习',
      'estimatedMinutes': 8,
      'status': 'pending',
    });

    expect(task.id, 9);
    expect(task.taskType, 'review');
    expect(task.estimatedMinutes, 8);
  });

  test('WritingSubmission parses correction payload', () {
    final submission = WritingSubmission.fromJson({
      'id': 3,
      'title': 'Essay',
      'originalContent': 'I yesterday go to school.',
      'correctedContent': 'I went yesterday to school.',
      'bandScore': 5.5,
      'status': 'corrected',
      'correctionResult': {
        'issues': [],
      },
    });

    expect(submission.id, 3);
    expect(submission.bandScore, 5.5);
    expect(submission.correctionResult['issues'], isList);
  });

  test('SpeakingSession parses speaking payload', () {
    final session = SpeakingSession.fromJson({
      'id': 7,
      'sessionId': 's1',
      'userText': 'I want to practice English.',
      'aiReply': 'Great, let us start.',
      'score': 78,
    });

    expect(session.id, 7);
    expect(session.sessionId, 's1');
    expect(session.score, 78);
  });
}

