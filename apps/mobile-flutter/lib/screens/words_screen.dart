import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/app_state.dart';
import '../core/auth_store.dart';
import '../core/models.dart';

class WordsScreen extends StatefulWidget {
  const WordsScreen({super.key});

  @override
  State<WordsScreen> createState() => _WordsScreenState();
}

class _WordsScreenState extends State<WordsScreen> {
  @override
  void initState() {
	super.initState();
	WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
	final userId = context.read<AuthStore>().userId;
	if (userId != null) {
	  await context.read<AppState>().loadWords(userId);
	}
  }

  Future<void> _showAddWordDialog() async {
	final userId = context.read<AuthStore>().userId;
	if (userId == null) return;

	final wordController = TextEditingController();
	final meaningController = TextEditingController();
	final exampleController = TextEditingController();

	await showDialog<void>(
	  context: context,
	  builder: (dialogContext) => AlertDialog(
		title: const Text('添加生词'),
		content: SingleChildScrollView(
		  child: Column(
			mainAxisSize: MainAxisSize.min,
			children: [
			  TextField(controller: wordController, decoration: const InputDecoration(labelText: '单词')),
			  TextField(controller: meaningController, decoration: const InputDecoration(labelText: '释义')),
			  TextField(controller: exampleController, decoration: const InputDecoration(labelText: '例句')),
			],
		  ),
		),
		actions: [
		  TextButton(onPressed: () => Navigator.of(dialogContext).pop(), child: const Text('取消')),
		  FilledButton(
			onPressed: () async {
			  final word = wordController.text.trim();
			  final meaning = meaningController.text.trim();
			  if (word.isEmpty || meaning.isEmpty) return;
			  await context.read<AppState>().addWord(
					userId: userId,
					word: word,
					meaning: meaning,
					exampleSentence: exampleController.text.trim(),
				  );
			  if (dialogContext.mounted) Navigator.of(dialogContext).pop();
			},
			child: const Text('保存'),
		  ),
		],
	  ),
	);

	wordController.dispose();
	meaningController.dispose();
	exampleController.dispose();
  }

  @override
  Widget build(BuildContext context) {
	final state = context.watch<AppState>();
	final userId = context.watch<AuthStore>().userId;

	return Scaffold(
	  appBar: AppBar(title: const Text('我的生词本')),
	  body: RefreshIndicator(
		onRefresh: _load,
		child: ListView(
		  padding: const EdgeInsets.all(16),
		  children: [
			const Text('根据艾宾浩斯间隔复习，系统会动态调整下次复习时间。'),
			const SizedBox(height: 16),
			if (state.loadingWords) const Center(child: CircularProgressIndicator()),
			if (!state.loadingWords && state.words.isEmpty)
			  const Card(
				child: Padding(
				  padding: EdgeInsets.all(16),
				  child: Text('暂无生词。点击右下角添加一个单词。'),
				),
			  ),
			...state.words.map(
			  (word) => _WordCard(
				word: word,
				onRemembered: userId == null
					? null
					: () => context.read<AppState>().reviewWord(userId: userId, wordId: word.id, remembered: true),
				onForgot: userId == null
					? null
					: () => context.read<AppState>().reviewWord(userId: userId, wordId: word.id, remembered: false),
			  ),
			),
		  ],
		),
	  ),
	  floatingActionButton: FloatingActionButton.extended(
		onPressed: _showAddWordDialog,
		icon: const Icon(Icons.add),
		label: const Text('添加生词'),
	  ),
	);
  }
}

class _WordCard extends StatelessWidget {
  const _WordCard({required this.word, required this.onRemembered, required this.onForgot});

  final UserWord word;
  final VoidCallback? onRemembered;
  final VoidCallback? onForgot;

  @override
  Widget build(BuildContext context) {
	return Card(
	  margin: const EdgeInsets.only(bottom: 12),
	  child: Padding(
		padding: const EdgeInsets.all(16),
		child: Column(
		  crossAxisAlignment: CrossAxisAlignment.start,
		  children: [
			Row(
			  children: [
				Expanded(
				  child: Text(
					word.word,
					style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold),
				  ),
				),
				Chip(label: Text('掌握 ${word.masteryLevel}/5')),
			  ],
			),
			const SizedBox(height: 8),
			Text(word.meaning),
			if (word.exampleSentence.isNotEmpty) ...[
			  const SizedBox(height: 8),
			  Text('例句：${word.exampleSentence}', style: Theme.of(context).textTheme.bodySmall),
			],
			const SizedBox(height: 12),
			Row(
			  children: [
				Text('复习 ${word.reviewCount} 次 · 错误 ${word.errorCount} 次'),
				const Spacer(),
				TextButton(onPressed: onForgot, child: const Text('忘记')),
				FilledButton(onPressed: onRemembered, child: const Text('记住')),
			  ],
			),
		  ],
		),
	  ),
	);
  }
}

