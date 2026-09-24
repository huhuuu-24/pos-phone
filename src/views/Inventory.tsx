import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  X,
  ChevronRight,
  Tag,
  Hash,
  Package,
  AlertCircle,
  CheckCircle,
  Smartphone,
  Headphones,
  Wrench,
} from 'lucide-react';

import {
  getAllProductsWithStock,
  addProduct,
  getIMEIsByProduct,
  addIMEI,
  deleteIMEI,
  adjustStock,
  deleteProduct,
  updateProduct,
} from '@/lib/db';

import { CATEGORY_LABELS } from '@/lib/db';

import type {
  ProductWithStock,
  IMEIRecord,
  ProductCategory,
} from '@/types';

type Panel = 'list' | 'add-product' | 'product-detail';

const COLORS = [
  '黑色',
  '白色',
  '蓝色',
  '绿色',
  '紫色',
  '金色',
  '银色',
  '红色',
  '其他',
];

const CONFIGS = [
  '64GB',
  '128GB',
  '256GB',
  '512GB',
  '1TB',
  '其他',
];

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
  const [selected, setSelected] =
    useState<ProductWithStock | null>(null);

  const [stockQty, setStockQty] = useState('1');

  const [editCostPrice, setEditCostPrice] = useState('');
  const [editSellingPrice, setEditSellingPrice] = useState('');

  const [imeis, setImeis] = useState<IMEIRecord[]>([]);
  const [newImei, setNewImei] = useState('');

  const [toast, setToast] = useState<{
    msg: string;
    ok: boolean;
  } | null>(null);

  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    sku: '',
    category: 'phone' as ProductCategory,
    brand: '',
    model: '',
    color: COLORS[0],
    config: CONFIGS[1],
    barcode: '',
    costPrice: '',
    sellingPrice: '',
    stockQty: '',
  });

  const loadProducts = useCallback(async () => {
    const all = await getAllProductsWithStock();

    setProducts(
      all.sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
    );
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });

    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const openProduct = async (product: ProductWithStock) => {
    setSelected(product);

    setEditCostPrice(product.costPrice.toString());
    setEditSellingPrice(product.sellingPrice.toString());
    setStockQty('1');

    if (product.category === 'phone') {
      const all = await getIMEIsByProduct(product.id!);

      setImeis(
        all.sort(
          (a, b) => (b.id ?? 0) - (a.id ?? 0)
        )
      );
    } else {
      setImeis([]);
    }

    setPanel('product-detail');
  };

  const handleAddProduct = async () => {
    if (
      !form.brand.trim() ||
      !form.model.trim() ||
      !form.costPrice ||
      !form.sellingPrice
    ) {
      showToast('请填写所有必填字段。', false);
      return;
    }

    const costPrice = parseFloat(form.costPrice);
    const sellingPrice = parseFloat(form.sellingPrice);

    if (
      Number.isNaN(costPrice) ||
      Number.isNaN(sellingPrice)
    ) {
      showToast(
        '进货价和售价必须是数字。',
        false
      );
      return;
    }

    const isPhone = form.category === 'phone';

    const stockQty = isPhone
      ? 0
      : form.stockQty
        ? parseInt(form.stockQty)
        : 0;

    await addProduct({
      sku: form.sku.trim(),
      category: form.category,
      brand: form.brand.trim(),
      model: form.model.trim(),
      color: isPhone ? form.color : '',
      config: isPhone ? form.config : '',
      barcode: form.barcode.trim(),
      costPrice,
      sellingPrice,
      stockQty,
      createdAt: new Date().toISOString(),
    });

    showToast('商品已成功添加！');

    setForm({
      sku: '',
      category: 'phone' as ProductCategory,
      brand: '',
      model: '',
      color: COLORS[0],
      config: CONFIGS[1],
      barcode: '',
      costPrice: '',
      sellingPrice: '',
      stockQty: '',
    });

    await loadProducts();

    setPanel('list');
  };

  const handleAddIMEI = async () => {
    if (!newImei.trim() || !selected) {
      return;
    }

    const code = newImei.trim();

    try {
      await addIMEI({
        imei: code,
        productId: selected.id!,
        status: 'available',
      });

      showToast(`串号 ${code} 已添加。`);

      setNewImei('');

      const all = await getIMEIsByProduct(
        selected.id!
      );

      setImeis(
        all.sort(
          (a, b) => (b.id ?? 0) - (a.id ?? 0)
        )
      );

      await loadProducts();

      setSelected((prev) =>
        prev
          ? {
              ...prev,
              stock: prev.stock + 1,
            }
          : prev
      );
    } catch {
      showToast(
        '该串号已存在，无法重复添加。',
        false
      );
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

    if (!selected) {
      return;
    }

    const all = await getIMEIsByProduct(
      selected.id!
    );

    setImeis(
      all.sort(
        (a, b) => (b.id ?? 0) - (a.id ?? 0)
      )
    );

    await loadProducts();

    const refreshed = (
      await getAllProductsWithStock()
    ).find(
      (p) => p.id === selected.id
    );

    if (refreshed) {
      setSelected(refreshed);
    }

    showToast('IMEI 已删除');
  };

  const handleStockChange = async (
    qty: number
  ) => {
    if (!selected) {
      return;
    }

    if (
      !Number.isInteger(qty) ||
      qty === 0
    ) {
      showToast(
        '请输入有效数量。',
        false
      );
      return;
    }

    if (
      qty < 0 &&
      Math.abs(qty) > selected.stock
    ) {
      showToast(
        '减少数量不能超过当前库存。',
        false
      );
      return;
    }

    await adjustStock(
      selected.id!,
      qty
    );

    await loadProducts();

    const refreshed = (
      await getAllProductsWithStock()
    ).find(
      (p) => p.id === selected.id
    );

    if (refreshed) {
      setSelected(refreshed);
    }

    showToast(
      qty > 0
        ? `库存增加 ${qty}`
        : `库存减少 ${Math.abs(qty)}`
    );

    setStockQty('1');
  };

  const handleSaveProduct = async () => {
    if (!selected) {
      return;
    }

    const costPrice = Number(editCostPrice);
    const sellingPrice =
      Number(editSellingPrice);

    if (
      Number.isNaN(costPrice) ||
      Number.isNaN(sellingPrice) ||
      costPrice < 0 ||
      sellingPrice < 0
    ) {
      showToast(
        '请输入有效的价格。',
        false
      );
      return;
    }

    const updatedProduct = {
      sku: selected.sku,
      id: selected.id,
      category: selected.category,
      brand: selected.brand,
      model: selected.model,
      color: selected.color,
      config: selected.config,
      barcode: selected.barcode,
      stockQty: selected.stockQty,
      createdAt: selected.createdAt,
      costPrice,
      sellingPrice,
    };

    await updateProduct(updatedProduct);

    showToast('商品资料已更新');

    await loadProducts();

    const refreshed = (
      await getAllProductsWithStock()
    ).find(
      (p) => p.id === selected.id
    );

    if (refreshed) {
      setSelected(refreshed);
    }
  };

  const handleDeleteProduct = async () => {
    if (!selected) {
      return;
    }

    const confirmed = window.confirm(
      `确定删除 ${selected.brand} ${selected.model} 吗？\n\n删除后商品资料、库存以及该商品的 IMEI 都会被删除。`
    );

    if (!confirmed) {
      return;
    }

    await deleteProduct(selected.id!);

    showToast('商品已删除');

    setSelected(null);

    await loadProducts();

    setPanel('list');
  };

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden relative">

      {toast && (
        <div
          className={`absolute top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${
            toast.ok
              ? 'bg-green-600'
              : 'bg-red-600'
          }`}
        >
          {toast.ok ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}

          <span className="text-sm font-medium">
            {toast.msg}
          </span>
        </div>
      )}

      {/* 左边商品列表 */}
      <div className="w-80 border-r border-slate-800 flex flex-col bg-slate-950">

        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              库存管理
            </h1>

            <p className="text-slate-500 text-sm mt-1">
              共 {products.length} 个商品
            </p>
          </div>

          <button
            onClick={() =>
              setPanel('add-product')
            }
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 flex items-center justify-center transition-all"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">

          <div className="mb-4">
            <input
              type="text"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="搜索编号、品牌、型号、条码"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {products.length === 0 ? (
            <div className="text-center text-slate-600 py-16">
              <Package
                size={40}
                className="mx-auto mb-3 opacity-40"
              />

              <p>暂无商品</p>

              <p className="text-sm mt-1">
                点击右上角 + 添加商品
              </p>
            </div>
          ) : (
            <div className="space-y-2">

              {products
                .filter((product) => {
                  const q =
                    search.toLowerCase();

                  return (
                    (product.sku ?? '')
                      .toLowerCase()
                      .includes(q) ||
                    product.brand
                      .toLowerCase()
                      .includes(q) ||
                    product.model
                      .toLowerCase()
                      .includes(q) ||
                    (product.barcode ?? '')
                      .toLowerCase()
                      .includes(q)
                  );
                })
                .map((product) => (
                  <button
                    key={product.id}
                    onClick={() =>
                      openProduct(product)
                    }
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      selected?.id ===
                      product.id
                        ? 'bg-blue-500/10 border-blue-500/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center gap-2 mb-1">

                          <span className="text-white font-semibold truncate">
                            {product.sku
                              ? `[${product.sku}] `
                              : ''}
                            {product.brand}{' '}
                            {product.model}
                          </span>

                        </div>

                        <div className="flex items-center gap-2">

                          <span
                            className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${
                              CATEGORY_BADGE[
                                product.category
                              ]
                            }`}
                          >
                            {
                              CATEGORY_ICONS[
                                product.category
                              ]
                            }

                            {
                              CATEGORY_LABELS[
                                product.category
                              ]
                            }
                          </span>

                          {product.category ===
                            'phone' && (
                            <span className="text-xs text-slate-500">
                              {product.color} ·{' '}
                              {product.config}
                            </span>
                          )}

                        </div>

                      </div>

                      <div className="text-right shrink-0">

                        <p
                          className={`font-bold ${
                            product.stock > 0
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {product.stock}
                        </p>

                        <p className="text-xs text-slate-600">
                          库存
                        </p>

                      </div>

                    </div>

                    <div className="flex items-center justify-between mt-3">

                      <span className="text-blue-400 text-sm font-semibold">
                        RM{' '}
                        {product.sellingPrice.toFixed(
                          2
                        )}
                      </span>

                      <ChevronRight
                        size={16}
                        className="text-slate-600"
                      />

                    </div>

                  </button>
                ))}

            </div>
          )}

        </div>

      </div>

      {/* 右边内容 */}
      <div className="flex-1 min-w-0 overflow-y-auto">

        {/* 新增商品 */}
        {panel === 'add-product' && (
          <div className="p-8 max-w-3xl min-h-full pb-12">

            <div className="flex items-center justify-between mb-8">

              <div>
                <h2 className="text-2xl font-bold">
                  添加商品
                </h2>

                <p className="text-slate-500 text-sm mt-1">
                  新增库存商品
                </p>
              </div>

              <button
                onClick={() =>
                  setPanel('list')
                }
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center"
              >
                <X size={20} />
              </button>

            </div>

            {/* 商品类型 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">

              <h3 className="font-semibold mb-4">
                商品类型
              </h3>

              <div className="grid grid-cols-3 gap-3">

                {(
                  [
                    'phone',
                    'accessory',
                    'service',
                  ] as ProductCategory[]
                ).map((category) => (
                  <button
                    key={category}
                    onClick={() =>
                      setForm({
                        ...form,
                        category,
                      })
                    }
                    className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                      form.category ===
                      category
                        ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                        : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    {
                      CATEGORY_ICONS[
                        category
                      ]
                    }

                    <span className="text-sm font-medium">
                      {
                        CATEGORY_LABELS[
                          category
                        ]
                      }
                    </span>
                  </button>
                ))}

              </div>

            </div>

            {/* 商品编号 */}
            <div className="mb-5">
              <label className="block text-sm text-slate-400 mb-2">
                商品编号
              </label>

              <input
                value={form.sku}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sku: e.target.value,
                  })
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500"
                placeholder="例如 PH0001"
              />
            </div>

            {/* 基本资料 */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">

              <h3 className="font-semibold mb-4">
                商品资料
              </h3>

              <div className="grid grid-cols-2 gap-4">

                <div>
                  <label className="text-slate-400 text-sm block mb-1">
                    品牌
                  </label>

                  <input
                    value={form.brand}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        brand:
                          e.target.value,
                      })
                    }
                    placeholder="例如 Apple"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-1">
                    型号 / 名称
                  </label>

                  <input
                    value={form.model}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        model:
                          e.target.value,
                      })
                    }
                    placeholder="例如 iPhone 15"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

              </div>

              {/* 手机专属 */}
              {form.category ===
                'phone' && (
                <div className="grid grid-cols-2 gap-4 mt-4">

                  <div>
                    <label className="text-slate-400 text-sm block mb-1">
                      颜色
                    </label>

                    <select
                      value={form.color}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          color:
                            e.target.value,
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white"
                    >
                      {COLORS.map(
                        (color) => (
                          <option
                            key={color}
                            value={color}
                          >
                            {color}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-slate-400 text-sm block mb-1">
                      容量
                    </label>

                    <select
                      value={form.config}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          config:
                            e.target.value,
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white"
                    >
                      {CONFIGS.map(
                        (config) => (
                          <option
                            key={config}
                            value={config}
                          >
                            {config}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                </div>
              )}

              {/* 配件 / 服务 */}
              {form.category !==
                'phone' && (
                <div className="grid grid-cols-2 gap-4 mt-4">

                  <div>
                    <label className="text-slate-400 text-sm block mb-1">
                      条码
                    </label>

                    <input
                      value={form.barcode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          barcode:
                            e.target.value,
                        })
                      }
                      placeholder="可选"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white"
                    />
                  </div>

                  <div>
                    <label className="text-slate-400 text-sm block mb-1">
                      初始库存
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={form.stockQty}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stockQty:
                            e.target.value,
                        })
                      }
                      placeholder="0"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white"
                    />
                  </div>

                </div>
              )}

              {/* 价格 */}
              <div className="grid grid-cols-2 gap-4 mt-4">

                <div>
                  <label className="text-slate-400 text-sm block mb-1">
                    进货价
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.costPrice}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        costPrice:
                          e.target.value,
                      })
                    }
                    placeholder="RM 0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white"
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-sm block mb-1">
                    售价
                  </label>

                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={
                      form.sellingPrice
                    }
                    onChange={(e) =>
                      setForm({
                        ...form,
                        sellingPrice:
                          e.target.value,
                      })
                    }
                    placeholder="RM 0.00"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-3 text-white"
                  />
                </div>

              </div>

            </div>

            <div className="flex gap-3 pb-8">

              <button
                onClick={() =>
                  setPanel('list')
                }
                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-semibold"
              >
                取消
              </button>

              <button
                onClick={handleAddProduct}
                className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold"
              >
                添加商品
              </button>

            </div>

          </div>
        )}

        {/* 商品详情 */}
        {panel === 'product-detail' &&
          selected && (
            <div className="p-8 min-h-full pb-12">

              <div className="flex items-start justify-between mb-8">

                <div>

                  <div className="flex items-center gap-3 mb-2">

                    <h2 className="text-white font-bold text-2xl">
                      {selected.brand}{' '}
                      {selected.model}
                    </h2>

                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1 ${
                        CATEGORY_BADGE[
                          selected.category
                        ]
                      }`}
                    >
                      {
                        CATEGORY_ICONS[
                          selected.category
                        ]
                      }

                      {
                        CATEGORY_LABELS[
                          selected.category
                        ]
                      }
                    </span>

                  </div>

                  {selected.category ===
                  'phone' ? (
                    <p className="text-slate-400 mt-1">
                      {selected.color} ·{' '}
                      {selected.config}
                    </p>
                  ) : (
                    <p className="text-slate-400 mt-1">
                      {selected.barcode
                        ? `条码: ${selected.barcode}`
                        : '无条码'}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mt-3">

                    <span className="text-slate-400 text-sm">
                      进货价：
                      <span className="text-white ml-1">
                        RM{' '}
                        {selected.costPrice.toFixed(
                          2
                        )}
                      </span>
                    </span>

                    <span className="text-slate-400 text-sm">
                      售价：
                      <span className="text-blue-400 font-semibold ml-1">
                        RM{' '}
                        {selected.sellingPrice.toFixed(
                          2
                        )}
                      </span>
                    </span>

                  </div>

                  {/* 修改价格 */}
                  <div className="grid grid-cols-2 gap-4 mt-4 max-w-xl">

                    <div>
                      <label className="text-slate-400 text-sm block mb-1">
                        修改进货价
                      </label>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          editCostPrice
                        }
                        onChange={(e) =>
                          setEditCostPrice(
                            e.target.value
                          )
                        }
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 text-sm block mb-1">
                        修改售价
                      </label>

                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={
                          editSellingPrice
                        }
                        onChange={(e) =>
                          setEditSellingPrice(
                            e.target.value
                          )
                        }
                        className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-white"
                      />
                    </div>

                  </div>

                  <button
                    onClick={
                      handleSaveProduct
                    }
                    className="mt-4 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl font-semibold"
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

              {/* 手机 IMEI */}
              {selected.category ===
                'phone' && (
                <>
                  <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-5 mb-6">

                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Hash
                        size={18}
                        className="text-blue-400"
                      />

                      录入 IMEI 串号
                    </h3>

                    <div className="flex gap-3">

                      <input
                        value={newImei}
                        onChange={(e) =>
                          setNewImei(
                            e.target.value
                          )
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter'
                          ) {
                            handleAddIMEI();
                          }
                        }}
                        placeholder="输入或扫描 IMEI 串号，按 Enter 添加..."
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />

                      <button
                        onClick={
                          handleAddIMEI
                        }
                        disabled={
                          !newImei.trim()
                        }
                        className="px-5 bg-blue-500 hover:bg-blue-400 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl"
                      >
                        添加
                      </button>

                    </div>

                  </div>

                  <div>

                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Tag
                        size={18}
                        className="text-blue-400"
                      />

                      串号记录（
                      {imeis.length} 条）
                    </h3>

                    {imeis.length ===
                    0 ? (
                      <div className="text-center text-slate-600 py-12">
                        <p>
                          暂无串号记录
                        </p>

                        <p className="text-sm mt-1">
                          请在上方录入 IMEI
                          串号
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">

                        {imeis.map(
                          (imei) => (
                            <div
                              key={
                                imei.id
                              }
                              className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                                imei.status ===
                                'available'
                                  ? 'bg-slate-800/50 border-slate-700/50'
                                  : 'bg-slate-900/50 border-slate-800 opacity-60'
                              }`}
                            >

                              <span className="font-mono text-sm text-white">
                                {
                                  imei.imei
                                }
                              </span>

                              <div className="flex items-center gap-2">

                                <span
                                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                                    imei.status ===
                                    'available'
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-slate-600/40 text-slate-400'
                                  }`}
                                >
                                  {imei.status ===
                                  'available'
                                    ? '在库'
                                    : '已售出'}
                                </span>

                                {imei.status ===
                                  'available' && (
                                  <button
                                    onClick={() =>
                                      handleDeleteIMEI(
                                        imei.id!
                                      )
                                    }
                                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 rounded-lg text-white"
                                  >
                                    删除
                                  </button>
                                )}

                              </div>

                            </div>
                          )
                        )}

                      </div>
                    )}

                  </div>
                </>
              )}

              {/* 配件 / 服务库存 */}
              {selected.category !==
                'phone' && (
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6">

                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <Package
                      size={18}
                      className="text-blue-400"
                    />

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
                        RM{' '}
                        {(
                          selected.sellingPrice -
                          selected.costPrice
                        ).toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-slate-400 text-xs mb-1">
                        条形码
                      </p>

                      <p className="text-white font-mono text-sm mt-1">
                        {selected.barcode ||
                          '未设置'}
                      </p>
                    </div>

                  </div>

                  <div className="flex gap-3 mt-6 items-center">

                    <input
                      type="number"
                      min="1"
                      value={stockQty}
                      onChange={(e) =>
                        setStockQty(
                          e.target.value
                        )
                      }
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter'
                        ) {
                          handleStockChange(
                            Number(
                              stockQty
                            )
                          );
                        }
                      }}
                      placeholder="数量"
                      className="w-28 px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 text-white"
                    />

                    <button
                      onClick={() =>
                        handleStockChange(
                          Number(
                            stockQty
                          )
                        )
                      }
                      className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-xl font-semibold"
                    >
                      + 增加库存
                    </button>

                    <button
                      onClick={() =>
                        handleStockChange(
                          -Number(
                            stockQty
                          )
                        )
                      }
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-xl font-semibold"
                    >
                      - 减少库存
                    </button>

                  </div>

                </div>
              )}

              {/* 删除商品 */}
              <div className="mt-6 pb-8">

                <button
                  onClick={
                    handleDeleteProduct
                  }
                  className="px-5 py-3 bg-red-600 hover:bg-red-500 rounded-xl font-semibold text-white"
                >
                  删除商品
                </button>

              </div>

            </div>
          )}

        {/* 默认空白状态 */}
        {panel === 'list' && (
          <div className="h-full flex items-center justify-center">

            <div className="text-center">

              <Package
                size={56}
                className="mx-auto mb-4 text-slate-700"
              />

              <h2 className="text-xl font-semibold text-slate-500">
                选择一个商品
              </h2>

              <p className="text-slate-600 text-sm mt-2">
                或点击左上角 + 添加商品
              </p>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
