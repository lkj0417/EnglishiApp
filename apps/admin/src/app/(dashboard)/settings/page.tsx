'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../../../../lib/api';

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  ai:         { label: 'AI 模型配置', icon: '🤖' },
  learning:   { label: '教学参数', icon: '📚' },
  assessment: { label: '测评配置', icon: '🎯' },
  content:    { label: '内容生成', icon: '✍️' },
  system:     { label: '系统配置', icon: '⚙️' },
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string[]>([]);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: settingsApi.list,
  });

  const updateMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.update(key, value),
    onSuccess: (_, vars) => {
      setSaved(prev => [...prev, vars.key]);
      setTimeout(() => setSaved(prev => prev.filter(k => k !== vars.key)), 2000);
      qc.invalidateQueries({ queryKey: ['admin-settings'] });
    },
  });

  const grouped: Record<string, any[]> = {};
  for (const s of settings) {
    if (!grouped[s.category]) grouped[s.category] = [];
    grouped[s.category].push(s);
  }

  const handleSave = (key: string) => {
    const value = editValues[key];
    if (value === undefined) return;
    updateMutation.mutate({ key, value });
  };

  const getValue = (s: any) => editValues[s.key] !== undefined ? editValues[s.key] : s.value;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">⚙️ 全局配置</h1>
        <p className="text-gray-500 text-sm mt-1">修改后即时生效，无需重启服务</p>
      </div>

      {isLoading && <div className="text-gray-400">加载中...</div>}

      {Object.entries(grouped).map(([category, items]) => {
        const meta = CATEGORY_LABELS[category] ?? { label: category, icon: '🔧' };
        return (
          <div key={category} className="bg-white rounded-2xl border border-gray-200 mb-6 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <h2 className="font-bold text-gray-800">
                <span className="mr-2">{meta.icon}</span>{meta.label}
              </h2>
            </div>

            <div className="divide-y divide-gray-100">
              {items.map((s: any) => (
                <div key={s.key} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900 text-sm">{s.label || s.key}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">{s.key}</span>
                        {s.isSecret && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">敏感</span>}
                      </div>
                      {s.description && <p className="text-xs text-gray-400 mb-2">{s.description}</p>}
                    </div>

                    <div className="flex items-center gap-2 min-w-[280px]">
                      {s.valueType === 'boolean' ? (
                        <select
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-1"
                          value={getValue(s)}
                          onChange={e => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                        >
                          <option value="true">✅ 开启 (true)</option>
                          <option value="false">❌ 关闭 (false)</option>
                        </select>
                      ) : (
                        <input
                          type={s.isSecret ? 'password' : 'text'}
                          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 flex-1 font-mono"
                          value={s.isSecret && editValues[s.key] === undefined ? '••••••••' : getValue(s)}
                          onChange={e => setEditValues(prev => ({ ...prev, [s.key]: e.target.value }))}
                          onFocus={() => {
                            if (s.isSecret && editValues[s.key] === undefined) {
                              setEditValues(prev => ({ ...prev, [s.key]: '' }));
                            }
                          }}
                        />
                      )}

                      <button
                        onClick={() => handleSave(s.key)}
                        disabled={editValues[s.key] === undefined || updateMutation.isPending}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                          saved.includes(s.key)
                            ? 'bg-green-100 text-green-700'
                            : editValues[s.key] !== undefined
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {saved.includes(s.key) ? '✓ 已保存' : '保存'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

