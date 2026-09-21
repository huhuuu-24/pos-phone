import { useState, useEffect, useCallback } from 'react';
import { Plus, X, ChevronRight, Tag, Hash, Package, AlertCircle, CheckCircle, Smartphone, Headphones, Wrench } from 'lucide-react';
import { getAllProductsWithStock, addProduct, getIMEIsByProduct, addIMEI, deleteIMEI, adjustStock, deleteProduct, updateProduct
} from '@/lib/db';
import { CATEGORY_LABELS } from '@/lib/db';
import type { ProductWithStock, IMEIRecord, ProductCategory } from '@/types';

type Panel = 'list' | 'add-product' | 'product-detail';

const COLORS = ['黑色', '白色', '蓝色', '绿色', '紫色', '金色', '银色', '红色', '其他'];
const CONFIGS = ['64GB', '128GB', '256GB', '512GB', '1TB', '其他'];

const CATEGORY_ICONS: Record<ProductCategory, React.ReactNode> = {
  phone: <Smartphone size={14} />,
  accessory: <Headphones size={14} />,
  service: <Wrench size={14} />,
};

const CATEGORY_BADGE: Record<ProductCategory, string> = {
  phone: 'bg-blue-500/20 text-blue-400',
  accessory: 'bg-amber-500/20 text-amber-400',
  service: 'bg-purple-500/20 text-purple-400',
};

export default function Inventory() {
  const [panel, setPanel] = useState<Panel>('list');
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [selected, setSelected] = useState<ProductWithStock | null>(null);

  const [stockQty, setStockQty] = useState('1');

  const [editCostPrice, setEditCostPrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');
  
  const [imeis, setImeis] = useState<IMEIRecord[]>([]);
  const [newImei, setNewImei] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    category: 'phone' as ProductCategory,
    brand: '', model: '', color: COLORS[0], config: CONFIGS[1],
    barcode: '', costPrice: '', sellingPrice: '', stockQty: '',
  });

  const loadProducts = useCallback(async () => {
    const all = await getAllProductsWithStock();
    setProducts(all.sort((a, b) => b.id! - a.id!));
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const openProduct = async (p: ProductWithStock) => {
    setSelected(p);
    
     setEditCostPrice(p.costPrice.toString());
     setEditSellingPrice(p.sellingPrice.toString());
    
    if (p.category === 'phone') {
      const all = await getIMEIsByProduct(p.id!);
      setImeis(all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
    }
    setPanel('product-detail');
  };

  const handleAddProduct = async () => {
    if (!form.brand.trim() || !form.model.trim() || !form.costPrice || !form.sellingPrice) {
      showToast('请填写所有必填字段。', false);
      return;
    }
    const isPhone = form.category === 'phone';
    await addProduct({
      category: form.category,
      brand: form.brand.trim(),
      model: form.model.trim(),
      color: isPhone ? form.color : '',
      config: isPhone ? form.config : '',
      barcode: form.barcode.trim(),
      costPrice: parseFloat(form.costPrice),
      sellingPrice: parseFloat(form.sellingPrice),
      stockQty: isPhone ? 0 : (form.stockQty ? parseInt(form.stockQty) : 0),
      createdAt: new Date().toISOString(),
    });
    showToast('商品已成功添加！');
    setForm({
      category: 'phone', brand: '', model: '', color: COLORS[0], config: CONFIGS[1],
      barcode: '', costPrice: '', sellingPrice: '', stockQty: '',
    });
    await loadProducts();
    setPanel('list');
  };

  const handleAddIMEI = async () => {
    if (!newImei.trim() || !selected) return;
    const code = newImei.trim();
    try {
      await addIMEI({
        imei: code,
        productId: selected.id!,
        status: 'available',
      });
      showToast(`串号 ${code} 已添加。`);
      setNewImei('');
      const all = await getIMEIsByProduct(selected.id!);
      setImeis(all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0)));
      await loadProducts();
      setSelected((prev) => prev ? { ...prev, stock: prev.stock + 1 } : prev);
    } catch {
      showToast('该串号已存在，无法重复添加。', false);
    }
  };

  const handleDeleteIMEI = async (
  imeiId: number
) => {
  if (
    !window.confirm(
      '确定删除这个 IMEI 吗？'
    )
  ) {
    return;
  }

  await deleteIMEI(imeiId);

  if (!selected) return;

  const all = await getIMEIsByProduct(
    selected.id!
  );

  setImeis(
    all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0) )
  );
    
  await loadProducts();

  showToast('IMEI 已删除');
};
  
  const handleStockChange = async (qty: number) => {
  if (!selected) return;

  await adjustStock(selected.id!, qty);

  await loadProducts();

  const refreshed = (await getAllProductsWithStock())
    .find(p => p.id === selected.id);

  if (refreshed) {
    setSelected(refreshed);
  }

  showToast(
    qty > 0
      ? `库存增加 ${qty}`
      : `库存减少 ${Math.abs(qty)}`
  );
};
 const handleSaveProduct = async () => {
  if (!selected) return;

  const updatedProduct = {
    id: selected.id,
    category: selected.category,
    brand: selected.brand,
    model: selected.model,
    color: selected.color,
    config: selected.config,
    barcode: selected.barcode,
    stockQty: selected.stockQty,
    createdAt: selected.createdAt,
    costPrice: Number(editCostPrice),
    sellingPrice: Number(editSellingPrice),
  };

  await updateProduct(updatedProduct);

  showToast('商品资料已更新');

  await loadProducts();

  const refreshed = (
    await getAllProductsWithStock()
  ).find(p => p.id === selected.id);

  if (refreshed) {
    setSelected(refreshed);
  }
};

