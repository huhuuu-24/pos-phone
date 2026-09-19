import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import POS from '@/views/POS';
import Inventory from '@/views/Inventory';
import Reports from '@/views/Reports';
import Backup from '.@/views/Backup';
import type { View } from '@/types';

export default function App() {
  const [view, setView] = useState<View>('pos');

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar current={view} onChange={setView} />
      <main className="flex-1 overflow-hidden">
        {view === 'pos' && <POS />}
        {view === 'inventory' && <Inventory />}
        {view === 'reports' && <Reports />}
        {view === 'backup' && <Backup />}
      </main>
    </div>
  );
}
