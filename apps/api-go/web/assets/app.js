const state = {
  token: localStorage.getItem('easitalk.token') || '',
  userId: Number(localStorage.getItem('easitalk.userId') || 0),
  user: safeJson(localStorage.getItem('easitalk.user'), null),
  profile: null,
  tasks: [],
  words: [],
  writing: [],
  speaking: [],
  recorder: null,
  recordedChunks: [],
  recordedBlob: null,
  familiarWords: safeJson(localStorage.getItem('easitalk.familiarWords'), []),
  wordExposure: safeJson(localStorage.getItem('easitalk.wordExposure'), {}),
  wordGame: null,
  echoProgress: safeJson(localStorage.getItem('easitalk.echoProgress'), {
    completed: [],
    current: 'blindListen',
    retellDraft: '',
    updatedAt: '',
  }),
};

const pageTitles = {
  dashboard: '学习总览',
  reading: '阅读透镜',
  profile: '学习档案',
  tasks: '每日任务',
  words: '生词本',
  writing: '写作批改',
  speaking: '口语陪练',
  echo: 'Echo Loop 跟读',
  audio: '音频上传',
};

const $ = (id) => document.getElementById(id);

function safeJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_) {
    return fallback;
  }
}

function today() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

function csv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asText(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function unwrapPayload(payload) {
  if (!payload) return payload;
  if (payload.code !== undefined && payload.code !== 0) {
    throw new Error(payload.message || `请求失败：${payload.code}`);
  }
  return payload.data !== undefined ? payload.data : payload;
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = payload && payload.message ? payload.message : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return unwrapPayload(payload);
}

function showToast(message, type = 'ok') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = type === 'error' ? 'notice error' : 'notice';
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.hidden = true;
  }, 4200);
}

function requireLogin() {
  if (!state.userId) {
    showToast('请先登录或注册账号', 'error');
    return false;
  }
  return true;
}

function setLoading(button, loading, text) {
  if (!button) return;
  if (loading) {
    button.dataset.oldText = button.textContent;
    button.disabled = true;
    button.textContent = text || '处理中...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.oldText || button.textContent;
  }
}

function persistAuth(result) {
  state.token = result.token;
  state.userId = Number(result.user?.id || 0);
  state.user = result.user || null;
  localStorage.setItem('easitalk.token', state.token);
  localStorage.setItem('easitalk.userId', String(state.userId));
  localStorage.setItem('easitalk.user', JSON.stringify(state.user));
  updateAuthUI();
}

function updateAuthUI() {
  const loggedIn = Boolean(state.userId);
  $('authPanel').classList.toggle('hidden', loggedIn);
  $('userName').textContent = loggedIn ? (state.user?.nickname || state.user?.email || `用户 ${state.userId}`) : '未登录';
  $('userMeta').textContent = loggedIn ? `User ID: ${state.userId}` : '请登录后使用完整功能';
  $('logoutBtn').style.display = loggedIn ? 'inline-flex' : 'none';
}

function switchView(name) {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.view === name);
  });
  document.querySelectorAll('.view').forEach((view) => {
    view.classList.toggle('active', view.id === `view-${name}`);
  });
  $('pageTitle').textContent = pageTitles[name] || '学习控制台';
}

async function checkHealth() {
  try {
    await api('/health', { method: 'GET' });
    $('apiStatusDot').className = 'status-dot ok';
    if (!state.userId) $('userMeta').textContent = 'Go API 已连接';
  } catch (error) {
    $('apiStatusDot').className = 'status-dot bad';
    $('userMeta').textContent = 'Go API 连接失败';
  }
}

async function login() {
  const btn = $('loginBtn');
  setLoading(btn, true, '登录中...');
  try {
    const result = await api('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: $('authEmail').value.trim(),
        password: $('authPassword').value,
      }),
    });
    persistAuth(result);
    showToast('登录成功');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function register() {
  const btn = $('registerBtn');
  setLoading(btn, true, '注册中...');
  try {
    const result = await api('/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: $('authEmail').value.trim(),
        password: $('authPassword').value,
        nickname: $('authNickname').value.trim() || 'EasiTalk Learner',
      }),
    });
    persistAuth(result);
    showToast('注册成功，已自动登录');
    await refreshAll();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

function logout() {
  state.token = '';
  state.userId = 0;
  state.user = null;
  state.profile = null;
  state.tasks = [];
  state.words = [];
  state.writing = [];
  state.speaking = [];
  localStorage.removeItem('easitalk.token');
  localStorage.removeItem('easitalk.userId');
  localStorage.removeItem('easitalk.user');
  updateAuthUI();
  renderAll();
  showToast('已退出登录');
}

