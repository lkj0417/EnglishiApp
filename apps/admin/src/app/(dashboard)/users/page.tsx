'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../../lib/api';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  student:     { label: '学员', color: 'bg-gray-100 text-gray-600' },
  admin:       { label: '管理员', color: 'bg-blue-100 text-blue-700' },
  super_admin: { label: '超级管理员', color: 'bg-purple-100 text-purple-700' },
};

export default function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState('');

  const { data: result, isLoading } = useQuery({
    queryKey: ['admin-users', page, roleFilter],
    queryFn: () => usersApi.list({ page, limit: 20, role: roleFilter || undefined }),
  });

  const users = result?.data ?? [];
  const total = result?.meta?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => usersApi.updateRole(id, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">👥 用户管理</h1>
          <p className="text-gray-500 text-sm mt-1">共 {total} 名用户</p>
        </div>
        <select
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
        >
          <option value="">全部角色</option>
          <option value="student">学员</option>
          <option value="admin">管理员</option>
          <option value="super_admin">超级管理员</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['用户', '邮箱', '角色', '已引导', '注册时间', '最近活跃', '操作'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">加载中...</td></tr>
            )}
            {users.map((u: any) => {
              const roleMeta = ROLE_LABELS[u.role] ?? ROLE_LABELS.student;
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                        {u.displayName?.[0] ?? '?'}
                      </div>
                      <span className="font-medium text-gray-900">{u.displayName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleMeta.color}`}>{roleMeta.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={u.onboardingCompleted ? 'text-green-600' : 'text-gray-400'}>
                      {u.onboardingCompleted ? '✓' : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString('zh-CN') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
                      value={u.role}
                      onChange={e => roleMutation.mutate({ id: u.id, role: e.target.value })}
                    >
                      <option value="student">学员</option>
                      <option value="admin">管理员</option>
                      <option value="super_admin">超级管理员</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">第 {page} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">上一页</button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1 rounded-lg border border-gray-200 text-sm disabled:opacity-40 hover:bg-gray-50">下一页</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

