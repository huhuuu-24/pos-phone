import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Trash2, CreditCard, Banknote, QrCode,
  ShoppingCart, CheckCircle, X, AlertCircle, Plus, Minus, Smartphone, Headphones, Wrench, Pencil, Calendar, Printer, Settings, ChevronDown
} from 'lucide-react';
import {
  getAllProductsWithStock, getAvailableIMEIsByProduct,
  findIMEIByCode, getProductById, addOrder, markIMEIsSold, decrementStock, findProductByBarcode
} from '@/lib/db';
import { CATEGORY_LABELS } from '@/lib/db';
import type { Product, ProductWithStock, IMEIRecord, OrderItem, PaymentMethod, ProductCategory } from '@/types';

interface CartItem extends OrderItem {
  key: string;
}

interface ReceiptData {
  orderId: number;
  items: OrderItem[];
  paymentMethod: PaymentMethod;
  totalAmount: number;
  saleDate: string;
  totalQty: number;
  showWarranty: boolean;
  warrantyText: string;
}

const DEFAULT_WARRANTY = 'Warranty Clause: 1-Year Local Manufacturer Warranty. Please keep this receipt for warranty purposes.';

interface WarrantyTemplate {
  id: string;
  label: string;
  text: string;
  showWarranty: boolean;
  isPreset: boolean;
}

const PRESET_TEMPLATES: WarrantyTemplate[] = [
  {
    id: 'preset-new',
    label: '全新机',
    text: 'Warranty: 1-Year Local Manufacturer Warranty. Please keep this receipt for warranty purposes.',
    showWarranty: true,
    isPreset: true,
  },
  {
    id: 'preset-used',
    label: '二手机',
    text: 'Warranty: 1-Month Shop Warranty for hardware only. Water damage & screen crack void warranty.',
    showWarranty: true,
    isPreset: true,
  },
  {
    id: 'preset-repair',
    label: '手机维修',
    text: 'Warranty: 30-Days Warranty for replaced parts only.',
    showWarranty: true,
    isPreset: true,
  },
  {
    id: 'preset-none',
    label: '无保修',
    text: '',
    showWarranty: false,
    isPreset: true,
  },
];

const TEMPLATES_KEY = 'warranty_templates';

function loadTemplates(): WarrantyTemplate[] {
  try {
    const stored = localStorage.getItem(TEMPLATES_KEY);
    if (stored) {
      const custom = JSON.parse(stored) as WarrantyTemplate[];
      return [...PRESET_TEMPLATES, ...custom];
    }
  } catch { /* ignore */ }
  return PRESET_TEMPLATES;
}

function saveCustomTemplates(templates: WarrantyTemplate[]) {
  const custom = templates.filter((t) => !t.isPreset);
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(custom));
}

const PAY_LABELS: Record<PaymentMethod, string> = {
  cash: '现金',
  duitnow: 'DuitNow QR',
  card: '刷卡',
};

type ModalState = 'none' | 'imei-pick' | 'payment' | 'duitnow' | 'success';

const CATEGORY_ICONS: Record<ProductCategory, React.ReactNode> = {
  phone: <Smartphone size={12} />,
  accessory: <Headphones size={12} />,
  service: <Wrench size={12} />,
};

const CATEGORY_BADGE: Record<ProductCategory, string> = {
  phone: 'bg-blue-500/20 text-blue-400',
  accessory: 'bg-amber-500/20 text-amber-400',
  service: 'bg-purple-500/20 text-purple-400',
};

