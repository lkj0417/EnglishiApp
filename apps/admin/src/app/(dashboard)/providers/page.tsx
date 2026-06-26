'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { providerApi } from '../../../lib/api';

const PROVIDERS = [
  { id: 'openai',       label: 'OpenAI',        defaultUrl: 'https://api.openai.com/v1',              models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'deepseek',     label: 'DeepSeek',       defaultUrl: 'https://api.deepseek.com/v1',            models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'] },
  { id: 'gemini',       label: 'Google Gemini',  defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  { id: 'anthropic',    label: 'Anthropic',      defaultUrl: 'https://api.anthropic.com/v1',           models: ['claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'] },
  { id: 'newapi',       label: 'New API / One API', defaultUrl: 'https://api.newapi.ge/v1',           models: ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-chat'] },
  { id: 'ollama',       label: 'Ollama (本地)',   defaultUrl: 'http://localhost:11434/v1',              models: ['llama3', 'mistral', 'qwen2'] },
  { id: 'azure_openai', label: 'Azure OpenAI',   defaultUrl: '',                                       models: ['gpt-4o', 'gpt-4-turbo'] },
  { id: 'custom',       label: '自定义接口',       defaultUrl: '',                                      models: [] },
];

const TIER_OPTIONS = [
  { value: 'high', label: '🏆 高质量（用于写作精批/口语报告）' },
  { value: 'fast', label: '⚡ 高速（用于阅读生成/词汇/语法）' },
];

const EMPTY_FORM = {
  name: '', provider: 'openai', baseUrl: '', apiKey: '',
  modelId: 'gpt-4o', tier: 'high', isActive: true, isDefault: false,
  priority: '1', maxTokens: '', temperature: '0.7', requestsPerMin: '', notes: '',
};

export default function ProvidersPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['admin-providers'],
    queryFn: providerApi.list,
  });

  const createMutation = useMutation({
    mutationFn: providerApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers'] }); setShowForm(false); setForm({ ...EMPTY_FORM }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: any) => providerApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-providers'] }); setShowForm(false); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: providerApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-providers'] }),
  });

  const testMutation = useMutation({
    mutationFn: providerApi.test,
    onSuccess: (result: any, id: string) => setTestResults(prev => ({ ...prev, [id]: result.data })),
    onError: (err: any, id: string) => setTestResults(prev => ({ ...prev, [id]: { status: 'failed', error: err.message } })),
  });

  const handleProviderChange = (providerId: string) => {
    const p = PROVIDERS.find(x => x.id === providerId);
    setForm(prev => ({
      ...prev,
      provider: providerId,
      baseUrl: p?.defaultUrl ?? '',
      modelId: p?.models[0] ?? '',
      name: prev.name || `${p?.label ?? providerId} ${prev.tier === 'high' ? '高质量' : '高速'}`,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      maxTokens: form.maxTokens ? Number(form.maxTokens) : undefined,
      temperature: Number(form.temperature),
      requestsPerMin: form.requestsPerMin ? Number(form.requestsPerMin) : undefined,
      priority: Number(form.priority),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (p: any) => {
    setForm({
      name: p.name, provider: p.provider, baseUrl: p.baseUrl ?? '',
      apiKey: '', // 不回显
      modelId: p.modelId, tier: p.tier,
      isActive: p.isActive, isDefault: p.isDefault,
      priority: String(p.priority ?? 1),
      maxTokens: p.maxTokens ?? '', temperature: p.temperature ?? '0.7',
      requestsPerMin: p.requestsPerMin ?? '', notes: p.notes ?? '',
    });
    setEditingId(p.id);
    setShowForm(true);
  };

  const providersByTier = {
    high: providers.filter((p: any) => p.tier === 'high'),
    fast: providers.filter((p: any) => p.tier === 'fast'),
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🤖 AI 提供商管理</h1>
          <p className="text-gray-500 text-sm mt-1">配置多个 AI 接口，系统自动选择当前默认提供商</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition"
        >
          + 添加提供商
        </button>
      </div>

      {/* 提供商列表（按 tier 分组） */}
      {(['high', 'fast'] as const).map(tier => (
        <div key={tier} className="mb-8">
          <h2 className="font-bold text-gray-700 mb-3">
            {tier === 'high' ? '🏆 高质量层（复杂任务：写作精批、口语报告）' : '⚡ 高速层（高频任务：阅读生成、词汇、语法）'}
          </h2>
          <div className="space-y-3">
            {providersByTier[tier].length === 0 && (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-400">
                暂无 {tier === 'high' ? '高质量' : '高速'} 层提供商，请添加
              </div>
            )}
            {providersByTier[tier].map((p: any) => (
              <ProviderCard
                key={p.id}
                provider={p}
                testResult={testResults[p.id]}
                onEdit={() => handleEdit(p)}
                onDelete={() => deleteMutation.mutate(p.id)}
                onTest={() => testMutation.mutate(p.id)}
                testLoading={testMutation.isPending && testMutation.variables === p.id}
              />
            ))}
          </div>
        </div>
      ))}

      {/* 添加/编辑 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-6">{editingId ? '编辑提供商' : '添加 AI 提供商'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 提供商类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">提供商类型</label>
                <div className="grid grid-cols-4 gap-2">
                  {PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleProviderChange(p.id)}
                      className={`px-3 py-2 rounded-xl border text-sm font-medium transition ${
                        form.provider === p.id
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="显示名称" required>
                  <input className={inputCls} value={form.name} onChange={e => setForm(s => ({ ...s, name: e.target.value }))} required />
                </Field>
                <Field label="任务层级" required>
                  <select className={inputCls} value={form.tier} onChange={e => setForm(s => ({ ...s, tier: e.target.value }))}>
                    {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="API Base URL（留空使用默认）">
                <input className={inputCls} value={form.baseUrl}
                  onChange={e => setForm(s => ({ ...s, baseUrl: e.target.value }))}
                  placeholder={PROVIDERS.find(p => p.id === form.provider)?.defaultUrl} />
              </Field>

              <Field label={editingId ? 'API Key（留空不修改）' : 'API Key'} required={!editingId}>
                <input className={inputCls} type="password" value={form.apiKey}
                  onChange={e => setForm(s => ({ ...s, apiKey: e.target.value }))}
                  placeholder={editingId ? '留空则保持原 Key 不变' : 'sk-...'} />
              </Field>

              <Field label="模型 ID" required>
                <div className="flex gap-2">
                  {(PROVIDERS.find(p => p.id === form.provider)?.models ?? []).length > 0 ? (
                    <select className={inputCls} value={form.modelId}
                      onChange={e => setForm(s => ({ ...s, modelId: e.target.value }))}>
                      {PROVIDERS.find(p => p.id === form.provider)!.models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <input className={inputCls} value={form.modelId}
                      onChange={e => setForm(s => ({ ...s, modelId: e.target.value }))}
                      placeholder="模型 ID，如 gpt-4o" required />
                  )}
                </div>
              </Field>

              <div className="grid grid-cols-3 gap-4">
                <Field label="优先级（数字越小越优先）">
                  <input className={inputCls} type="number" min={1} max={100} value={form.priority}
                    onChange={e => setForm(s => ({ ...s, priority: e.target.value }))} />
                </Field>
                <Field label="Temperature（0-2）">
                  <input className={inputCls} type="number" step="0.1" min={0} max={2} value={form.temperature}
                    onChange={e => setForm(s => ({ ...s, temperature: e.target.value }))} />
                </Field>
                <Field label="每分钟请求上限">
                  <input className={inputCls} type="number" min={1} value={form.requestsPerMin}
                    onChange={e => setForm(s => ({ ...s, requestsPerMin: e.target.value }))}
                    placeholder="不限填空" />
                </Field>
              </div>

              <Field label="Max Tokens（生成上限）">
                <input className={inputCls} type="number" min={100} value={form.maxTokens}
                  onChange={e => setForm(s => ({ ...s, maxTokens: e.target.value }))}
                  placeholder="不限填空" />
              </Field>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isActive}
                    onChange={e => setForm(s => ({ ...s, isActive: e.target.checked }))}
                    className="rounded" />
                  <span>启用此提供商</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={form.isDefault}
                    onChange={e => setForm(s => ({ ...s, isDefault: e.target.checked }))}
                    className="rounded" />
                  <span>设为该层默认提供商</span>
                </label>
              </div>

              <Field label="备注">
                <textarea className={inputCls} rows={2} value={form.notes}
                  onChange={e => setForm(s => ({ ...s, notes: e.target.value }))}
                  placeholder="此提供商的用途说明..." />
              </Field>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-300 transition">
                  {createMutation.isPending || updateMutation.isPending ? '保存中...' : (editingId ? '保存修改' : '添加提供商')}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition">
                  取消
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProviderCard({ provider: p, testResult, onEdit, onDelete, onTest, testLoading }: any) {
  return (
    <div className={`bg-white rounded-xl border ${p.isDefault ? 'border-indigo-300 shadow-sm shadow-indigo-100' : 'border-gray-200'} p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${p.isActive ? 'bg-green-400' : 'bg-gray-300'}`} />
            <ProviderBadge provider={p.provider} />
          </div>
          <div>
            <div className="font-bold text-gray-900 flex items-center gap-2">
              {p.name}
              {p.isDefault && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">默认</span>}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {p.modelId} · {p.apiKeyHint} · 优先级 {p.priority}
              {p.lastUsedAt && ` · 最近使用 ${new Date(p.lastUsedAt).toLocaleDateString('zh-CN')}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 测试结果 */}
          {testResult && (
            <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
              testResult.status === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {testResult.status === 'ok' ? `✓ ${testResult.latency}ms` : `✗ ${testResult.error?.slice(0, 30)}`}
            </span>
          )}
          <button onClick={onTest} disabled={testLoading}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg font-medium transition">
            {testLoading ? '测试中...' : '测试连接'}
          </button>
          <button onClick={onEdit}
            className="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg font-medium transition">
            编辑
          </button>
          <button onClick={onDelete}
            className="text-xs bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-medium transition">
            停用
          </button>
        </div>
      </div>

      {/* 统计条 */}
      <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-3 gap-4 text-xs text-gray-500">
        <span>📡 总调用 {(p.totalRequests ?? 0).toLocaleString()} 次</span>
        <span>⬆️ 输入 {((p.totalTokensIn ?? 0) / 1000).toFixed(1)}K token</span>
        <span>⬇️ 输出 {((p.totalTokensOut ?? 0) / 1000).toFixed(1)}K token</span>
      </div>

      {p.notes && <div className="mt-2 text-xs text-gray-400 italic">{p.notes}</div>}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    openai: 'bg-green-100 text-green-700', deepseek: 'bg-blue-100 text-blue-700',
    gemini: 'bg-purple-100 text-purple-700', anthropic: 'bg-orange-100 text-orange-700',
    newapi: 'bg-pink-100 text-pink-700', ollama: 'bg-gray-100 text-gray-700',
    azure_openai: 'bg-sky-100 text-sky-700', custom: 'bg-yellow-100 text-yellow-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[provider] ?? 'bg-gray-100 text-gray-600'}`}>{provider}</span>;
}

const inputCls = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

