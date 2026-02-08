
export enum OrderStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ARRIVED = 'ARRIVED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentMethod {
  WAVE = 'WAVE',
  ORANGE_MONEY = 'ORANGE_MONEY',
  MTN_MOMO = 'MTN_MOMO',
  CASH = 'CASH'
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: 'CLIENT' | 'LIVREUR' | 'ADMIN';
  region_id?: string;
  is_online: boolean;
  kyc_status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  wallet_balance: number;
  rating: number;
  avatar_url?: string;
}

export interface Order {
  id: string;
  client_id: string;
  livreur_id?: string;
  region_id: string;
  depot_id?: string;
  status: OrderStatus;
  items: any;
  total_amount: number;
  delivery_fee: number;
  commission_driver?: number;
  payment_method: PaymentMethod;
  delivery_address: string;
  delivery_location?: { lat: number; lng: number };
  otp_code?: string;
  photo_url?: string;
  created_at: string;
}

export interface Inventory {
  depot_id: string;
  product_id: number;
  quantity: number;
  min_threshold: number;
}
