
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Map as MapIcon, 
  ClipboardList, 
  Wallet, 
  Navigation2, 
  Loader2, 
  MapPin,
  Banknote,
  AlertCircle,
  LocateFixed,
  History,
  CheckCircle2,
  Package
} from 'lucide-react';
import { Profile, OrderStatus } from '../types';

interface LivreurAppProps {
  profile: Profile;
}

const LivreurApp: React.FC<LivreurAppProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'missions' | 'carte' | 'revenus'>('missions');
  const [isOnline, setIsOnline] = useState(profile.is_online);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [walletBalance, setWalletBalance] = useState(profile.wallet_balance || 0);
  
  const trackInterval = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    fetchOrders();
    
    const channel = supabase.channel('livreur-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();

    if (isOnline) startTracking();
    
    return () => { 
      supabase.removeChannel(channel); 
      stopTracking();
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
    };
  }, [isOnline]);

  const startTracking = () => {
    if (!navigator.geolocation) return;
    const updateLocation = () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos([latitude, longitude]);
        // Mise à jour en base de données pour l'Admin et le Client
        await supabase.from('profiles').update({ 
          last_location: `SRID=4326;POINT(${longitude} ${latitude})`,
          is_online: true 
        }).eq('id', profile.id);
      }, null, { enableHighAccuracy: true });
    };
    updateLocation();
    trackInterval.current = setInterval(updateLocation, 8000); // Toutes les 8 secondes
  };

  const stopTracking = () => { 
    if (trackInterval.current) clearInterval(trackInterval.current); 
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, client:client_id(full_name, phone)')
      .or(`status.eq.PENDING,livreur_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status, livreur_id: profile.id }).eq('id', orderId);
    fetchOrders();
  };

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative">
        <div className="bg-white px-6 pt-12 pb-4 border-b flex justify-between items-center z-20 sticky top-0">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">GazFlow Drive</h2>
            <p className="text-[10px] font-black uppercase text-emerald-500">{isOnline ? 'En ligne - GPS Actif' : 'Hors-ligne'}</p>
          </div>
          <button onClick={() => {
            const next = !isOnline;
            setIsOnline(next);
            if (!next) stopTracking();
          }} className={`w-14 h-7 rounded-full p-1 flex items-center transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform ${isOnline ? 'translate-x-7' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-32">
          {orders.filter(o => o.status !== 'DELIVERED').map(order => (
            <div key={order.id} className="bg-white rounded-[32px] p-6 shadow-md border border-gray-100">
              <div className="flex justify-between items-start mb-6">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase">{order.status}</span>
                <span className="font-black text-gray-900 text-xl">{order.total_amount.toLocaleString()} F</span>
              </div>
              <p className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><MapPin size={16} className="text-emerald-500" /> {order.delivery_address}</p>
              
              <div className="flex gap-2">
                {order.status === 'PENDING' ? (
                  <button onClick={() => updateOrderStatus(order.id, OrderStatus.ASSIGNED)} className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black">Accepter</button>
                ) : (
                  <button onClick={() => updateOrderStatus(order.id, OrderStatus.ARRIVED)} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black">Arrivé sur place</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white h-24 border-t flex justify-around items-center px-8 pb-4 sticky bottom-0 z-30">
           <button onClick={() => setActiveTab('missions')} className={`flex flex-col items-center gap-1 ${activeTab === 'missions' ? 'text-emerald-600' : 'text-gray-300'}`}>
              <ClipboardList size={24} />
              <span className="text-[10px] font-black uppercase">Missions</span>
           </button>
           <button onClick={() => setActiveTab('revenus')} className={`flex flex-col items-center gap-1 ${activeTab === 'revenus' ? 'text-emerald-600' : 'text-gray-300'}`}>
              <Wallet size={24} />
              <span className="text-[10px] font-black uppercase">Gains</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default LivreurApp;
