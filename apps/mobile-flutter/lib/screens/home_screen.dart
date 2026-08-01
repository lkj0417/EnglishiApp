import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_state.dart';
import '../core/auth_store.dart';
import '../core/models.dart';
import 'login_screen.dart';
import 'speaking_screen.dart';
import 'speaking_screen.dart';
import 'writing_screen.dart';
import 'words_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final userId = context.read<AuthStore>().userId;
    if (userId != null) {
      await context.read<AppState>().loadTasks(userId);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthStore>();
    final state = context.watch<AppState>();
    final userId = auth.userId;

    return Scaffold(
      appBar: AppBar(
        title: const Text('今日学习计划'),
        actions: [
          IconButton(
            tooltip: '口语陪练',
            icon: const Icon(Icons.record_voice_over),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SpeakingScreen())),
          ),
          IconButton(
            tooltip: '口语陪练',
            icon: const Icon(Icons.record_voice_over),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SpeakingScreen())),
          ),
          IconButton(
            tooltip: '写作批改',
            icon: const Icon(Icons.edit_note),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WritingScreen())),
          ),
          IconButton(
            tooltip: '生词本',
            icon: const Icon(Icons.menu_book_outlined),
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const WordsScreen())),
          ),
          IconButton(
            tooltip: '退出登录',
            icon: const Icon(Icons.logout),
            onPressed: () async {
              await auth.logout();
              if (!context.mounted) return;
              Navigator.of(context).pushAndRemoveUntil(
                MaterialPageRoute(builder: (_) => const LoginScreen()),
                (_) => false,
              );
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              'Hi，${auth.user?.nickname ?? 'Learner'}',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text('以下任务由 AI Agent 根据你的学习档案与薄弱点生成。'),
            const SizedBox(height: 16),
            if (state.loadingTasks) const Center(child: CircularProgressIndicator()),
            if (state.error != null) _ErrorBox(message: state.error!, onRetry: _load),
            if (!state.loadingTasks && state.tasks.isEmpty)
              _EmptyTasksHint(
                onGenerate: userId == null
                    ? null
                    : () => context.read<AppState>().generateDailyPlan(userId, availableMinutes: 20),
              ),
            ...state.tasks.map(
              (task) => _TaskCard(
                task: task,
                onComplete: userId == null || task.status == 'completed'
                    ? null
                    : () => context.read<AppState>().completeTask(userId, task.id),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _load,
        icon: const Icon(Icons.refresh),
        label: const Text('刷新任务'),
      ),
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({required this.task, required this.onComplete});

  final DailyTask task;
  final VoidCallback? onComplete;

  @override
  Widget build(BuildContext context) {
    final completed = task.status == 'completed';
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Chip(label: Text(task.taskType)),
                const Spacer(),
                Text('${task.estimatedMinutes} min'),
              ],
            ),
            const SizedBox(height: 8),
            Text(task.title, style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerRight,
              child: completed
                  ? const Chip(label: Text('已完成'), avatar: Icon(Icons.check_circle_outline))
                  : FilledButton(onPressed: onComplete, child: const Text('完成任务')),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyTasksHint extends StatelessWidget {
  const _EmptyTasksHint({required this.onGenerate});

  final VoidCallback? onGenerate;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('今日暂无任务。', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            const Text('点击下方按钮，由 Go API 代理调用 Python AI Agent 生成今日计划。'),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: onGenerate,
              icon: const Icon(Icons.auto_awesome),
              label: const Text('生成今日计划'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  const _ErrorBox({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Theme.of(context).colorScheme.errorContainer,
      child: ListTile(
        title: Text(message),
        trailing: TextButton(onPressed: onRetry, child: const Text('重试')),
      ),
    );
  }
}

