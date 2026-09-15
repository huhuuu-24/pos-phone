import { ShoppingCart, Package, BarChart3, Smartphone } from 'lucide-react';
import type { View } from '@/types';

interface SidebarProps {
  current: View;
  onChange: (v: View) => void;
}

const navItems: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: 'pos', label: '收银台', icon: <ShoppingCart size={20} /> },
  { view: 'inventory', label: '库存管理', icon: <Package size={20} /> },
  { view: 'reports', label: '销售报表', icon: <BarChart3 size={20} /> },
];

export default function Sidebar({ current, onChange }: SidebarProps) {
  return (
    <aside className="w-60 min-h-screen bg-slate-900 border-r border-slate-700/50 flex flex-col select-none">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-700/50">
        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Smartphone size={22} className="text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-tight">手机店</p>
          <p className="text-blue-400 text-xs font-medium">POS 系统</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ view, label, icon }) => {
          const active = current === view;
          return (
            <button
              key={view}
              onClick={() => onChange(view)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                active
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {icon}
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-700/50">
        <p className="text-slate-500 text-xs text-center">离线版 · 本地数据存储</p>
      </div>
    </aside>
  );
}
