'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promptApi } from '../../../lib/api';

const ENGINES = ['ReadingEngine', 'ListeningEngine', 'SpeakingExaminer', 'WritingCritic', 'VocabEngine', 'GrammarEngine'];

export default function PromptsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ engineName: 'ReadingEngine', version: '', tier: 'fast', systemPrompt: '', userPromptTemplate: '', notes: '' });

  const { data: templates = [] } = useQuery<any[]>({ queryKey: ['admin-prompts'], queryFn: promptApi.list });
  const { data: detail } = useQuery<any>({ queryKey: ['admin-prompt', selectedId], queryFn: () => promptApi.get(selectedId!), enabled: !!selectedId });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => promptApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-prompts'] }); setShowCreate(false); },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => promptApi.activate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-prompts'] }),
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📝 Prompt 模板管理</h1>
          <p className="text-gray-500 text-sm mt-1">版本化管理所有 AI 引擎的 Prompt，一键切换生产版本</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition">
          + 新建模板版本
        </button>
      </div>

      <div className="flex gap-6">
        {/* 左侧列表 */}
        <div className="w-72 shrink-0">
          {ENGINES.map(engine => {
            const engineTemplates = templates.filter((t: any) => t.engineName === engine);
            return (
              <div key={engine} className="mb-4">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">{engine}</div>
                {engineTemplates.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 text-sm transition ${
                      selectedId === t.id ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-gray-500">v{t.version}</span>
                      <div className="flex gap-1">
                        {t.isCurrent && <span className="bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">生产中</span>}
                        {t.abTestGroup && <span className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">A/B</span>}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{new Date(t.createdAt).toLocaleDateString('zh-CN')}</div>
                    {t.cqvPassRate && <div className="text-xs text-indigo-500">CQV {t.cqvPassRate}%</div>}
                  </button>
                ))}
                {engineTemplates.length === 0 && (
                  <div className="text-xs text-gray-300 px-3 py-2">暂无模板</div>
                )}
              </div>
            );
          })}
        </div>

        {/* 右侧详情 */}
        <div className="flex-1">
          {detail ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-lg font-bold">{detail.engineName} <span className="text-gray-400 font-mono text-sm">v{detail.version}</span></h3>
                  <div className="flex gap-2 mt-2">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{detail.tier === 'high' ? '高质量层' : '高速层'}</span>
                    {detail.isCurrent && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">✓ 当前生产版本</span>}
                    {detail.isActive && !detail.isCurrent && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">已激活</span>}
                  </div>
                </div>
                {!detail.isCurrent && (
                  <button
                    onClick={() => activateMutation.mutate(detail.id)}
                    disabled={activateMutation.isPending}
                    className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 disabled:bg-green-300 transition"
                  >
                    {activateMutation.isPending ? '切换中...' : '设为生产版本'}
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">System Prompt</label>
                  <pre className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto border">
                    {detail.systemPrompt}
                  </pre>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">User Prompt 模板</label>
                  <pre className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap font-mono max-h-64 overflow-y-auto border">
                    {detail.userPromptTemplate}
                  </pre>
                </div>
                {detail.notes && (
                  <div className="bg-yellow-50 rounded-xl p-4 text-sm text-yellow-800">
                    📝 {detail.notes}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center text-gray-400">
              选择左侧模板版本查看详情
            </div>
          )}
        </div>
      </div>

      {/* 新建模板弹窗 */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-6">新建 Prompt 模板版本</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">引擎名称</label>
                  <select className={inputCls} value={form.engineName} onChange={e => setForm(s => ({ ...s, engineName: e.target.value }))}>
                    {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">版本号</label>
                  <input className={inputCls} value={form.version} onChange={e => setForm(s => ({ ...s, version: e.target.value }))} placeholder="如 2.4" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">任务层级</label>
                  <select className={inputCls} value={form.tier} onChange={e => setForm(s => ({ ...s, tier: e.target.value }))}>
                    <option value="fast">高速层</option>
                    <option value="high">高质量层</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">System Prompt</label>
                <textarea className={inputCls} rows={8} value={form.systemPrompt} onChange={e => setForm(s => ({ ...s, systemPrompt: e.target.value }))} placeholder="你是一名专业的..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">User Prompt 模板（用 [变量名] 表示占位符）</label>
                <textarea className={inputCls} rows={8} value={form.userPromptTemplate} onChange={e => setForm(s => ({ ...s, userPromptTemplate: e.target.value }))} placeholder="生成一篇关于 [TOPIC] 的文章..." />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">备注（可选）</label>
                <input className={inputCls} value={form.notes} onChange={e => setForm(s => ({ ...s, notes: e.target.value }))} placeholder="此版本的主要改动..." />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => createMutation.mutate(form)}
                  disabled={!form.version || !form.systemPrompt || createMutation.isPending}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 disabled:bg-indigo-300 transition"
                >
                  {createMutation.isPending ? '创建中...' : '创建模板（草稿）'}
                </button>
                <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

