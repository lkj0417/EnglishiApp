const state = {
  token: localStorage.getItem('easitalk.token') || '',
  userId: Number(localStorage.getItem('easitalk.userId') || 0),
  user: safeJson(localStorage.getItem('easitalk.user'), null),
  profile: null,
  tasks: [],
  words: [],
  writing: [],
  speaking: [],
};

const pageTitles = {
  dashboard: '学习总览',
  profile: '学习档案',
  tasks: '每日任务',
  words: '生词本',
  writing: '写作批改',
  speaking: '口语陪练',
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
  target.innerHTML = tasks.map((task) => `
    <article class="item-card">
      <h4>${escapeHtml(task.title || '学习任务')}</h4>
      <div class="item-meta">
        <span class="badge">${escapeHtml(task.taskType || 'task')}</span>
        <span class="badge ${task.status === 'completed' ? 'success' : 'warn'}">${escapeHtml(task.status || 'pending')}</span>
        <span class="badge">${task.estimatedMinutes || 0} 分钟</span>
      </div>
      ${task.status === 'completed' ? '<p>已完成，继续保持。</p>' : `<button class="secondary-button" onclick="completeTask(${task.id})">标记完成</button>`}
    </article>
  `).join('');
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
  $('loadWordsBtn').addEventListener('click', () => loadWords().catch((e) => showToast(e.message, 'error')));
  $('addWordBtn').addEventListener('click', addWord);
  $('correctWritingBtn').addEventListener('click', correctWriting);
  $('loadWritingBtn').addEventListener('click', () => loadWriting().catch((e) => showToast(e.message, 'error')));
  $('sendSpeakingBtn').addEventListener('click', sendSpeaking);
  $('loadSpeakingBtn').addEventListener('click', () => loadSpeaking().catch((e) => showToast(e.message, 'error')));
  $('uploadAudioBtn').addEventListener('click', uploadAudio);
}

window.completeTask = completeTask;
window.reviewWord = reviewWord;
window.deleteWord = deleteWord;
window.useAudioAsset = useAudioAsset;

document.addEventListener('DOMContentLoaded', async () => {
  bindEvents();
  updateAuthUI();
  renderAll();
  await refreshAll();
});

