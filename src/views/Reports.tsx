import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Calendar, CreditCard, Banknote, QrCode, RefreshCw, Filter, Download, Printer, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getTodayOrders, getAllOrders, CATEGORY_LABELS, deleteOrder  } from '@/lib/db';
import type { Order, PaymentMethod, ProductCategory } from '@/types';

const CATEGORY_BADGE: Record<ProductCategory, string> = {
  phone: 'bg-blue-500/20 text-blue-400',
  accessory: 'bg-amber-500/20 text-amber-400',
  service: 'bg-purple-500/20 text-purple-400',
};

const PAY_LABELS: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  cash: { label: '现金', icon: <Banknote size={14} /> },
  duitnow: { label: 'DuitNow', icon: <QrCode size={14} /> },
  card: { label: '刷卡', icon: <CreditCard size={14} /> },
};

const PAY_NAMES: Record<PaymentMethod, string> = {
  cash: '现金',
  duitnow: 'DuitNow QR',
  card: '刷卡',
};

function fmt(n: number) {
  return n.toFixed(2);
}

function timeStr(iso: string) {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function dateStr(iso: string) {
  return new Date(iso).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}

type Tab = 'today' | 'date' | 'month' | 'all';

function exportCSV(orders: Order[]) {
  const headers = ['销售日期', '商品名称/型号', '商品类型', 'IMEI串号/条码', '数量', '进货价(RM)', '实际售价(RM)', '净利润(RM)', '付款方式'];
  const rows: string[] = [headers.join(',')];

  for (const order of orders) {
    for (const item of order.items) {
      const d = new Date(order.createdAt);
      const datePart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      const name = `${item.brand} ${item.model}`;
      const catLabel = CATEGORY_LABELS[item.category];
      const imeiOrBarcode = item.imei || '—';
      const cost = item.costPrice * item.quantity;
      const revenue = item.sellingPrice * item.quantity;
      const netProfit = (item.sellingPrice - item.costPrice) * item.quantity;
      const pay = PAY_NAMES[order.paymentMethod];
      const cols = [datePart, name, catLabel, imeiOrBarcode, String(item.quantity), cost.toFixed(2), revenue.toFixed(2), netProfit.toFixed(2), pay];
      rows.push(cols.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
    }
  }

  function exportExcel(orders: Order[]) {
  const rows: (string | number)[][] = [];

  rows.push([
    '销售日期',
    '商品名称/型号',
    '商品类型',
    'IMEI串号/条码',
    '数量',
    '进货价(RM)',
    '实际售价(RM)',
    '净利润(RM)',
    '付款方式',
  ]);

  for (const order of orders) {
    for (const item of order.items) {
      const d = new Date(order.createdAt);

      const datePart =
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ` +
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

      const name = `${item.brand} ${item.model}`;
      const catLabel = CATEGORY_LABELS[item.category];
      const imeiOrBarcode = item.imei || '—';

      const cost = item.costPrice * item.quantity;
      const revenue = item.sellingPrice * item.quantity;
      const netProfit =
        (item.sellingPrice - item.costPrice) * item.quantity;

      const pay = PAY_NAMES[order.paymentMethod];

      rows.push([
        datePart,
        name,
        catLabel,
        imeiOrBarcode,
        item.quantity,
        Number(cost.toFixed(2)),
        Number(revenue.toFixed(2)),
        Number(netProfit.toFixed(2)),
        pay,
      ]);
    }
  }

  const totalRevenue = orders.reduce(
    (s, o) => s + o.totalAmount,
    0
  );

  const totalProfit = orders.reduce(
    (s, o) => s + o.totalProfit,
    0
  );

  rows.push([]);
  rows.push([
    '',
    '',
    '',
    '',
    '',
    '',
    `总营业额: RM ${totalRevenue.toFixed(2)}`,
    `总净利润: RM ${totalProfit.toFixed(2)}`,
    '',
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 25 },
    { wch: 12 },
    { wch: 20 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    '销售报表'
  );

  const todayFile = new Date()
    .toISOString()
    .slice(0, 10);

  XLSX.writeFile(
    workbook,
    `手机店销售报表_${todayFile}.xlsx`
  );
}
  
  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalProfit = orders.reduce((s, o) => s + o.totalProfit, 0);
  rows.push('');
  rows.push(`"","","","","","","总营业额: RM ${totalRevenue.toFixed(2)}","总净利润: RM ${totalProfit.toFixed(2)}",""`);

  const csvContent = '\uFEFF' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const todayFile = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `手机店销售报表_${todayFile}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function sameDay(iso: string, dateStr: string) {
  return new Date(iso).toISOString().slice(0, 10) === dateStr;
}

function sameMonth(iso: string, monthStr: string) {
  return new Date(iso).toISOString().slice(0, 7) === monthStr;
}

export default function Reports() {
  const [tab, setTab] = useState<Tab>('today');
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [reprintOrder, setReprintOrder] = useState<Order | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const all = await getAllOrders();
    setAllOrders(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const orders = useMemo(() => {
    if (tab === 'today') return allOrders.filter((o) => sameDay(o.createdAt, todayStr));
    if (tab === 'date') return allOrders.filter((o) => sameDay(o.createdAt, filterDate));
    if (tab === 'month') return allOrders.filter((o) => sameMonth(o.createdAt, filterMonth));
    return allOrders;
  }, [allOrders, tab, todayStr, filterDate, filterMonth]);

  const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const totalProfit = orders.reduce((s, o) => s + o.totalProfit, 0);
  const totalQty = orders.reduce((s, o) => s + o.items.reduce((qs, i) => qs + i.quantity, 0), 0);

  const periodLabel = tab === 'today' ? '今日' : tab === 'date' ? new Date(filterDate + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : tab === 'month' ? new Date(filterMonth + '-01T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }) : '全部历史';

  const tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: '今日' },
    { key: 'date', label: '按日期' },
    { key: 'month', label: '按月份' },
    { key: 'all', label: '全部历史' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white font-bold text-3xl">销售报表</h1>
          <p className="text-slate-400 text-sm mt-1">{periodLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportExcel(orders)}
            disabled={loading || orders.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-500/20"
          >
            <Download size={16} />
            导出 Excel 
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-sm font-medium transition-all"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${tab === t.key ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date / Month filter */}
      {(tab === 'date' || tab === 'month') && (
        <div className="mb-6 bg-slate-900 border border-slate-700/50 rounded-2xl p-5 flex items-center gap-4">
          <Filter size={18} className="text-blue-400 shrink-0" />
          <label className="text-slate-400 text-sm font-medium shrink-0">
            {tab === 'date' ? '选择日期' : '选择月份'}
          </label>
          {tab === 'date' ? (
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
          ) : (
            <input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-all"
            />
          )}
          <span className="text-slate-500 text-sm">共筛选出 {orders.length} 笔交易</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatCard
          icon={<DollarSign size={22} />}
          label="营业额"
          value={`RM ${fmt(totalRevenue)}`}
          color="blue"
        />
        <StatCard
          icon={<TrendingUp size={22} />}
          label="利润"
          value={`RM ${fmt(totalProfit)}`}
          color="green"
          sub={totalRevenue > 0 ? `利润率 ${((totalProfit / totalRevenue) * 100).toFixed(1)}%` : undefined}
        />
        <StatCard
          icon={<ShoppingBag size={22} />}
          label="销量"
          value={`${totalQty} 件`}
          color="amber"
          sub={`${orders.length} 笔交易`}
        />
      </div>

      {/* Orders */}
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/50 flex items-center gap-2">
          <Calendar size={16} className="text-blue-400" />
          <h2 className="text-white font-semibold">交易记录</h2>
          <span className="ml-auto text-slate-500 text-sm">{orders.length} 笔</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500">加载中...</div>
        ) : orders.length === 0 ? (
          <div className="py-16 text-center text-slate-600">
            <ShoppingBag size={48} strokeWidth={1} className="mx-auto mb-3" />
            <p>该时间段暂无交易记录</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                showDate={tab !== 'today'}
                onReprint={() => setReprintOrder(order)}
                onDelete={async () => {
    if (!order.id) return;

    const ok = confirm(
      `确定删除订单 #${order.id}？\n\n库存会自动恢复。`
    );

    if (!ok) return;

    await deleteOrder(order.id);

    loadData();
  }}
/>
            ))}
          </div>
        )}
      </div>

      {/* Reprint Receipt Modal */}
      {reprintOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Print-only receipt */}
            <div className="print-receipt hidden">
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>DREAM MOBILE ENTERPRISE</div>
                <div style={{ fontSize: '10px', marginTop: '3px' }}>SSM: 20260365286 (JM041516-D)</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>160, Jalan Pantai, 34350 Kuala Kurau, Perak.</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>Tel: 011-25804449</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>收银单 / RECEIPT (补印)</div>
              </div>
              <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                <div>日期: {new Date(reprintOrder.createdAt).toLocaleDateString('zh-CN')}</div>
                <div>订单编号: #{reprintOrder.id}</div>
                <div>付款方式: {PAY_NAMES[reprintOrder.paymentMethod]}</div>
              </div>
              <div style={{ borderBottom: '1px dashed #999', marginBottom: '8px' }} />
              {reprintOrder.items.map((item, idx) => (
                <div key={idx} style={{ fontSize: '11px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px dotted #ccc' }}>
                  <div style={{ fontWeight: 'bold' }}>{item.brand} {item.model}</div>
                  <div style={{ color: '#666' }}>类型: {CATEGORY_LABELS[item.category]} | 数量: {item.quantity}</div>
                  {item.category === 'phone' && item.imei && (
                    <div style={{ fontWeight: 'bold' }}>IMEI: {item.imei}</div>
                  )}
                  <div style={{ textAlign: 'right', fontWeight: 'bold', marginTop: '2px' }}>RM {(item.sellingPrice * item.quantity).toFixed(2)}</div>
                </div>
              ))}
              <div style={{ borderTop: '2px solid #000', paddingTop: '10px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                <span>总计 / TOTAL</span>
                <span>RM {reprintOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '16px', borderTop: '1px dashed #999', paddingTop: '10px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Thank you for shopping with us!</div>
                {reprintOrder.showWarranty && reprintOrder.warrantyText && (
                  <div style={{ marginTop: '4px' }}>{reprintOrder.warrantyText}</div>
                )}
              </div>
            </div>

            {/* On-screen receipt preview */}
            <div className="p-6">
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
                <h3 className="font-bold text-2xl text-slate-900 tracking-wide">DREAM MOBILE ENTERPRISE</h3>
                <p className="text-xs text-slate-500 mt-1.5">SSM: 20260365286 (JM041516-D)</p>
                <p className="text-xs text-slate-500 mt-0.5">160, Jalan Pantai, 34350 Kuala Kurau, Perak.</p>
                <p className="text-xs text-slate-500 mt-0.5">Tel: 011-25804449</p>
                <p className="font-bold text-sm text-slate-700 mt-3">收银单 / RECEIPT (补印)</p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-blue-600 text-sm font-medium">补印历史订单收据</span>
                <button onClick={() => setReprintOrder(null)} className="text-slate-400 hover:text-slate-700 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">销售日期</span>
                  <span className="font-medium text-slate-900">{new Date(reprintOrder.createdAt).toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">订单编号</span>
                  <span className="font-medium text-slate-900">#{reprintOrder.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">付款方式</span>
                  <span className="font-medium text-slate-900">{PAY_NAMES[reprintOrder.paymentMethod]}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-4 mb-4">
                <div className="grid grid-cols-12 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">
                  <span className="col-span-7">商品</span>
                  <span className="col-span-2 text-center">数量</span>
                  <span className="col-span-3 text-right">售价</span>
                </div>
                {reprintOrder.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 py-3 border-t border-slate-100 text-sm items-start">
                    <div className="col-span-7">
                      <div className="font-medium text-slate-900">{item.brand} {item.model}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{CATEGORY_LABELS[item.category]}</div>
                      {item.category === 'phone' && item.imei && (
                        <div className="text-xs font-bold text-blue-600 mt-1">IMEI: {item.imei}</div>
                      )}
                    </div>
                    <div className="col-span-2 text-center text-slate-600">{item.quantity}</div>
                    <div className="col-span-3 text-right font-bold text-slate-900">RM {(item.sellingPrice * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>

              <div className="border-t-2 border-slate-800 pt-4 flex justify-between items-center mb-6">
                <span className="font-bold text-lg text-slate-900">总计</span>
                <span className="font-bold text-2xl text-blue-600">RM {reprintOrder.totalAmount.toFixed(2)}</span>
              </div>

              <div className="text-center border-t border-dashed border-slate-300 pt-4 mb-5">
                <p className="font-bold text-xs text-slate-600 mb-1">Thank you for shopping with us!</p>
                {reprintOrder.showWarranty && reprintOrder.warrantyText && (
                  <p className="text-xs text-slate-400 mt-1">{reprintOrder.warrantyText}</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
  const receipt = document.querySelector('.print-receipt');

  if (!receipt) {
    alert('找不到收据内容');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=800,height=600');

  if (!printWindow) {
    alert('无法打开打印窗口');
    return;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 15px;
            color: black;
          }
        </style>
      </head>
      <body>
        ${receipt.innerHTML}
      </body>
    </html>
  `);

  printWindow.document.close();

  setTimeout(() => {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }, 500);
}}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Printer size={18} />
                  打印收据
                </button>
                <button
                  onClick={() => setReprintOrder(null)}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3.5 rounded-xl transition-all active:scale-95"
                >
                  <X size={18} />
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: 'blue' | 'green' | 'amber'; sub?: string }) {
  const colorMap = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  };
  const iconMap = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    amber: 'bg-amber-500/20 text-amber-400',
  };
  return (
    <div className={`bg-slate-900 border rounded-2xl p-5 ${colorMap[color]}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${iconMap[color]}`}>
        {icon}
      </div>
      <p className="text-slate-400 text-sm font-medium">{label}</p>
      <p className="text-white font-bold text-2xl mt-1">{value}</p>
      {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
    </div>
  );
}

function OrderRow({ order, showDate, onReprint, onDelete }: { order: Order; showDate: boolean; onReprint: () => void; onDelete: () => void; }) {
  const [expanded, setExpanded] = useState(false);
  const pay = PAY_LABELS[order.paymentMethod];
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div>
      <div className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-800/50 transition-colors text-left">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-1 min-w-0 text-left"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-medium text-sm">
              {order.items.map((i) => `${i.brand} ${i.model}`).join('、')}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-slate-500 text-xs flex items-center gap-1">
              {pay.icon} {pay.label}
            </span>
            <span className="text-slate-500 text-xs">
              {showDate ? dateStr(order.createdAt) + ' ' : ''}{timeStr(order.createdAt)}
            </span>
            <span className="text-slate-500 text-xs">{totalQty} 件</span>
          </div>
        </button>

        <div className="text-right shrink-0">
          <p className="text-blue-400 font-bold">RM {fmt(order.totalAmount)}</p>
          <p className="text-green-400 text-xs mt-0.5">利润 RM {fmt(order.totalProfit)}</p>
        </div>

        <button
          onClick={onReprint}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap"
          title="补印此订单的收据"
        >
          <Printer size={14} />
          补印
        </button>

        <button
  onClick={onDelete}
  className="flex items-center gap-1.5 px-3 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg text-xs font-bold transition-all shrink-0 whitespace-nowrap"
>
  🗑 删除
</button>
      </div>

      {expanded && (
        <div className="px-6 pb-4 bg-slate-800/20">
          <div className="border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2 bg-slate-800 text-slate-500 text-xs font-medium uppercase tracking-wide">
              <span className="col-span-3">商品</span>
              <span className="col-span-2">类型</span>
              <span className="col-span-1 text-center">数量</span>
              <span className="col-span-3">IMEI 串号</span>
              <span className="col-span-3 text-right">售价</span>
            </div>
            {order.items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 px-4 py-3 border-t border-slate-700/30 text-sm items-center">
                <span className="col-span-3 text-white font-medium">{item.brand} {item.model}</span>
                <span className="col-span-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_BADGE[item.category]}`}>{CATEGORY_LABELS[item.category]}</span>
                </span>
                <span className="col-span-1 text-center text-slate-300">{item.quantity}</span>
                <span className="col-span-3 font-mono text-slate-400 text-xs">{item.imei || '—'}</span>
                <span className="col-span-3 text-right text-blue-400">RM {fmt(item.sellingPrice * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
