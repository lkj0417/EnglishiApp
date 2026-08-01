import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_state.dart';
import '../core/auth_store.dart';
import '../core/models.dart';

class SpeakingScreen extends StatefulWidget {
  const SpeakingScreen({super.key});

  @override
  State<SpeakingScreen> createState() => _SpeakingScreenState();
}

class _SpeakingScreenState extends State<SpeakingScreen> {
  final _messageController = TextEditingController(text: 'I want to practice English for travel.');
  late final String _sessionId = 'speaking-${DateTime.now().millisecondsSinceEpoch}';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<AuthStore>().userId;
      if (userId != null) {
        context.read<AppState>().loadSpeakingSessions(userId);
      }
    });
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final userId = context.read<AuthStore>().userId;
    final message = _messageController.text.trim();
    if (userId == null || message.isEmpty) return;
    await context.read<AppState>().sendSpeakingMessage(userId: userId, sessionId: _sessionId, message: message);
    _messageController.clear();
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('AI 口语陪练')),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              reverse: true,
              padding: const EdgeInsets.all(16),
              children: [
                ...state.speakingSessions.map((session) => _SpeakingBubble(session: session)),
                if (state.speakingSessions.isEmpty)
                  const Card(
                    child: Padding(
                      padding: EdgeInsets.all(16),
                      child: Text('输入一句英文，AI 会进行口语对话、文本纠错，并返回模拟发音评分。'),
                    ),
                  ),
              ],
            ),
          ),
          if (state.error != null) Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Text(state.error!, style: const TextStyle(color: Colors.red)),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _messageController,
                      decoration: const InputDecoration(
                        hintText: '输入英文口语内容... ',
                        border: OutlineInputBorder(),
                      ),
                      minLines: 1,
                      maxLines: 3,
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    onPressed: state.sendingSpeaking ? null : _send,
                    child: state.sendingSpeaking ? const CircularProgressIndicator() : const Text('发送'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SpeakingBubble extends StatelessWidget {
  const _SpeakingBubble({required this.session});

  final SpeakingSession session;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('你：${session.userText}', style: const TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text('AI：${session.aiReply}'),
            if (session.score != null) ...[
              const SizedBox(height: 8),
              Chip(label: Text('模拟发音评分 ${session.score!.toStringAsFixed(0)}')),
            ],
          ],
        ),
      ),
    );
  }
}