async function loadProfile() {
  if (!requireLogin()) return;
  state.profile = await api(`/v1/users/${state.userId}/profile`);
  fillProfileForm();
  renderProfileSummary();
}

function fillProfileForm() {
  const profile = state.profile || {};
  $('profileCefr').value = profile.cefrLevel || 'A2';
  $('profileGoal').value = profile.learningGoal || '口语提升';
  $('profileMinutes').value = profile.dailyMinutes || 25;
  $('profilePain').value = arrayText(profile.painPoints, '表达卡顿,语法易错');
  $('profilePrefs').value = arrayText(profile.materialPreferences, '日常生活,旅行');
  $('profileGrammar').value = arrayText(profile.weakGrammarPoints, '一般过去时,冠词');
  $('profileErrorWords').value = arrayText(profile.errorProneWords, 'affect,effect');
  $('profileSpeaking').value = arrayText(profile.speakingWeaknesses, '连读,重音');
  $('profileWriting').value = arrayText(profile.writingWeaknesses, '中式表达,句式单一');
}

function arrayText(value, fallback = '') {
  if (Array.isArray(value)) return value.join(',');
  if (typeof value === 'string') {
    const parsed = safeJson(value, null);
    return Array.isArray(parsed) ? parsed.join(',') : value;
  }
  return fallback;
}