const handleDeleteProduct = async () => {
  if (!selected) return;

  if (
    !window.confirm(
      `确定删除 ${selected.brand} ${selected.model} ?`
    )
  ) {
    return;
  }

  await deleteProduct(selected.id!);

  showToast('商品已删除');

  setSelected(null);

  await loadProducts();

  setPanel('list');
};

  const fieldClass = 'w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all';
  const labelClass = 'block text-slate-400 text-sm font-medium mb-2';
  const isPhone = form.category === 'phone';

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium ${toast.ok ? 'bg-green-500/90 text-white' : 'bg-red-500/90 text-white'}`}>
          {toast.ok ? <CheckCircle size={16} /> : <AlertCircle size={16} />} {toast.msg}
        </div>
      )}

      {/* Product List Panel */}
      <div className="w-80 bg-slate-900 border-r border-slate-700/50 flex flex-col">
        <div className="p-5 border-b border-slate-700/50 flex items-center justify-between">
          <div>
            <h2 className="text-white font-bold text-lg">商品列表</h2>
            <p className="text-slate-500 text-xs mt-0.5">共 {products.length} 个型号</p>
          </div>
          <button
            onClick={() => setPanel('add-product')}
            className="w-9 h-9 bg-blue-500 hover:bg-blue-400 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-blue-500/25"
          >
            <Plus size={18} className="text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 p-6 text-center">
              <Package size={40} strokeWidth={1} className="mb-3" />
              <p className="text-sm">暂无商品</p>
              <p className="text-xs mt-1">点击 + 添加第一个商品</p>
            </div>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                onClick={() => openProduct(p)}
                className={`w-full flex items-center justify-between px-5 py-4 border-b border-slate-700/30 hover:bg-slate-800 transition-colors text-left ${selected?.id === p.id && panel === 'product-detail' ? 'bg-slate-800 border-l-2 border-l-blue-500' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-semibold text-sm truncate">{p.brand} {p.model}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0 ${CATEGORY_BADGE[p.category]}`}>
                      {CATEGORY_ICONS[p.category]} {CATEGORY_LABELS[p.category]}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5 truncate">
                    {p.category === 'phone' ? `${p.color} · ${p.config}` : p.barcode ? `条码: ${p.barcode}` : '无条码'}
                  </p>
                  <p className="text-blue-400 text-xs mt-0.5 font-medium">RM {p.sellingPrice.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 shrink-0">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.stock > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {p.stock}
                  </span>
                  <ChevronRight size={14} className="text-slate-600" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 overflow-y-auto">
        {panel === 'list' && (
          <div className="flex flex-col items-center justify-center h-full text-slate-600">
            <Package size={64} strokeWidth={1} className="mb-4" />
            <p className="text-xl font-medium">选择一个商品查看详情</p>
            <p className="text-sm mt-1">或点击左上角 + 添加新商品</p>
          </div>
        )}

        {panel === 'add-product' && (
          <div className="max-w-xl mx-auto p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-white font-bold text-2xl">添加新商品</h2>
              <button onClick={() => setPanel('list')} className="text-slate-400 hover:text-white transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Category selector */}
              <div>
                <label className={labelClass}>商品类型 *</label>
                <div className="grid grid-cols-3 gap-3">
                  {([
                    { cat: 'phone', label: '手机', icon: <Smartphone size={18} /> },
                    { cat: 'accessory', label: '配件', icon: <Headphones size={18} /> },
                    { cat: 'service', label: '服务/维修', icon: <Wrench size={18} /> },
                  ] as { cat: ProductCategory; label: string; icon: React.ReactNode }[]).map(({ cat, label, icon }) => (
                    <button
                      key={cat}
                      onClick={() => setForm({ ...form, category: cat })}
                      className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 font-semibold text-sm transition-all ${form.category === cat ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>品牌 *</label>
                  <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="如：Apple / Samsung" className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass}>{isPhone ? '型号 *' : '名称 *'}</label>
                  <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={isPhone ? '如：iPhone 15 Pro' : '如：手机壳 / 屏幕维修'} className={fieldClass} />
                </div>
              </div>

              {/* Phone-specific fields */}
              {isPhone && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>颜色</label>
                    <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={fieldClass}>
                      {COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>配置 / 容量</label>
                    <select value={form.config} onChange={(e) => setForm({ ...form, config: e.target.value })} className={fieldClass}>
                      {CONFIGS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Non-phone: barcode + stock quantity */}
              {!isPhone && (
                <>
                  <div>
                    <label className={labelClass}>商品条形码（可选）</label>
                    <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder="扫描或输入条形码（可留空）" className={fieldClass} />
                  </div>
                  <div>
                    <label className={labelClass}>库存数量</label>
                    <input type="number" min="0" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} placeholder="0" className={fieldClass} />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4 mt-4">

  <div>
    <label className="text-slate-400 text-sm block mb-1">
      进货价
    </label>

    <input
      type="number"
      step="0.01"
      value={editCostPrice}
      onChange={(e) =>
        setEditCostPrice(e.target.value)
      }
      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white"
    />
  </div>

  <div>
    <label className="text-slate-400 text-sm block mb-1">
      售价
    </label>

    <input
      type="number"
      step="0.01"
      value={editSellingPrice}
      onChange={(e) =>
        setEditSellingPrice(e.target.value)
      }
      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white"
    />
  </div>

</div>

<button
  onClick={handleSaveProduct}
  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold"
>
  保存修改
</button>

              {form.costPrice && form.sellingPrice && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 flex justify-between text-sm">
                  <span className="text-slate-400">单件利润</span>
                  <span className="text-green-400 font-semibold">
                    RM {(parseFloat(form.sellingPrice || '0') - parseFloat(form.costPrice || '0')).toFixed(2)}
                    {' '}
                    ({form.costPrice && form.sellingPrice ? ((parseFloat(form.sellingPrice) - parseFloat(form.costPrice)) / parseFloat(form.costPrice) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              )}

              <button onClick={handleAddProduct} className="w-full bg-blue-500 hover:bg-blue-400 text-white font-bold py-4 rounded-xl text-lg transition-all shadow-lg shadow-blue-500/20">
                保存商品
              </button>
            </div>
          </div>
        )}

        {panel === 'product-detail' && selected && (
  <div className="p-8">
    <div className="flex items-start justify-between mb-8">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-white font-bold text-2xl">
            {selected.brand} {selected.model}
          </h2>

          <span
            className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${CATEGORY_BADGE[selected.category]}`}
          >
            {CATEGORY_ICONS[selected.category]} {CATEGORY_LABELS[selected.category]}
          </span>
        </div>

        {selected.category === 'phone' ? (
          <p className="text-slate-400 mt-1">
            {selected.color} · {selected.config}
          </p>
        ) : (
          <p className="text-slate-400 mt-1">
            {selected.barcode ? `条码: ${selected.barcode}` : '无条码'}
          </p>
        )}

        <div className="flex items-center gap-4 mt-3">
          <span className="text-slate-400 text-sm">
            进货价：
            <span className="text-white">
              RM {selected.costPrice.toFixed(2)}
            </span>
          </span>

          <span className="text-slate-400 text-sm">
            售价：
            <span className="text-blue-400 font-semibold">
              RM {selected.sellingPrice.toFixed(2)}
            </span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <input
            type="number"
            value={editCostPrice}
            onChange={(e) => setEditCostPrice(e.target.value)}
            placeholder="进货价"
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white"
          />

          <input
            type="number"
            value={editSellingPrice}
            onChange={(e) => setEditSellingPrice(e.target.value)}
            placeholder="售价"
            className="bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white"
          />
        </div>

        <button
          onClick={handleSaveProduct}
          className="mt-4 px-4 py-2 bg-blue-600 rounded-xl text-white"
        >
          保存修改
        </button>
      </div>

      <div
        className={`px-4 py-2 rounded-xl text-lg font-bold ${
          selected.stock > 0
            ? 'bg-green-500/20 text-green-400'
            : 'bg-red-500/20 text-red-400'
        }`}
      >
        库存：{selected.stock}
      </div>
    </div>

    {selected.category === 'phone' && (
      <>
        <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Hash size={18} className="text-blue-400" />
            录入 IMEI 串号
          </h3>

          <div className="flex gap-3">
            <input
              value={newImei}
              onChange={(e) => setNewImei(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && handleAddIMEI()
              }
              placeholder="输入或扫描 IMEI 串号，按 Enter 添加..."
              className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all"
            />

            <button
              onClick={handleAddIMEI}
              disabled={!newImei.trim()}
              className="px-5 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all"
            >
              添加
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Tag size={18} className="text-blue-400" />
            串号记录（{imeis.length} 条）
          </h3>

          {imeis.length === 0 ? (
            <div className="text-center text-slate-600 py-12">
              <p>暂无串号记录</p>
              <p className="text-sm mt-1">
                请在上方录入 IMEI 串号
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {imeis.map((imei) => (
                <div
                  key={imei.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                    imei.status === 'available'
                      ? 'bg-slate-800/50 border-slate-700/50'
                      : 'bg-slate-900/50 border-slate-800 opacity-60'
                  }`}
                >
                  <span className="font-mono text-sm text-white">
                    {imei.imei}
                  </span>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium ${
                        imei.status === 'available'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-600/40 text-slate-400'
                      }`}
                    >
                      {imei.status === 'available'
                        ? '在库'
                        : '已售出'}
                    </span>

                    {imei.status === 'available' && (
                      <button
                        onClick={() =>
                          handleDeleteIMEI(imei.id!)
                        }
                        className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded-lg text-white"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    )}

    {selected.category !== 'phone' && (
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Package size={18} className="text-blue-400" />
          库存信息
        </h3>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">
              当前库存
            </p>
            <p className="text-white font-bold text-2xl">
              {selected.stock}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">
              单件利润
            </p>
            <p className="text-green-400 font-bold text-2xl">
              RM {(selected.sellingPrice - selected.costPrice).toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-800/50 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">
              条形码
            </p>
            <p className="text-white font-mono text-sm mt-1">
              {selected.barcode || '未设置'}
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 items-center">
          <input
            type="number"
            min="1"
            value={stockQty}
            onChange={(e) => setStockQty(e.target.value)}
            placeholder="数量"
            className="w-24 px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white"
          />

          <button
            onClick={() =>
              handleStockChange(Number(stockQty))
            }
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-semibold"
          >
            + 增加库存
          </button>

          <button
            onClick={() =>
              handleStockChange(-Number(stockQty))
            }
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold"
          >
            - 减少库存
          </button>

          <button
            onClick={handleDeleteProduct}
            className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-xl font-semibold"
          >
            删除商品
          </button>
        </div>
      </div>
    )}
  </div>
)}
      </div>
    </div>
  );
}
