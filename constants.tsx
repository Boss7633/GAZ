
import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Users, 
  Package, 
  Settings, 
  Smartphone,
  Navigation as NavIcon,
  TrendingUp,
  ShieldCheck,
  Zap
} from 'lucide-react';

export const COLORS = {
  primary: '#059669', // Emerald
  secondary: '#ea580c', // Orange
  accent: '#2563eb', // Blue
  danger: '#dc2626',
};

export const NAVIGATION = [
  { name: 'Tableau de bord', icon: <LayoutDashboard size={20} />, path: 'dashboard' },
  { name: 'App Client (Démo)', icon: <Smartphone size={20} />, path: 'client-app' },
  { name: 'App Livreur (Démo)', icon: <NavIcon size={20} />, path: 'driver-app' },
  { name: 'Commandes', icon: <ShoppingCart size={20} />, path: 'orders' },
  { name: 'Livreurs & GPS', icon: <Truck size={20} />, path: 'delivery' },
  { name: 'Utilisateurs', icon: <Users size={20} />, path: 'users' },
  { name: 'Stocks & Dépôts', icon: <Package size={20} />, path: 'inventory' },
  { name: 'Paramètres', icon: <Settings size={20} />, path: 'settings' },
];

export const MOCK_ORDERS = [
  { id: 'ORD-001', client: 'Moussa Diop', status: 'En cours', total: 12500, type: '12.5kg', method: 'Wave' },
  { id: 'ORD-002', client: 'Awa Kone', status: 'Livré', total: 6000, type: '6kg', method: 'Orange Money' },
  { id: 'ORD-003', client: 'Jean Dupont', status: 'En attente', total: 15000, type: '15kg', method: 'Espèces' },
  { id: 'ORD-004', client: 'Saliou Ndiaye', status: 'Assigné', total: 12500, type: '12.5kg', method: 'MTN MoMo' },
  { id: 'ORD-005', client: 'Fatou Sow', status: 'Livré', total: 6000, type: '6kg', method: 'Wave' },
];
