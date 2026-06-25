'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard',          icon: '📊', label: '概览仪表盘' },
  { href: '/dashboard/providers', icon: '🤖', label: 'AI 提供商' },
  { href: '/dashboard/settings',  icon: '⚙️', label: '全局配置' },
  { href: '/dashboard/prompts',   icon: '📝', label: 'Prompt 管理' },
  { href: '/dashboard/users',     icon: '👥', label: '用户管理' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const user = localStorage.getItem('admin_user');
    if (!token) { router.replace('/login'); return; }
    if (user) setAdminUser(JSON.parse(user));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.replace('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* 侧边栏 */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎓</span>
            <div>
              <div className="font-bold text-gray-900 text-sm">EnglishiApp</div>
              <div className="text-xs text-gray-400">管理控制台</div>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100',
              )}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* 底部用户信息 */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
              {adminUser?.displayName?.[0] ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{adminUser?.displayName ?? 'Admin'}</div>
              <div className="text-xs text-gray-400">{adminUser?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-gray-400 hover:text-red-500 transition-colors py-1 px-2 rounded"
          >
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