export default function POS() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductWithStock[]>([]);
  const [searchResults, setSearchResults] = useState<ProductWithStock[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [modal, setModal] = useState<ModalState>('none');
  const [pickedProduct, setPickedProduct] = useState<ProductWithStock | null>(null);
  const [availableIMEIs, setAvailableIMEIs] = useState<IMEIRecord[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashInput, setCashInput] = useState('');
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [successMsg, setSuccessMsg] = useState('');
  const [alertMsg, setAlertMsg] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [showWarranty, setShowWarranty] = useState(true);
  const [warrantyText, setWarrantyText] = useState(PRESET_TEMPLATES[0].text);
  const [warrantyTemplates, setWarrantyTemplates] = useState<WarrantyTemplate[]>(() => loadTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState('preset-new');
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [newTemplateLabel, setNewTemplateLabel] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const loadProducts = useCallback(async () => {
    const all = await getAllProductsWithStock();
    setProducts(all);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);
  useEffect(() => { searchRef.current?.focus(); }, []);

  const showAlert = (msg: string) => {
    setAlertMsg(msg);
    setTimeout(() => setAlertMsg(''), 3000);
  };

  const handleSearch = (val: string) => {
    setQuery(val);
    if (!val.trim()) { setSearchResults([]); return; }
    const q = val.toLowerCase();
    const filtered = products.filter(
      (p) =>
        p.model.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.config.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
    );
    setSearchResults(filtered);
  };

  const handleSearchSubmit = async () => {
    if (!query.trim()) return;
    const code = query.trim();
    // Try IMEI lookup first
    const foundImei = await findIMEIByCode(code);
    if (foundImei) {
      if (foundImei.status === 'sold') { showAlert('该串号已售出，无法再次销售。'); return; }
      const product = await getProductById(foundImei.productId);
      if (!product) return;
      addPhoneToCart(product, foundImei);
      setQuery(''); setSearchResults([]);
      return;
    }
    // Try barcode lookup
    const foundBarcode = await findProductByBarcode(code);
    if (foundBarcode && foundBarcode.category !== 'phone') {
      addNonPhoneToCart(foundBarcode);
      setQuery(''); setSearchResults([]);
      return;
    }
  };

  const openResult = async (product: ProductWithStock) => {
    if (product.category === 'phone') {
      if (product.stock === 0) { showAlert('该手机库存为零。'); return; }
      const imeis = await getAvailableIMEIsByProduct(product.id!);
      setPickedProduct(product);
      setAvailableIMEIs(imeis);
      setModal('imei-pick');
    } else {
      addNonPhoneToCart(product);
      setQuery(''); setSearchResults([]);
    }
  };

  const addPhoneToCart = (product: Product, imei: IMEIRecord) => {
    const already = cart.some((c) => c.imeiId === imei.id!);
    if (already) { showAlert('该串号已在购物车中。'); return; }
    const item: CartItem = {
      key: `imei-${imei.id}-${Date.now()}`,
      productId: product.id!,
      category: 'phone',
      imeiId: imei.id!,
      imei: imei.imei,
      brand: product.brand,
      model: product.model,
      color: product.color,
      config: product.config,
      quantity: 1,
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice,
    };
    setCart((prev) => [...prev, item]);
    setModal('none');
  };

  const addNonPhoneToCart = (product: Product) => {
    // If already in cart, increment quantity
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id && c.category !== 'phone');
      if (existing) {
        return prev.map((c) => c.key === existing.key ? { ...c, quantity: c.quantity + 1 } : c);
      }
      const item: CartItem = {
        key: `prod-${product.id}-${Date.now()}`,
        productId: product.id!,
        category: product.category,
        imeiId: null,
        imei: '',
        brand: product.brand,
        model: product.model,
        color: '',
        config: '',
        quantity: 1,
        sellingPrice: product.sellingPrice,
        costPrice: product.costPrice,
      };
      return [...prev, item];
    });
  };

  const changeQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        if (c.category === 'phone') return c;
        const newQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQty };
      })
    );
  };

  const removeFromCart = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key));

  const changePrice = (key: string, newPrice: number) => {
    if (isNaN(newPrice) || newPrice < 0) newPrice = 0;
    setCart((prev) => prev.map((c) => c.key === key ? { ...c, sellingPrice: newPrice } : c));
  };

  const total = cart.reduce((s, c) => s + c.sellingPrice * c.quantity, 0);
  const totalCost = cart.reduce((s, c) => s + c.costPrice * c.quantity, 0);
  const profit = total - totalCost;
  const cashChange = paymentMethod === 'cash' && cashInput ? parseFloat(cashInput) - total : 0;
  const totalQty = cart.reduce((s, c) => s + c.quantity, 0);

  const selectTemplate = (id: string) => {
    const tmpl = warrantyTemplates.find((t) => t.id === id);
    if (tmpl) {
      setSelectedTemplateId(id);
      setShowWarranty(tmpl.showWarranty);
      setWarrantyText(tmpl.text);
    }
  };

  const addCustomTemplate = () => {
    const label = newTemplateLabel.trim();
    const text = newTemplateText.trim();
    if (!label || !text) { showAlert('请填写模板名称和保修条款内容。'); return; }
    const newTmpl: WarrantyTemplate = {
      id: `custom-${Date.now()}`,
      label,
      text,
      showWarranty: true,
      isPreset: false,
    };
    const updated = [...warrantyTemplates, newTmpl];
    setWarrantyTemplates(updated);
    saveCustomTemplates(updated);
    setNewTemplateLabel('');
    setNewTemplateText('');
    setSelectedTemplateId(newTmpl.id);
    setShowWarranty(true);
    setWarrantyText(text);
  };

  const deleteCustomTemplate = (id: string) => {
    const updated = warrantyTemplates.filter((t) => t.id !== id);
    setWarrantyTemplates(updated);
    saveCustomTemplates(updated);
    if (selectedTemplateId === id) {
      setSelectedTemplateId('preset-new');
      setShowWarranty(PRESET_TEMPLATES[0].showWarranty);
      setWarrantyText(PRESET_TEMPLATES[0].text);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) { showAlert('购物车为空，请先添加商品。'); return; }
    setPaymentMethod('cash'); setCashInput(''); setSaleDate(new Date().toISOString().slice(0, 10)); setWarrantyTemplates(loadTemplates()); setSelectedTemplateId('preset-new'); setShowWarranty(true); setWarrantyText(PRESET_TEMPLATES[0].text); setModal('payment');
  };

  const confirmPayment = async () => {
    if (paymentMethod === 'duitnow') { setModal('duitnow'); return; }
    await processOrder();
  };

  const processOrder = async () => {
    const saleDateTime = new Date(saleDate + 'T' + new Date().toTimeString().slice(0, 8)).toISOString();
    const items: OrderItem[] = cart.map(({ key: _k, ...rest }) => rest);
    const orderId = await addOrder({
      items,
      paymentMethod,
      totalAmount: total,
      totalProfit: profit,
      createdAt: saleDateTime,
      showWarranty,
      warrantyText,
    });
    // Mark phone IMEIs as sold
    const imeiIds = cart.filter((c) => c.imeiId !== null).map((c) => c.imeiId!);
    if (imeiIds.length > 0) await markIMEIsSold(imeiIds, orderId);
    // Decrement stock for non-phone items
    const nonPhoneItems = cart.filter((c) => c.category !== 'phone');
    await Promise.all(nonPhoneItems.map((c) => decrementStock(c.productId, c.quantity)));

    setReceipt({
      orderId,
      items,
      paymentMethod,
      totalAmount: total,
      saleDate,
      totalQty,
      showWarranty,
      warrantyText,
    });
    setSuccessMsg(`结账成功！共 ${totalQty} 件商品，总额 RM ${total.toFixed(2)}`);
    setCart([]);
    setModal('success');
    await loadProducts();
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      {alertMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-xl shadow-xl flex items-center gap-2 text-sm font-medium">
          <AlertCircle size={16} /> {alertMsg}
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div className="p-6 bg-slate-900 border-b border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSubmit()}
              placeholder="搜索型号、配件名称、条形码，或扫描 IMEI 串号..."
              className="w-full bg-slate-800 border border-slate-600 rounded-2xl pl-14 pr-5 py-4 text-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
            {query && (
              <button onClick={() => { setQuery(''); setSearchResults([]); }} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            )}
          </div>

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="mt-3 bg-slate-800 border border-slate-600 rounded-2xl overflow-hidden shadow-2xl">
              {searchResults.map((p) => (
                <button
                  key={p.id}
                  onClick={() => openResult(p)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
                >
                  <div className="text-left flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 ${CATEGORY_BADGE[p.category]}`}>
                      {CATEGORY_ICONS[p.category]} {CATEGORY_LABELS[p.category]}
                    </span>
                    <div>
                      <span className="text-white font-semibold">{p.brand} {p.model}</span>
                      <span className="ml-3 text-slate-400 text-sm">{p.category === 'phone' ? `${p.color} · ${p.config}` : p.barcode ? `条码: ${p.barcode}` : ''}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-blue-400 font-bold text-lg">RM {p.sellingPrice.toFixed(2)}</span>
                    <span className={`text-sm px-3 py-1 rounded-full font-medium ${p.stock > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      库存 {p.stock}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600">
              <ShoppingCart size={64} strokeWidth={1} className="mb-4" />
              <p className="text-xl font-medium">购物车为空</p>
              <p className="text-sm mt-1">搜索型号/配件名称，或扫描串号/条码以添加商品</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item) => (
                <div key={item.key} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-semibold text-base truncate">{item.brand} {item.model}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0 ${CATEGORY_BADGE[item.category]}`}>
                        {CATEGORY_ICONS[item.category]} {CATEGORY_LABELS[item.category]}
                      </span>
                    </div>
                    {item.category === 'phone' && (
                      <>
                        <p className="text-slate-400 text-sm">{item.color} · {item.config}</p>
                        <p className="text-slate-500 text-xs mt-1 font-mono">IMEI: {item.imei}</p>
                      </>
                    )}
                  </div>

                  {/* Quantity controls for non-phone */}
                  {item.category !== 'phone' && (
                    <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl p-1">
                      <button onClick={() => changeQty(item.key, -1)} className="w-7 h-7 rounded-lg bg-slate-600 hover:bg-slate-500 flex items-center justify-center transition-colors">
                        <Minus size={14} className="text-white" />
                      </button>
                      <span className="text-white font-semibold text-sm w-8 text-center">{item.quantity}</span>
                      <button onClick={() => changeQty(item.key, 1)} className="w-7 h-7 rounded-lg bg-blue-500 hover:bg-blue-400 flex items-center justify-center transition-colors">
                        <Plus size={14} className="text-white" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-2 shrink-0">
                    <Pencil size={14} className="text-slate-500" />
                    <div className="flex items-center bg-slate-700/50 rounded-xl border border-slate-600 focus-within:border-blue-500 transition-colors">
                      <span className="text-slate-400 text-sm pl-3">RM</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.sellingPrice}
                        onChange={(e) => changePrice(item.key, parseFloat(e.target.value) || 0)}
                        className="w-20 bg-transparent text-right text-blue-400 font-bold text-lg px-2 py-1.5 focus:outline-none"
                      />
                    </div>
                    {item.quantity > 1 && (
                      <span className="text-slate-400 text-xs whitespace-nowrap">
                        = RM {(item.sellingPrice * item.quantity).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(item.key)} className="text-slate-500 hover:text-red-400 transition-colors p-2 rounded-lg hover:bg-red-500/10 shrink-0">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right panel — summary */}
      <div className="w-80 bg-slate-900 border-l border-slate-700/50 flex flex-col p-6">
        <h2 className="text-slate-300 font-semibold text-lg mb-6">结账明细</h2>
        <div className="flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex justify-between text-slate-400 text-sm">
              <span>商品数量</span>
              <span className="text-white font-medium">{totalQty} 件</span>
            </div>
            <div className="flex justify-between text-slate-400 text-sm">
              <span>预计利润</span>
              <span className="text-green-400 font-medium">RM {profit.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-700 pt-4 flex justify-between items-center">
              <span className="text-white font-semibold text-lg">总计</span>
              <span className="text-blue-400 font-bold text-3xl">RM {total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="mt-8 w-full bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold text-lg py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
          >
            结账
          </button>
        </div>
      </div>

      {/* IMEI Picker Modal */}
      {modal === 'imei-pick' && pickedProduct && (
        <Modal title={`选择串号 — ${pickedProduct.brand} ${pickedProduct.model}`} onClose={() => setModal('none')}>
          <p className="text-slate-400 text-sm mb-4">{pickedProduct.color} · {pickedProduct.config} · RM {pickedProduct.sellingPrice.toFixed(2)}</p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {availableIMEIs.map((imei) => (
              <button
                key={imei.id}
                onClick={() => addPhoneToCart(pickedProduct, imei)}
                className="w-full flex items-center justify-between bg-slate-800 hover:bg-blue-500/20 border border-slate-700 hover:border-blue-500/50 rounded-xl px-4 py-3 transition-all group"
              >
                <span className="font-mono text-white text-sm">{imei.imei}</span>
                <Plus size={16} className="text-slate-500 group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {modal === 'payment' && (
        <Modal title="选择付款方式" onClose={() => setModal('none')}>
          <div className="space-y-3 mb-6">
            {([
              { method: 'cash', label: '现金', icon: <Banknote size={20} /> },
              { method: 'duitnow', label: 'DuitNow QR', icon: <QrCode size={20} /> },
              { method: 'card', label: '刷卡', icon: <CreditCard size={20} /> },
            ] as { method: PaymentMethod; label: string; icon: React.ReactNode }[]).map(({ method, label, icon }) => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`w-full flex items-center gap-3 px-5 py-4 rounded-xl border-2 font-semibold transition-all ${paymentMethod === method ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-slate-700 text-slate-300 hover:border-slate-500'}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Sales date picker */}
          <div className="mb-5">
            <label className="text-slate-400 text-sm block mb-2">销售日期</label>
            <div className="relative">
              <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-12 pr-4 py-3 text-white text-base focus:outline-none focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {paymentMethod === 'cash' && (
            <div className="mb-4">
              <label className="text-slate-400 text-sm block mb-2">顾客付款金额 (RM)</label>
              <input
                type="number"
                value={cashInput}
                onChange={(e) => setCashInput(e.target.value)}
                placeholder={total.toFixed(2)}
                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-blue-500"
              />
              {cashInput && parseFloat(cashInput) >= total && (
                <p className="text-green-400 text-sm mt-2 font-medium">找零：RM {cashChange.toFixed(2)}</p>
              )}
              {cashInput && parseFloat(cashInput) < total && (
                <p className="text-red-400 text-sm mt-2">付款金额不足</p>
              )}
            </div>
          )}

          {/* Warranty template selector */}
          <div className="mb-5">
            <label className="text-slate-400 text-sm block mb-2">保修条款模板</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => selectTemplate(e.target.value)}
                  className="w-full appearance-none bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 pr-10 text-white text-sm focus:outline-none focus:border-blue-500 transition-all cursor-pointer"
                >
                  {warrantyTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}{t.isPreset ? ' (预设)' : ' (自定义)'}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
              <button
                onClick={() => setShowTemplateManager(true)}
                className="flex items-center gap-1.5 px-3 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-xl text-xs font-medium transition-all whitespace-nowrap"
              >
                <Settings size={14} />
                管理模板
              </button>
            </div>
            {showWarranty && warrantyText && (
              <div className="mt-2 bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2">
                <p className="text-slate-400 text-xs leading-relaxed">{warrantyText}</p>
              </div>
            )}
            {!showWarranty && (
              <p className="mt-2 text-slate-500 text-xs">收据底部将只显示 "Thank you for shopping with us!"</p>
            )}
          </div>

          {/* Template Manager Modal */}
          {showTemplateManager && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTemplateManager(false)}>
              <div className="bg-slate-800 border border-slate-600 rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
                  <h4 className="text-white font-semibold">保修条款模板管理</h4>
                  <button onClick={() => setShowTemplateManager(false)} className="text-slate-400 hover:text-white">
                    <X size={18} />
                  </button>
                </div>
                <div className="p-5 max-h-[70vh] overflow-y-auto">
                  {/* Add new template */}
                  <div className="mb-5 bg-slate-900/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-slate-300 text-sm font-medium mb-3">添加新模板</p>
                    <input
                      type="text"
                      value={newTemplateLabel}
                      onChange={(e) => setNewTemplateLabel(e.target.value)}
                      placeholder="模板名称 (如: 二手手机保修1个月)"
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-blue-500"
                    />
                    <textarea
                      value={newTemplateText}
                      onChange={(e) => setNewTemplateText(e.target.value)}
                      rows={3}
                      placeholder="保修条款内容..."
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm mb-3 focus:outline-none focus:border-blue-500 resize-none"
                    />
                    <button
                      onClick={addCustomTemplate}
                      className="w-full flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-2.5 rounded-lg text-sm transition-all"
                    >
                      <Plus size={16} />
                      保存新模板
                    </button>
                  </div>
                  {/* Existing templates */}
                  <p className="text-slate-400 text-xs font-medium mb-2">已有模板</p>
                  <div className="space-y-2">
                    {warrantyTemplates.map((t) => (
                      <div key={t.id} className="flex items-start gap-3 bg-slate-900/50 rounded-lg px-3 py-2.5 border border-slate-700/50">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-white text-sm font-medium">{t.label}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${t.isPreset ? 'bg-slate-700 text-slate-400' : 'bg-blue-500/20 text-blue-400'}`}>
                              {t.isPreset ? '预设' : '自定义'}
                            </span>
                          </div>
                          {t.text && (
                            <p className="text-slate-500 text-xs mt-1 line-clamp-2">{t.text}</p>
                          )}
                          {!t.showWarranty && (
                            <p className="text-slate-500 text-xs mt-1 italic">无保修字样</p>
                          )}
                        </div>
                        {!t.isPreset && (
                          <button
                            onClick={() => deleteCustomTemplate(t.id)}
                            className="text-slate-500 hover:text-red-400 transition-colors shrink-0 mt-0.5"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center mb-6 pt-4 border-t border-slate-700">
            <span className="text-slate-300 font-medium">应收总额</span>
            <span className="text-blue-400 font-bold text-2xl">RM {total.toFixed(2)}</span>
          </div>

          <button
            onClick={confirmPayment}
            disabled={paymentMethod === 'cash' && cashInput !== '' && parseFloat(cashInput) < total}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl text-lg transition-all"
          >
            确认收款
          </button>
        </Modal>
      )}

      {/* DuitNow QR Modal */}
      {modal === 'duitnow' && (
        <Modal title="DuitNow QR 付款" onClose={() => setModal('none')}>
          <p className="text-center text-slate-400 mb-4">请顾客扫描以下二维码付款</p>
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="bg-white p-6 rounded-2xl">
              <svg viewBox="0 0 200 200" width="200" height="200" className="text-black">
                {Array.from({ length: 10 }, (_, row) =>
                  Array.from({ length: 10 }, (_, col) =>
                    (row + col) % 2 === 0 ? (
                      <rect key={`${row}-${col}`} x={col * 20} y={row * 20} width="18" height="18" fill="black" rx="2" />
                    ) : null
                  )
                )}
                <rect x="0" y="0" width="60" height="60" fill="none" stroke="black" strokeWidth="6" rx="6" />
                <rect x="140" y="0" width="60" height="60" fill="none" stroke="black" strokeWidth="6" rx="6" />
                <rect x="0" y="140" width="60" height="60" fill="none" stroke="black" strokeWidth="6" rx="6" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-slate-400 text-sm">付款金额</p>
              <p className="text-blue-400 font-bold text-3xl">RM {total.toFixed(2)}</p>
            </div>
          </div>
          <button
            onClick={processOrder}
            className="w-full bg-green-500 hover:bg-green-400 text-white font-bold py-4 rounded-xl text-lg transition-all"
          >
            确认已收款
          </button>
        </Modal>
      )}

      {/* Success / Receipt Modal */}
      {modal === 'success' && receipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6 no-print">
          <div className="bg-white text-slate-900 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Print-only receipt */}
            <div className="print-receipt hidden">
              {/* Header — shop info */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '10px' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>DREAM MOBILE ENTERPRISE</div>
                <div style={{ fontSize: '10px', marginTop: '3px' }}>SSM: 20260365286 (JM041516-D)</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>160, Jalan Pantai, 34350 Kuala Kurau, Perak.</div>
                <div style={{ fontSize: '10px', marginTop: '2px' }}>Tel: 011-25804449</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginTop: '8px' }}>收银单 / RECEIPT</div>
              </div>
              {/* Order info */}
              <div style={{ fontSize: '11px', marginBottom: '8px' }}>
                <div>日期: {new Date(receipt.saleDate + 'T00:00:00').toLocaleDateString('zh-CN')}</div>
                <div>订单编号: #{receipt.orderId}</div>
                <div>付款方式: {PAY_LABELS[receipt.paymentMethod]}</div>
              </div>
              <div style={{ borderBottom: '1px dashed #999', marginBottom: '8px' }} />
              {receipt.items.map((item, idx) => (
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
                <span>RM {receipt.totalAmount.toFixed(2)}</span>
              </div>
              {/* Footer — warranty clauses */}
              <div style={{ textAlign: 'center', fontSize: '9px', color: '#666', marginTop: '16px', borderTop: '1px dashed #999', paddingTop: '10px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Thank you for shopping with us!</div>
                {receipt.showWarranty && receipt.warrantyText && (
                  <div style={{ marginTop: '4px' }}>{receipt.warrantyText}</div>
                )}
              </div>
            </div>

            {/* On-screen receipt preview */}
            <div className="p-6">
              {/* Header — shop info */}
              <div className="text-center border-b-2 border-slate-800 pb-4 mb-5">
                <h3 className="font-bold text-2xl text-slate-900 tracking-wide">DREAM MOBILE ENTERPRISE</h3>
                <p className="text-xs text-slate-500 mt-1.5">SSM: 20260365286 (JM041516-D)</p>
                <p className="text-xs text-slate-500 mt-0.5">160, Jalan Pantai, 34350 Kuala Kurau, Perak.</p>
                <p className="text-xs text-slate-500 mt-0.5">Tel: 011-25804449</p>
                <p className="font-bold text-sm text-slate-700 mt-3">收银单 / RECEIPT</p>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CheckCircle size={18} className="text-green-500" />
                  <span className="text-green-600 text-sm font-medium">{successMsg}</span>
                </div>
                <button onClick={() => { setModal('none'); setReceipt(null); }} className="text-slate-400 hover:text-slate-700 transition-colors">
                  <X size={20} />
                </button>
              </div>

              {/* Receipt info */}
              <div className="bg-slate-50 rounded-xl p-4 mb-5 text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">销售日期</span>
                  <span className="font-medium text-slate-900">{new Date(receipt.saleDate + 'T00:00:00').toLocaleDateString('zh-CN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">订单编号</span>
                  <span className="font-medium text-slate-900">#{receipt.orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">付款方式</span>
                  <span className="font-medium text-slate-900">{PAY_LABELS[receipt.paymentMethod]}</span>
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-dashed border-slate-300 pt-4 mb-4">
                <div className="grid grid-cols-12 text-xs font-semibold text-slate-400 uppercase tracking-wide pb-2">
                  <span className="col-span-7">商品</span>
                  <span className="col-span-2 text-center">数量</span>
                  <span className="col-span-3 text-right">售价</span>
                </div>
                {receipt.items.map((item, idx) => (
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

              {/* Total */}
              <div className="border-t-2 border-slate-800 pt-4 flex justify-between items-center mb-6">
                <span className="font-bold text-lg text-slate-900">总计</span>
                <span className="font-bold text-2xl text-blue-600">RM {receipt.totalAmount.toFixed(2)}</span>
              </div>

              {/* Footer — warranty clauses */}
              <div className="text-center border-t border-dashed border-slate-300 pt-4 mb-5">
                <p className="font-bold text-xs text-slate-600 mb-1">Thank you for shopping with us!</p>
                {receipt.showWarranty && receipt.warrantyText && (
                  <p className="text-xs text-slate-400 mt-1">{receipt.warrantyText}</p>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => window.print()}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  <Printer size={18} />
                  打印收据
                </button>
                <button
                  onClick={() => { setModal('none'); setReceipt(null); }}
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

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-6">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl">
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
            <h3 className="text-white font-semibold text-lg">{title}</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}


