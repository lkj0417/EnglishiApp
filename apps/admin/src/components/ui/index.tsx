import React from 'react';

// ── Reusable UI primitives for admin dashboard ──────────────────────────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
      <div>
        <h3 className="font-bold text-gray-900">{title}</h3>
        {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function StatCard({
  label, value, unit, icon, trend, trendLabel, color = 'indigo',
}: {
  label: string; value: string | number; unit?: string; icon: string;
  trend?: 'up' | 'down' | 'neutral'; trendLabel?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green:  'bg-green-50  text-green-600',
    amber:  'bg-amber-50  text-amber-600',
    red:    'bg-red-50    text-red-600',
    blue:   'bg-blue-50   text-blue-600',
  };
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  const trendIcon  = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl ${colorMap[color] ?? colorMap['indigo']}`}>
          {icon}
        </span>
        {trendLabel && (
          <span className={`text-xs font-semibold ${trendColor}`}>
            {trendIcon} {trendLabel}
          </span>
        )}
      </div>
      <div className="text-2xl font-extrabold text-gray-900">
        {value}{unit && <span className="text-base font-medium text-gray-400 ml-1">{unit}</span>}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export function Badge({ children, variant = 'default' }: {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const variantCls: Record<string, string> = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error:   'bg-red-100 text-red-700',
    info:    'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantCls[variant]}`}>
      {children}
    </span>
  );
}

export function Button({
  children, onClick, variant = 'primary', disabled, loading, size = 'md', type = 'button',
}: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean; loading?: boolean; size?: 'sm' | 'md' | 'lg'; type?: 'button' | 'submit';
}) {
  const variantCls = {
    primary:   'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200',
    danger:    'bg-red-50 text-red-700 hover:bg-red-100',
  };
  const sizeCls = {
    sm: 'px-3 py-1.5 text-sm rounded-lg',
    md: 'px-4 py-2 text-sm rounded-xl',
    lg: 'px-6 py-3 text-base rounded-xl',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`font-medium transition ${variantCls[variant]} ${sizeCls[size]} disabled:cursor-not-allowed`}
    >
      {loading ? '处理中...' : children}
    </button>
  );
}

export function Input({
  label, value, onChange, type = 'text', placeholder, required, description, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; required?: boolean; description?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {description && <p className="text-xs text-gray-400 mb-1">{description}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white disabled:bg-gray-50 disabled:text-gray-400"
      />
    </div>
  );
}

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-10 w-10' };
  return (
    <div className={`animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 ${sizeMap[size]}`} />
  );
}

