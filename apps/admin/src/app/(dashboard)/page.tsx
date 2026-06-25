'use client';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../../lib/api';

export default function DashboardPage() {
  const { data: overview } = useQuery({ queryKey: ['admin-overview'], queryFn: dashboardApi.overview });
  const { data: usage } = useQuery({ queryKey: ['admin-usage', 7], queryFn: () => dashboardApi.usage(7) });

  const stats = overview?.stats;
  const topProviders = overview?.topProviders ?? [];
  const recentErrors = overview?.recentErrors ?? [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">概览仪表盘</h1>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-5 mb-8">
        <StatCard icon="👥" label="注册用户" value={stats?.totalUsers ?? '-'} color="indigo" />
        <StatCard icon="🤖" label="活跃提供商" value={stats?.activeProviders ?? '-'} color="green" />
        <StatCard icon="📡" label="今日 API 调用" value={stats?.today?.totalRequests ?? 0} color="blue" />
        <StatCard icon="⚡" label="今日平均延迟" value={stats?.today?.avgLatency ? `${Math.round(stats.today.avgLatency)}ms` : '-'} color="yellow" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 提供商调用排行 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">🤖 提供商调用排行</h2>
          <div className="space-y-3">
            {topProviders.length === 0 && <p className="text-gray-400 text-sm">暂无数据</p>}
            {topProviders.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ProviderBadge provider={p.provider} />
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-gray-400">{TIER_LABELS[p.tier]} · {p.isDefault ? '默认' : ''}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-700">{p.totalRequests?.toLocaleString() ?? 0}</div>
                  <div className="text-xs text-gray-400">次调用</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 最近错误 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4">🚨 最近 API 错误</h2>
          <div className="space-y-2">
            {recentErrors.length === 0 && <p className="text-green-600 text-sm">✓ 最近无错误</p>}
            {recentErrors.map((e: any) => (
              <div key={e.id} className="bg-red-50 rounded-xl px-3 py-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-red-700">{e.taskType ?? 'unknown'}</span>
                  <span className="text-red-400 text-xs">{e.errorCode}</span>
                </div>
                <div className="text-red-500 text-xs mt-0.5">{new Date(e.createdAt).toLocaleString('zh-CN')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 今日 Token 消耗 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 col-span-2">
          <h2 className="font-bold text-gray-800 mb-4">📊 近 7 天调用统计</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b">
                  <th className="text-left pb-2">日期</th>
                  <th className="text-left pb-2">任务类型</th>
                  <th className="text-right pb-2">调用次数</th>
                  <th className="text-right pb-2">输入 Token</th>
                  <th className="text-right pb-2">输出 Token</th>
                  <th className="text-right pb-2">错误数</th>
                </tr>
              </thead>
              <tbody>
                {(usage ?? []).slice(0, 15).map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-gray-500">{row.date}</td>
                    <td className="py-2">
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {row.taskType ?? 'general'}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">{(row.totalRequests ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-blue-600">{(row.totalTokensIn ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-right font-mono text-green-600">{(row.totalTokensOut ?? 0).toLocaleString()}</td>
                    <td className="py-2 text-right">
                      {row.errors > 0
                        ? <span className="text-red-500 font-bold">{row.errors}</span>
                        : <span className="text-gray-300">0</span>
                      }
                    </td>
                  </tr>
                ))}
                {(usage ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">暂无数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: any; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    green:  'bg-green-50 text-green-700',
    blue:   'bg-blue-50 text-blue-700',
    yellow: 'bg-yellow-50 text-yellow-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-lg mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function ProviderBadge({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    openai:    'bg-green-100 text-green-700',
    deepseek:  'bg-blue-100 text-blue-700',
    gemini:    'bg-purple-100 text-purple-700',
    anthropic: 'bg-orange-100 text-orange-700',
    newapi:    'bg-pink-100 text-pink-700',
    ollama:    'bg-gray-100 text-gray-700',
    custom:    'bg-yellow-100 text-yellow-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${colors[provider] ?? 'bg-gray-100 text-gray-600'}`}>
      {provider}
    </span>
  );
}

const TIER_LABELS: Record<string, string> = { high: '高质量', fast: '高速' };