async function saveProfile() {
  if (!requireLogin()) return;
  const btn = $('saveProfileBtn');
  setLoading(btn, true, '保存中...');
  try {
    state.profile = await api(`/v1/users/${state.userId}/profile`, {
      method: 'PUT',
      body: JSON.stringify({
        cefrLevel: $('profileCefr').value.trim(),
        learningGoal: $('profileGoal').value.trim(),
        dailyMinutes: Number($('profileMinutes').value || 25),
        painPoints: csv($('profilePain').value),
        materialPreferences: csv($('profilePrefs').value),
        weakGrammarPoints: csv($('profileGrammar').value),
        errorProneWords: csv($('profileErrorWords').value),
        speakingWeaknesses: csv($('profileSpeaking').value),
        writingWeaknesses: csv($('profileWriting').value),
      }),
    });
    renderProfileSummary();
    showToast('学习档案已保存');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

function renderProfileSummary() {
  const target = $('profileSummary');
  const p = state.profile;
  if (!p) {
    target.textContent = '暂无档案数据';
    target.className = 'profile-summary muted';
    return;
  }
  target.className = 'profile-summary';
  target.innerHTML = `
    <strong>${p.cefrLevel || '-'} · ${p.learningGoal || '-'}</strong><br />
    每日学习：${p.dailyMinutes || '-'} 分钟<br />
    核心痛点：${arrayText(p.painPoints, '-')}<br />
    薄弱语法：${arrayText(p.weakGrammarPoints, '-')}<br />
    口语短板：${arrayText(p.speakingWeaknesses, '-')}<br />
    写作短板：${arrayText(p.writingWeaknesses, '-')}
  `;
}

async function loadTasks() {
  if (!requireLogin()) return;
  const date = $('taskDate').value || today();
  const result = await api(`/v1/users/${state.userId}/daily-tasks?date=${encodeURIComponent(date)}`);
  state.tasks = result.items || [];
  renderTasks();
}

async function generatePlan(buttonId = 'generatePlanBtn') {
  if (!requireLogin()) return;
  const btn = $(buttonId);
  setLoading(btn, true, '生成中...');
  try {
    const date = $('taskDate').value || today();
    await api(`/v1/users/${state.userId}/daily-tasks/generate`, {
      method: 'POST',
      body: JSON.stringify({
        taskDate: date,
        availableMinutes: Number($('availableMinutes').value || 25),
      }),
    });
    showToast('今日学习计划已生成');
    await loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function completeTask(taskId) {
  try {
    await api(`/v1/users/${state.userId}/daily-tasks/${taskId}/complete`, { method: 'POST' });
    showToast('任务已完成');
    await loadTasks();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderTasks() {
  const pending = state.tasks.filter((t) => t.status !== 'completed').length;
  const done = state.tasks.filter((t) => t.status === 'completed').length;
  $('statTasks').textContent = `${pending}/${done}`;
  renderTaskList($('tasksList'), state.tasks);
  renderTaskList($('dashboardTasks'), state.tasks.slice(0, 4));
}

function renderTaskList(target, tasks) {
  if (!tasks.length) {
    target.className = 'list empty';
    target.textContent = '暂无任务，点击“生成计划”由 AI Agent 创建今日任务。';
    return;
  }
  target.className = 'list';
  target.innerHTML = tasks.map((task) => {
    const payload = normalizeTaskPayload(task);
    const criteria = Array.isArray(payload.successCriteria) ? payload.successCriteria : [];
    return `
      <article class="item-card">
        <h4>${escapeHtml(task.title || payload.title || '学习任务')}</h4>
        <div class="item-meta">
          <span class="badge">${escapeHtml(payload.skill || task.taskType || 'task')}</span>
          <span class="badge">${escapeHtml(payload.level || '')}</span>
          <span class="badge ${task.status === 'completed' ? 'success' : 'warn'}">${escapeHtml(task.status || 'pending')}</span>
          <span class="badge">${task.estimatedMinutes || payload.estimatedMinutes || 0} 分钟</span>
        </div>
        ${payload.learningValue ? `<p><strong>为什么学：</strong>${escapeHtml(payload.learningValue)}</p>` : ''}
        ${payload.instructions ? `<p><strong>怎么学：</strong>${escapeHtml(payload.instructions)}</p>` : ''}
        ${payload.outputRequirement ? `<p><strong>输出要求：</strong>${escapeHtml(payload.outputRequirement)}</p>` : ''}
        ${criteria.length ? `<p><strong>完成标准：</strong>${criteria.map(escapeHtml).join(' / ')}</p>` : ''}
        ${payload.adjustmentSignal ? `<p><strong>动态调整：</strong>${escapeHtml(payload.adjustmentSignal)}</p>` : ''}
        ${task.status === 'completed' ? '<p>已完成，继续保持。</p>' : `<button class="secondary-button" onclick="completeTask(${task.id})">标记完成</button>`}
      </article>
    `;
  }).join('');
}

function normalizeTaskPayload(task) {
  const payload = parseMaybeJson(task.payload);
  return payload && typeof payload === 'object' ? payload : {};
}

async function loadWords() {
  if (!requireLogin()) return;
  const result = await api(`/v1/users/${state.userId}/words`);
  state.words = result.items || [];
  renderWords();
}

async function addWord() {
  if (!requireLogin()) return;
  const btn = $('addWordBtn');
  setLoading(btn, true, '保存中...');
  try {
    await api(`/v1/users/${state.userId}/words`, {
      method: 'POST',
      body: JSON.stringify({
        word: $('wordText').value.trim(),
        meaning: $('wordMeaning').value.trim(),
        exampleSentence: $('wordExample').value.trim(),
      }),
    });
    showToast('生词已保存');
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function reviewWord(wordId, remembered) {
  try {
    await api(`/v1/users/${state.userId}/words/${wordId}/review`, {
      method: 'POST',
      body: JSON.stringify({ remembered }),
    });
    showToast(remembered ? '已标记记住' : '已标记忘记，将加强复习');
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deleteWord(wordId) {
  if (!window.confirm('确定删除这个生词吗？')) return;
  try {
    await api(`/v1/users/${state.userId}/words/${wordId}`, { method: 'DELETE' });
    showToast('生词已删除');
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function renderWords() {
  $('statWords').textContent = String(state.words.length);
  const target = $('wordsList');
  if (!state.words.length) {
    target.className = 'list empty';
    target.textContent = '暂无生词，先添加一个常用表达。';
    return;
  }
  target.className = 'list';
  target.innerHTML = state.words.map((word) => `
    <article class="item-card">
      <h4>${escapeHtml(word.word)}</h4>
      <p>${escapeHtml(word.meaning || '-')}</p>
      <p><strong>例句：</strong>${escapeHtml(word.exampleSentence || '-')}</p>
      <div class="item-meta">
        <span class="badge">掌握 ${word.masteryLevel || 0}</span>
        <span class="badge">复习 ${word.reviewCount || 0}</span>
        <span class="badge warn">错误 ${word.errorCount || 0}</span>
      </div>
      <div class="button-row">
        <button class="secondary-button" onclick="reviewWord(${word.id}, true)">记住了</button>
        <button class="secondary-button" onclick="reviewWord(${word.id}, false)">忘记了</button>
        <button class="danger-button" onclick="deleteWord(${word.id})">删除</button>
      </div>
    </article>
  `).join('');
}

function loadReadingSample() {
  $('readingText').value = 'Many English learners can understand grammar rules, but they still hesitate when speaking because they rarely practice retrieving sentences under real pressure. A better strategy is to repeat useful chunks, record yourself, compare your version with a native-like model, and review the mistakes the next day.';
  showToast('已加载阅读透镜示例文本');
}

function getReadingSelection() {
  const el = $('readingText');
  const selected = el.value.slice(el.selectionStart, el.selectionEnd).trim();
  return selected || window.getSelection().toString().trim();
}

function normalizeWord(word) {
  return String(word || '').trim().toLowerCase();
}

function persistFamiliarWords() {
  localStorage.setItem('easitalk.familiarWords', JSON.stringify(state.familiarWords));
  renderFamiliarWordsPanel();
}

function persistWordExposure() {
  localStorage.setItem('easitalk.wordExposure', JSON.stringify(state.wordExposure));
}

function isFamiliarWord(word) {
  return state.familiarWords.includes(normalizeWord(word));
}

function markSelectedAsFamiliar() {
  const selected = normalizeWord(getReadingSelection());
  if (!selected || !/^[a-z][a-z'-]*$/.test(selected)) {
    showToast('请先选中一个英文单词', 'error');
    return;
  }
  if (!state.familiarWords.includes(selected)) {
    state.familiarWords.push(selected);
    state.familiarWords.sort();
    persistFamiliarWords();
  }
  showToast(`已标记为熟悉词：${selected}`);
}

function removeFamiliarWord(word) {
  const target = normalizeWord(word);
  state.familiarWords = state.familiarWords.filter((item) => item !== target);
  persistFamiliarWords();
  showToast(`已移除熟悉词：${target}`);
}

function renderFamiliarWordsPanel() {
  const panel = $('familiarWordsPanel');
  if (!panel) return;
  if (!state.familiarWords.length) {
    panel.className = 'result-card muted';
    panel.textContent = '熟悉词过滤：暂无熟悉词。选中阅读材料里的简单词，点击“标记选中为熟悉词”。';
    return;
  }
  panel.className = 'result-card';
  panel.innerHTML = `<strong>熟悉词过滤：</strong><br />${state.familiarWords.map((word) => `
    <span class="badge">${escapeHtml(word)} <button class="mini-x" onclick='removeFamiliarWord(${htmlJsArg(word)})'>×</button></span>
  `).join(' ')}`;
}

function rankReadingWords(words) {
  return words
    .filter((word) => !isFamiliarWord(word))
    .sort((a, b) => (state.wordExposure[normalizeWord(a)] || 0) - (state.wordExposure[normalizeWord(b)] || 0));
}

function analyzeReadingSelection() {
  const selected = getReadingSelection();
  if (!selected) {
    showToast('请先在英文材料中选中一个单词或句子', 'error');
    return;
  }
  const isWord = /^[A-Za-z][A-Za-z'-]*$/.test(selected);
  if (isWord) {
    const key = normalizeWord(selected);
    state.wordExposure[key] = (state.wordExposure[key] || 0) + 1;
    persistWordExposure();
  }
  const tokens = selected.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  const longWords = tokens.filter((word) => word.length >= 7).slice(0, 8);
  const hint = isWord
    ? buildWordTeaching(selected, '', '')
    : `句子长度：${tokens.length} 个词\n疑似关键词：${longWords.join(', ') || '无'}\n学习建议：先找主语和谓语，再拆分从句、介词短语和固定搭配。`;
  $('readingLensResult').className = 'result-card';
  $('readingLensResult').innerHTML = `
    <strong>选中文本：</strong>${escapeHtml(selected)}<br /><br />
    <strong>透镜解析：</strong><br />${escapeHtml(hint)}<br /><br />
    ${isWord ? `<button class="primary-button" onclick='saveLensWord(${htmlJsArg(selected)})'>收藏为生词</button>` : ''}
  `;
}

function extractReadingWords() {
  const text = $('readingText').value;
  const words = rankReadingWords(Array.from(new Set((text.match(/[A-Za-z][A-Za-z'-]*/g) || [])
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 7))))
    .slice(0, 18);
  const target = $('readingWordsList');
  if (!words.length) {
    target.className = 'list empty';
    target.textContent = '没有提取到明显生词，请粘贴更长的英文材料。';
    return;
  }
  target.className = 'list';
  target.innerHTML = words.map((word) => `
    <article class="item-card compact-card">
      <h4>${escapeHtml(word)}</h4>
      <p>${escapeHtml(buildWordTeaching(word, '', '').split('\n')[0])}</p>
      <div class="item-meta"><span class="badge">曝光 ${state.wordExposure[normalizeWord(word)] || 0}</span></div>
      <div class="button-row">
        <button class="secondary-button" onclick='fillWordTeacher(${htmlJsArg(word)})'>单词老师</button>
        <button class="primary-button" onclick='saveLensWord(${htmlJsArg(word)})'>加入生词</button>
      </div>
    </article>
  `).join('');
}

async function saveLensWord(word) {
  if (!requireLogin()) return;
  try {
    await api(`/v1/users/${state.userId}/words`, {
      method: 'POST',
      body: JSON.stringify({
        word,
        meaning: '阅读透镜收藏，待补充释义',
        exampleSentence: $('readingText').value.split(/[.!?]/).find((sentence) => sentence.toLowerCase().includes(word.toLowerCase()))?.trim() || '',
      }),
    });
    showToast(`已收藏生词：${word}`);
    await loadWords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function fillWordTeacher(word) {
  $('wordText').value = word;
  $('wordMeaning').value = '';
  $('wordExample').value = `I want to use the word "${word}" in a natural sentence.`;
  teachWord();
  switchView('words');
}

function buildWordTeaching(word, meaning, example) {
  const clean = word.trim();
  return [
    `核心理解：${clean} 是当前需要主动掌握的表达，先结合语境理解，不要孤立死记。`,
    `中文释义：${meaning || '请结合阅读语境补充精确释义。'}`,
    `场景例句：${example || `Try to use "${clean}" in a sentence related to your daily life.`}`,
    '易错提醒：注意词性、固定搭配和中文直译问题。',
    `小测题：请用 ${clean} 造一个与你学习目标相关的英文句子。`,
  ].join('\n');
}

function teachWord() {
  const word = $('wordText').value.trim();
  if (!word) {
    showToast('请输入单词', 'error');
    return;
  }
  $('wordTeacherResult').className = 'result-card';
  $('wordTeacherResult').textContent = buildWordTeaching(word, $('wordMeaning').value.trim(), $('wordExample').value.trim());
}

function startWordGame() {
  const candidates = state.words.filter((word) => word.word && word.meaning).slice(0, 12);
  if (candidates.length < 2) {
    showToast('至少需要 2 个带释义的生词才能开始配对小游戏', 'error');
    return;
  }
  const question = candidates[Math.floor(Math.random() * candidates.length)];
  const options = shuffleArray([
    question,
    ...shuffleArray(candidates.filter((item) => item.id !== question.id)).slice(0, 3),
  ]);
  state.wordGame = {
    question,
    options,
    startedAt: Date.now(),
  };
  $('wordGameResult').className = 'result-card';
  $('wordGameResult').innerHTML = `
    <strong>配对题：</strong>请选择 “${escapeHtml(question.word)}” 的正确释义。<br /><br />
    <div class="button-row">
      ${options.map((option) => `<button class="secondary-button" onclick="answerWordGame(${option.id})">${escapeHtml(option.meaning)}</button>`).join('')}
    </div>
  `;
}

async function answerWordGame(selectedId) {
  if (!state.wordGame) return;
  const correct = Number(selectedId) === Number(state.wordGame.question.id);
  const duration = Math.round((Date.now() - state.wordGame.startedAt) / 1000);
  $('wordGameResult').className = 'result-card';
  $('wordGameResult').innerHTML = `
    <strong>${correct ? '答对了 ✅' : '答错了，再复习一次 💪'}</strong><br />
    单词：${escapeHtml(state.wordGame.question.word)}<br />
    正确释义：${escapeHtml(state.wordGame.question.meaning)}<br />
    用时：${duration} 秒<br />
    <button class="primary-button" onclick="startWordGame()">再来一题</button>
  `;
  if (state.userId && state.wordGame.question.id) {
    await reviewWord(state.wordGame.question.id, correct);
  }
}

function shuffleArray(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function speakText(text, rate = 0.9) {
  if (!text.trim()) {
    showToast('没有可朗读的文本', 'error');
    return;
  }
  if (!('speechSynthesis' in window)) {
    showToast('当前浏览器不支持语音朗读', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.rate = Number(rate || 0.9);
  window.speechSynthesis.speak(utterance);
}

function playEchoLoop() {
  const phrase = $('echoPhrase').value.trim();
  if (!phrase) {
    showToast('请输入跟读句子', 'error');
    return;
  }
  const repeat = Math.max(1, Math.min(10, Number($('echoRepeat').value || 3)));
  const rate = Number($('echoRate').value || 0.85);
  window.speechSynthesis?.cancel();
  for (let i = 0; i < repeat; i += 1) {
    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
  }
  $('echoStatus').className = 'result-card';
  $('echoStatus').textContent = `已播放 ${repeat} 次。建议：第 1 次听语调，第 2 次跟读，第 3 次录音对比。`;
  markEchoStage('blindListen');
}

function persistEchoProgress() {
  state.echoProgress.updatedAt = new Date().toISOString();
  localStorage.setItem('easitalk.echoProgress', JSON.stringify(state.echoProgress));
  renderEchoProgress();
}

function markEchoStage(stage) {
  if (!state.echoProgress.completed.includes(stage)) {
    state.echoProgress.completed.push(stage);
  }
  const order = ['blindListen', 'intensiveListen', 'shadowing', 'retell', 'review'];
  const next = order.find((item) => !state.echoProgress.completed.includes(item));
  state.echoProgress.current = next || 'review';
  persistEchoProgress();
}

function saveEchoRetell() {
  const retell = $('echoRetell').value.trim();
  if (!retell) {
    showToast('请先填写复述内容', 'error');
    return;
  }
  state.echoProgress.retellDraft = retell;
  markEchoStage('retell');
  $('echoResult').className = 'result-card';
  $('echoResult').innerHTML = `
    <strong>复述已保存：</strong><br />${escapeHtml(retell)}<br /><br />
    <strong>下一步：</strong>进入间隔复习。建议 6 小时后复听并再次复述。`;
  showToast('复述内容已保存');
}

function renderEchoProgress() {
  const stageLabels = {
    blindListen: '1 盲听',
    intensiveListen: '2 精听',
    shadowing: '3 跟读',
    retell: '4 复述',
    review: '5 复习',
  };
  document.querySelectorAll('.flow-step').forEach((button) => {
    const stage = button.dataset.stage;
    button.classList.toggle('done', state.echoProgress.completed.includes(stage));
    button.classList.toggle('active', state.echoProgress.current === stage);
    button.textContent = `${stageLabels[stage]}${state.echoProgress.completed.includes(stage) ? ' ✓' : ''}`;
  });
  if ($('echoRetell')) {
    $('echoRetell').value = state.echoProgress.retellDraft || $('echoRetell').value;
  }
}

async function startEchoRecording() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    showToast('当前浏览器不支持录音，请使用 Chrome/Edge 最新版', 'error');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.recordedChunks = [];
    state.recordedBlob = null;
    state.recorder = new MediaRecorder(stream);
    state.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) state.recordedChunks.push(event.data);
    };
    state.recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      state.recordedBlob = new Blob(state.recordedChunks, { type: 'audio/webm' });
      const preview = $('echoPreview');
      preview.src = URL.createObjectURL(state.recordedBlob);
      preview.hidden = false;
      $('echoStatus').className = 'result-card';
      $('echoStatus').textContent = '录音完成。可先播放预览，再点击“上传并评分”。';
    };
    state.recorder.start();
    $('startRecordBtn').disabled = true;
    $('stopRecordBtn').disabled = false;
    $('echoStatus').className = 'result-card';
    $('echoStatus').textContent = '正在录音，请跟读标准句。';
  } catch (error) {
    showToast(`无法开始录音：${error.message}`, 'error');
  }
}

function stopEchoRecording() {
  if (state.recorder && state.recorder.state !== 'inactive') {
    state.recorder.stop();
  }
  $('startRecordBtn').disabled = false;
  $('stopRecordBtn').disabled = true;
}

async function sendEchoRecording() {
  if (!requireLogin()) return;
  if (!state.recordedBlob) {
    showToast('请先录制跟读音频', 'error');
    return;
  }
  const btn = $('sendEchoBtn');
  setLoading(btn, true, '上传评分中...');
  try {
    const form = new FormData();
    form.append('file', state.recordedBlob, `echo-loop-${Date.now()}.webm`);
    form.append('purpose', 'echo_loop_recording');
    const asset = await api(`/v1/users/${state.userId}/audio-assets`, {
      method: 'POST',
      body: form,
    });
    const session = await api(`/v1/users/${state.userId}/speaking/chat`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: `echo-loop-${Date.now()}`,
        message: $('echoPhrase').value.trim(),
        audioAssetId: asset.id,
      }),
    });
    $('echoResult').className = 'result-card';
    $('echoResult').innerHTML = `
      <strong>音频资产 ID：</strong>${asset.id}<br />
      <strong>跟读句子：</strong>${escapeHtml(session.userText || $('echoPhrase').value)}<br />
      <strong>AI 反馈：</strong><br />${escapeHtml(session.aiReply || '-')}<br />
      <strong>发音评分：</strong>${escapeHtml(String(session.score ?? '-'))}<br />
      <strong>音频地址：</strong>${asset.publicUrl ? `<a href="${escapeAttr(asset.publicUrl)}" target="_blank" rel="noreferrer">${escapeHtml(asset.publicUrl)}</a>` : '-'}
    `;
    markEchoStage('shadowing');
    showToast('Echo Loop 跟读评分完成');
    await loadSpeaking();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function correctWriting() {
  if (!requireLogin()) return;
  const btn = $('correctWritingBtn');
  setLoading(btn, true, '批改中...');
  try {
    const result = await api(`/v1/users/${state.userId}/writing-submissions/correct`, {
      method: 'POST',
      body: JSON.stringify({
        title: $('writingTitle').value.trim(),
        content: $('writingContent').value.trim(),
      }),
    });
    renderWritingResult(result);
    showToast('写作批改完成');
    await loadWriting();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function loadWriting() {
  if (!requireLogin()) return;
  const result = await api(`/v1/users/${state.userId}/writing-submissions`);
  state.writing = result.items || [];
  renderWritingList();
}

function renderWritingResult(item) {
  const result = normalizeCorrection(item.correctionResult);
  $('writingResult').className = 'result-card';
  $('writingResult').innerHTML = `
    <strong>预估分数：</strong>${asText(item.bandScore)}<br />
    <strong>优化后文本：</strong><br />${escapeHtml(item.correctedContent || '-')}<br /><br />
    <strong>批改摘要：</strong><br />${escapeHtml(result.summary || '-')}<br /><br />
    <strong>知识点：</strong>${escapeHtml((result.knowledgePoints || []).join('、') || '-')}
  `;
}

function normalizeCorrection(value) {
  if (!value) return {};
  if (typeof value === 'string') return safeJson(value, { summary: value });
  return value;
}

function renderWritingList() {
  $('statWriting').textContent = String(state.writing.length);
  const target = $('writingList');
  if (!state.writing.length) {
    target.className = 'list empty';
    target.textContent = '暂无写作记录。';
    return;
  }
  target.className = 'list';
  target.innerHTML = state.writing.map((item) => `
    <article class="item-card">
      <h4>${escapeHtml(item.title || 'Untitled')}</h4>
      <div class="item-meta">
        <span class="badge">${escapeHtml(item.status || 'corrected')}</span>
        <span class="badge success">Band ${asText(item.bandScore)}</span>
      </div>
      <p>${escapeHtml((item.correctedContent || item.originalContent || '').slice(0, 180))}${(item.correctedContent || '').length > 180 ? '...' : ''}</p>
    </article>
  `).join('');
}

async function sendSpeaking() {
  if (!requireLogin()) return;
  const btn = $('sendSpeakingBtn');
  setLoading(btn, true, 'AI 回复中...');
  try {
    const audioAssetId = Number($('speakingAudioAssetId').value || 0);
    const body = {
      sessionId: $('speakingSessionId').value.trim() || `web-speaking-${Date.now()}`,
      message: $('speakingMessage').value.trim(),
    };
    if (audioAssetId > 0) body.audioAssetId = audioAssetId;
    const result = await api(`/v1/users/${state.userId}/speaking/chat`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    renderSpeakingResult(result);
    showToast('口语陪练完成');
    await loadSpeaking();
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function loadSpeaking() {
  if (!requireLogin()) return;
  const result = await api(`/v1/users/${state.userId}/speaking-sessions`);
  state.speaking = result.items || [];
  renderSpeakingList();
}

function renderSpeakingResult(item) {
  const score = item.score ?? parseMaybeJson(item.pronunciationResult)?.overallScore ?? '-';
  $('speakingResult').className = 'result-card';
  $('speakingResult').innerHTML = `
    <strong>你的表达：</strong>${escapeHtml(item.userText || '-')}<br /><br />
    <strong>AI 回复：</strong><br />${escapeHtml(item.aiReply || '-')}<br /><br />
    <strong>发音评分：</strong>${escapeHtml(String(score))}
  `;
}

function parseMaybeJson(value) {
  if (!value) return {};
  if (typeof value === 'string') return safeJson(value, {});
  return value;
}

function renderSpeakingList() {
  $('statSpeaking').textContent = String(state.speaking.length);
  const target = $('speakingList');
  if (!state.speaking.length) {
    target.className = 'list empty';
    target.textContent = '暂无口语练习记录。';
    return;
  }
  target.className = 'list';
  target.innerHTML = state.speaking.map((item) => `
    <article class="item-card">
      <h4>${escapeHtml(item.sessionId || 'speaking-session')}</h4>
      <div class="item-meta">
        <span class="badge success">Score ${asText(item.score)}</span>
        <span class="badge">${escapeHtml(item.status || 'completed')}</span>
      </div>
      <p><strong>你：</strong>${escapeHtml(item.userText || '-')}</p>
      <p><strong>AI：</strong>${escapeHtml((item.aiReply || '-').slice(0, 180))}</p>
    </article>
  `).join('');
}

async function uploadAudio() {
  if (!requireLogin()) return;
  const file = $('audioFile').files[0];
  if (!file) {
    showToast('请选择音频文件', 'error');
    return;
  }
  const btn = $('uploadAudioBtn');
  setLoading(btn, true, '上传中...');
  try {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', $('audioPurpose').value.trim() || 'speaking_recording');
    const result = await api(`/v1/users/${state.userId}/audio-assets`, {
      method: 'POST',
      body: form,
    });
    $('audioResult').className = 'result-card';
    $('audioResult').innerHTML = `
      <strong>上传成功，音频资产 ID：</strong>${result.id}<br />
      <strong>文件：</strong>${escapeHtml(result.originalFilename || file.name)}<br />
      <strong>对象：</strong>${escapeHtml(result.objectKey || '-')}<br />
      <strong>访问地址：</strong>${result.publicUrl ? `<a href="${escapeAttr(result.publicUrl)}" target="_blank" rel="noreferrer">${escapeHtml(result.publicUrl)}</a>` : '-'}<br />
      <button class="secondary-button" onclick="useAudioAsset(${result.id})">用于口语陪练</button>
    `;
    showToast('音频已上传到 MinIO');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    setLoading(btn, false);
  }
}

function useAudioAsset(id) {
  $('speakingAudioAssetId').value = id;
  switchView('speaking');
  showToast(`已填入口语音频资产 ID：${id}`);
}

async function refreshAll() {
  await checkHealth();
  updateAuthUI();
  if (!state.userId) {
    renderAll();
    return;
  }
  const jobs = [
    loadProfile().catch((e) => showToast(`档案加载失败：${e.message}`, 'error')),
    loadTasks().catch((e) => showToast(`任务加载失败：${e.message}`, 'error')),
    loadWords().catch((e) => showToast(`生词加载失败：${e.message}`, 'error')),
    loadWriting().catch((e) => showToast(`写作加载失败：${e.message}`, 'error')),
    loadSpeaking().catch((e) => showToast(`口语加载失败：${e.message}`, 'error')),
  ];
  await Promise.all(jobs);
  renderAll();
}

function renderAll() {
  renderProfileSummary();
  renderTasks();
  renderWords();
  renderWritingList();
  renderSpeakingList();
  renderFamiliarWordsPanel();
  renderEchoProgress();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function htmlJsArg(value) {
  return escapeAttr(JSON.stringify(String(value)));
}

function bindEvents() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => switchView(item.dataset.view));
  });
  $('taskDate').value = today();
  $('loginBtn').addEventListener('click', login);
  $('registerBtn').addEventListener('click', register);
  $('logoutBtn').addEventListener('click', logout);
  $('refreshAllBtn').addEventListener('click', refreshAll);
  $('saveProfileBtn').addEventListener('click', saveProfile);
  $('loadTasksBtn').addEventListener('click', () => loadTasks().catch((e) => showToast(e.message, 'error')));
  $('generatePlanBtn').addEventListener('click', () => generatePlan('generatePlanBtn'));
  $('quickGeneratePlanBtn').addEventListener('click', () => generatePlan('quickGeneratePlanBtn'));
  $('loadReadingSampleBtn').addEventListener('click', loadReadingSample);
  $('analyzeSelectionBtn').addEventListener('click', analyzeReadingSelection);
  $('extractWordsBtn').addEventListener('click', extractReadingWords);
  $('markFamiliarBtn').addEventListener('click', markSelectedAsFamiliar);
  $('speakReadingBtn').addEventListener('click', () => speakText($('readingText').value, 0.9));
  $('loadWordsBtn').addEventListener('click', () => loadWords().catch((e) => showToast(e.message, 'error')));
  $('addWordBtn').addEventListener('click', addWord);
  $('teachWordBtn').addEventListener('click', teachWord);
  $('speakWordBtn').addEventListener('click', () => speakText($('wordText').value, 0.85));
  $('startWordGameBtn').addEventListener('click', startWordGame);
  $('correctWritingBtn').addEventListener('click', correctWriting);
  $('loadWritingBtn').addEventListener('click', () => loadWriting().catch((e) => showToast(e.message, 'error')));
  $('sendSpeakingBtn').addEventListener('click', sendSpeaking);
  $('loadSpeakingBtn').addEventListener('click', () => loadSpeaking().catch((e) => showToast(e.message, 'error')));
  $('playEchoBtn').addEventListener('click', playEchoLoop);
  $('startRecordBtn').addEventListener('click', startEchoRecording);
  $('stopRecordBtn').addEventListener('click', stopEchoRecording);
  $('sendEchoBtn').addEventListener('click', sendEchoRecording);
  $('saveRetellBtn').addEventListener('click', saveEchoRetell);
  document.querySelectorAll('.flow-step').forEach((button) => {
    button.addEventListener('click', () => markEchoStage(button.dataset.stage));
  });
  $('uploadAudioBtn').addEventListener('click', uploadAudio);
}

window.completeTask = completeTask;
window.reviewWord = reviewWord;
window.deleteWord = deleteWord;
window.useAudioAsset = useAudioAsset;
window.saveLensWord = saveLensWord;
window.fillWordTeacher = fillWordTeacher;
window.removeFamiliarWord = removeFamiliarWord;
window.startWordGame = startWordGame;
window.answerWordGame = answerWordGame;

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  updateAuthUI();
  renderAll();
  await refreshAll();
});

