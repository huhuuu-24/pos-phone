export type ProductCategory = 'phone' | 'accessory' | 'service';

export interface Product {
  id?: number;
  category: ProductCategory;
  brand: string;
  model: string;
  color: string;
  config: string;
  barcode: string;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  createdAt: string;
}

export interface ProductWithStock extends Product {
  stock: number;
}

export interface IMEIRecord {
  id?: number;
  imei: string;
  productId: number;
  status: 'available' | 'sold';
  orderId?: number;
  soldAt?: string;
}

export interface OrderItem {
  productId: number;
  category: ProductCategory;
  imeiId: number | null;
  imei: string;
  brand: string;
  model: string;
  color: string;
  config: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
}

export interface Order {
  id?: number;
  items: OrderItem[];
  paymentMethod: 'cash' | 'duitnow' | 'card';
  totalAmount: number;
  totalProfit: number;
  createdAt: string;
  showWarranty?: boolean;
  warrantyText?: string;
}

export type View = 'pos' | 'inventory' | 'reports' | 'backup';
export type PaymentMethod = 'cash' | 'duitnow' | 'card';
