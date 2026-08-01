import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_state.dart';
import '../core/auth_store.dart';
import '../core/models.dart';

class WritingScreen extends StatefulWidget {
  const WritingScreen({super.key});

  @override
  State<WritingScreen> createState() => _WritingScreenState();
}

class _WritingScreenState extends State<WritingScreen> {
  final _titleController = TextEditingController(text: 'My weekend plan');
  final _contentController = TextEditingController(
    text: 'I yesterday go to supermarket. I very like learn English because it is more better for my job.',
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<AuthStore>().userId;
      if (userId != null) {
        context.read<AppState>().loadWritingHistory(userId);
      }
    });
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final userId = context.read<AuthStore>().userId;
    if (userId == null) return;
    await context.read<AppState>().correctWriting(
          userId: userId,
          title: _titleController.text.trim(),
          content: _contentController.text.trim(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    return Scaffold(
      appBar: AppBar(title: const Text('AI 写作批改')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(
            controller: _titleController,
            decoration: const InputDecoration(labelText: '作文标题', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _contentController,
            minLines: 8,
            maxLines: 12,
            decoration: const InputDecoration(labelText: '作文内容', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: state.correctingWriting ? null : _submit,
            icon: const Icon(Icons.auto_fix_high),
            label: Text(state.correctingWriting ? '批改中...' : '提交 AI 批改'),
          ),
          if (state.error != null) ...[
            const SizedBox(height: 12),
            Text(state.error!, style: const TextStyle(color: Colors.red)),
          ],
          if (state.latestWritingResult != null) ...[
            const SizedBox(height: 20),
            _CorrectionResultCard(submission: state.latestWritingResult!),
          ],
          const SizedBox(height: 24),
          Text('历史记录', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          ...state.writingHistory.map((item) => _HistoryTile(submission: item)),
        ],
      ),
    );
  }
}

class _CorrectionResultCard extends StatelessWidget {
  const _CorrectionResultCard({required this.submission});

  final WritingSubmission submission;

  @override
  Widget build(BuildContext context) {
    final issues = submission.correctionResult['issues'];
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text('批改结果', style: Theme.of(context).textTheme.titleMedium),
                const Spacer(),
                if (submission.bandScore != null) Chip(label: Text('Band ${submission.bandScore}')),
              ],
            ),
            const SizedBox(height: 12),
            const Text('优化后文本', style: TextStyle(fontWeight: FontWeight.bold)),
            Text(submission.correctedContent),
            const SizedBox(height: 12),
            const Text('问题明细', style: TextStyle(fontWeight: FontWeight.bold)),
            if (issues is List)
              ...issues.map(
                (issue) => ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  title: Text('${issue['original']} → ${issue['suggestion']}'),
                  subtitle: Text(issue['explanation']?.toString() ?? ''),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.submission});

  final WritingSubmission submission;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(submission.title),
        subtitle: Text(submission.correctedContent, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: submission.bandScore == null ? null : Text('Band ${submission.bandScore}'),
      ),
    );
  }
}

