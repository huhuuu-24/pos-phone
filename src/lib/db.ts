import type { Product, IMEIRecord, Order, ProductWithStock, ProductCategory } from '@/types';

const DB_NAME = 'PhoneStorePOS';
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('products')) {
        const ps = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        ps.createIndex('model', 'model', { unique: false });
        ps.createIndex('brand', 'brand', { unique: false });
        ps.createIndex('barcode', 'barcode', { unique: false });
        ps.createIndex('category', 'category', { unique: false });
      }
      if (!db.objectStoreNames.contains('imeis')) {
        const is = db.createObjectStore('imeis', { keyPath: 'id', autoIncrement: true });
        is.createIndex('imei', 'imei', { unique: true });
        is.createIndex('productId', 'productId', { unique: false });
        is.createIndex('status', 'status', { unique: false });
      }
      if (!db.objectStoreNames.contains('orders')) {
        const os = db.createObjectStore('orders', { keyPath: 'id', autoIncrement: true });
        os.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAll<T>(store: IDBObjectStore): Promise<T[]> {
  return request<T[]>(store.getAll());
}

// ─── Products ──────────────────────────────────────────────────────────────

export async function addProduct(product: Omit<Product, 'id'>): Promise<number> {
  const db = await openDB();
  const tx = db.transaction('products', 'readwrite');
  const id = await request<number>(tx.objectStore('products').add(product));
  return id;
}

export async function getAllProducts(): Promise<Product[]> {
  const db = await openDB();
  const tx = db.transaction('products', 'readonly');
  return getAll<Product>(tx.objectStore('products'));
}

export async function getProductById(id: number): Promise<Product | undefined> {
  const db = await openDB();
  const tx = db.transaction('products', 'readonly');
  return request<Product>(tx.objectStore('products').get(id));
}

export async function updateProduct(product: Product): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('products', 'readwrite');
  await request(tx.objectStore('products').put(product));
}

export async function findProductByBarcode(barcode: string): Promise<Product | undefined> {
  const db = await openDB();
  const tx = db.transaction('products', 'readonly');
  return request<Product>(tx.objectStore('products').index('barcode').get(barcode));
}

export async function getAllProductsWithStock(): Promise<ProductWithStock[]> {
  const [products, imeis] = await Promise.all([getAllProducts(), getAllIMEIs()]);
  return products.map((p) => {
    if (p.category === 'phone') {
      return { ...p, stock: imeis.filter((i) => i.productId === p.id && i.status === 'available').length };
    }
    return { ...p, stock: p.stockQty };
  });
}

// ─── IMEIs ─────────────────────────────────────────────────────────────────

export async function addIMEI(imei: Omit<IMEIRecord, 'id'>): Promise<number> {
  const db = await openDB();
  const tx = db.transaction('imeis', 'readwrite');
  return request<number>(tx.objectStore('imeis').add(imei));
}

export async function getAllIMEIs(): Promise<IMEIRecord[]> {
  const db = await openDB();
  const tx = db.transaction('imeis', 'readonly');
  return getAll<IMEIRecord>(tx.objectStore('imeis'));
}

export async function getIMEIsByProduct(productId: number): Promise<IMEIRecord[]> {
  const db = await openDB();
  const tx = db.transaction('imeis', 'readonly');
  return request<IMEIRecord[]>(tx.objectStore('imeis').index('productId').getAll(productId));
}

export async function getAvailableIMEIsByProduct(productId: number): Promise<IMEIRecord[]> {
  const all = await getIMEIsByProduct(productId);
  return all.filter((i) => i.status === 'available');
}

export async function findIMEIByCode(imeiCode: string): Promise<IMEIRecord | undefined> {
  const db = await openDB();
  const tx = db.transaction('imeis', 'readonly');
  return request<IMEIRecord>(tx.objectStore('imeis').index('imei').get(imeiCode));
}

export async function markIMEIsSold(imeiIds: number[], orderId: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('imeis', 'readwrite');
  const store = tx.objectStore('imeis');
  const soldAt = new Date().toISOString();
  await Promise.all(
    imeiIds.map(async (id) => {
      const record = await request<IMEIRecord>(store.get(id));
      if (record) {
        await request(store.put({ ...record, status: 'sold', orderId, soldAt }));
      }
    })
  );
}

// ─── Stock decrement for accessories/services ──────────────────────────────

export async function decrementStock(productId: number, qty: number): Promise<void> {
  const product = await getProductById(productId);
  if (!product) return;
  if (product.category !== 'phone' && product.stockQty > 0) {
    product.stockQty = Math.max(0, product.stockQty - qty);
    await updateProduct(product);
  }
}

// ─── Orders ────────────────────────────────────────────────────────────────

export async function addOrder(order: Omit<Order, 'id'>): Promise<number> {
  const db = await openDB();
  const tx = db.transaction('orders', 'readwrite');
  return request<number>(tx.objectStore('orders').add(order));
}

export async function getAllOrders(): Promise<Order[]> {
  const db = await openDB();
  const tx = db.transaction('orders', 'readonly');
  return getAll<Order>(tx.objectStore('orders'));
}

export async function getTodayOrders(): Promise<Order[]> {
  const orders = await getAllOrders();
  const today = new Date().toDateString();
  return orders.filter((o) => new Date(o.createdAt).toDateString() === today);
}

// ─── Category labels ───────────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  phone: '手机',
  accessory: '配件',
  service: '服务/维修',
  other: '其他'
};
