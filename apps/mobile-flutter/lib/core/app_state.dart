import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'models.dart';

class AppState extends ChangeNotifier {
  AppState({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  bool loadingTasks = false;
  bool loadingWords = false;
  bool correctingWriting = false;
  bool sendingSpeaking = false;
  String? error;
  List<DailyTask> tasks = [];
  List<UserWord> words = [];
  List<WritingSubmission> writingHistory = [];
  WritingSubmission? latestWritingResult;
  List<SpeakingSession> speakingSessions = [];

  Future<void> loadTasks(int userId) async {
    loadingTasks = true;
    error = null;
    notifyListeners();
    try {
      tasks = await _apiClient.fetchDailyTasks(userId: userId);
    } catch (e) {
      error = e.toString();
    } finally {
      loadingTasks = false;
      notifyListeners();
    }
  }

  Future<void> completeTask(int userId, int taskId) async {
    await _apiClient.completeTask(userId: userId, taskId: taskId);
    await loadTasks(userId);
  }

  Future<void> generateDailyPlan(int userId, {int availableMinutes = 20}) async {
    loadingTasks = true;
    error = null;
    notifyListeners();
    try {
      await _apiClient.generateDailyPlan(userId: userId, availableMinutes: availableMinutes);
      tasks = await _apiClient.fetchDailyTasks(userId: userId);
    } catch (e) {
      error = e.toString();
    } finally {
      loadingTasks = false;
      notifyListeners();
    }
  }

  Future<void> loadWords(int userId) async {
    loadingWords = true;
    error = null;
    notifyListeners();
    try {
      words = await _apiClient.fetchWords(userId: userId);
    } catch (e) {
      error = e.toString();
    } finally {
      loadingWords = false;
      notifyListeners();
    }
  }

  Future<void> addWord({
    required int userId,
    required String word,
    required String meaning,
    required String exampleSentence,
  }) async {
    await _apiClient.upsertWord(
      userId: userId,
      word: word,
      meaning: meaning,
      exampleSentence: exampleSentence,
    );
    await loadWords(userId);
  }

  Future<void> reviewWord({required int userId, required int wordId, required bool remembered}) async {
    await _apiClient.reviewWord(userId: userId, wordId: wordId, remembered: remembered);
    await loadWords(userId);
  }

  Future<void> correctWriting({required int userId, required String title, required String content}) async {
    correctingWriting = true;
    error = null;
    notifyListeners();
    try {
      latestWritingResult = await _apiClient.correctWriting(userId: userId, title: title, content: content);
      writingHistory = await _apiClient.fetchWritingHistory(userId: userId);
    } catch (e) {
      error = e.toString();
    } finally {
      correctingWriting = false;
      notifyListeners();
    }
  }

  Future<void> loadWritingHistory(int userId) async {
    error = null;
    notifyListeners();
    try {
      writingHistory = await _apiClient.fetchWritingHistory(userId: userId);
    } catch (e) {
      error = e.toString();
    } finally {
      notifyListeners();
    }
  }

  Future<void> sendSpeakingMessage({required int userId, required String sessionId, required String message}) async {
    sendingSpeaking = true;
    error = null;
    notifyListeners();
    try {
      final session = await _apiClient.speakingChat(userId: userId, sessionId: sessionId, message: message);
      speakingSessions = [session, ...speakingSessions];
    } catch (e) {
      error = e.toString();
    } finally {
      sendingSpeaking = false;
      notifyListeners();
    }
  }

  Future<void> loadSpeakingSessions(int userId) async {
    error = null;
    notifyListeners();
    try {
      speakingSessions = await _apiClient.fetchSpeakingSessions(userId: userId);
    } catch (e) {
      error = e.toString();
    } finally {
      notifyListeners();
    }
  }
}

