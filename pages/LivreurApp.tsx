
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Map as MapIcon, 
  ClipboardList, 
  Wallet, 
  Bell, 
  Navigation2, 
  CheckCircle2, 
  Loader2, 
  Compass, 
  MapPin,
  Clock,
  Banknote,
  LogOut,
  // Added missing AlertCircle import
  AlertCircle
} from 'lucide-react';
import { Profile, OrderStatus } from '../types';

interface LivreurAppProps {
  profile: Profile;
}

const LivreurApp: React.FC<LivreurAppProps> = ({ profile }) => {
  const [isOnline, setIsOnline] = useState(profile.is_online);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const trackInterval = useRef<any>(null);

  useEffect(() => {
    fetchOrders();
    const channel = supabase.channel('livreur-realtime-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchOrders();
      })
      .subscribe();

    if (isOnline) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => { 
      supabase.removeChannel(channel); 
      stopTracking();
    };
  }, [isOnline]);

  const startTracking = () => {
    console.log("Démarrage du tracking GPS...");
    const updateLocation = () => {
      if (!navigator.geolocation) return;
      
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        console.log(`Mise à jour GPS: ${latitude}, ${longitude}`);
        
        // Mise à jour de la position dans Supabase (Format PostGIS POINT(lng lat))
        const { error } = await supabase
          .from('profiles')
          .update({ 
            last_location: `POINT(${longitude} ${latitude})`,
            is_online: true 
          })
          .eq('id', profile.id);
          
        if (error) console.error("Erreur mise à jour position:", error);
      }, (err) => {
        console.error("Erreur Géolocalisation:", err);
      }, { enableHighAccuracy: true });
    };

    updateLocation();
    // Mise à jour toutes le 15 secondes pour économiser la batterie tout en restant fluide
    trackInterval.current = setInterval(updateLocation, 15000);
  };

  const stopTracking = () => {
    if (trackInterval.current) {
      clearInterval(trackInterval.current);
      trackInterval.current = null;
    }
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
    await supabase
      .from('orders')
      .update({ status: status, livreur_id: profile.id })
      .eq('id', orderId);
  };

  const openNavigation = (order: any) => {
    // Si on a des coordonnées réelles dans l'ordre, on les utilise
    let dest = order.delivery_address;
    if (order.delivery_location) {
        const coords = order.delivery_location.match(/-?\d+\.?\d*/g);
        if (coords && coords.length >= 2) {
            dest = `${coords[1]},${coords[0]}`; // Lat,Lng pour Google Maps
        }
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
    window.open(url, '_blank');
  };

  const toggleOnline = async () => {
    const next = !isOnline;
    setIsOnline(next);
    await supabase.from('profiles').update({ is_online: next }).eq('id', profile.id);
  };

  return (
    <div className="flex justify-center items-center py-10 bg-gray-100 min-h-screen">
      <div className="w-[375px] h-[812px] bg-gray-50 rounded-[40px] shadow-2xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col">
        
        {/* Header */}
        <div className="bg-white px-6 pt-12 pb-6 border-b flex justify-between items-center shadow-sm">
          <div>
            <h2 className="text-lg font-black text-gray-900 leading-tight">Bonjour {profile.full_name.split(' ')[0]}</h2>
            <p className={`text-[10px] font-black uppercase tracking-widest ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
              {isOnline ? '● En ligne' : '○ Hors-ligne'}
            </p>
          </div>
          <button onClick={toggleOnline} className={`w-14 h-8 rounded-full transition-all flex items-center px-1 shadow-inner ${isOnline ? 'bg-emerald-500' : 'bg-gray-300'}`}>
            <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform transform ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Status Area */}
        <div className="p-4">
           {isOnline ? (
             <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 text-[11px] font-black flex items-center gap-3 animate-in slide-in-from-top-4">
               <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-sm">
                 <Compass size={18} className="animate-spin-slow" />
               </div>
               <div>
                 <p className="uppercase tracking-widest">Tracking Actif</p>
                 <p className="text-[10px] opacity-70">Votre position est partagée</p>
               </div>
             </div>
           ) : (
             <div className="bg-orange-50 text-orange-700 p-4 rounded-2xl border border-orange-100 text-[11px] font-black flex items-center gap-3">
               <div className="w-8 h-8 bg-orange-200 rounded-lg flex items-center justify-center text-orange-600">
                 {/* AlertCircle is now imported and correctly used */}
                 <AlertCircle size={18} />
               </div>
               <div>
                 <p className="uppercase tracking-widest">Mode Invisible</p>
                 <p className="text-[10px] opacity-70">Connectez-vous pour recevoir</p>
               </div>
             </div>
           )}
        </div>

        {/* Orders List */}
        <div className="flex-1 px-6 pb-6 overflow-y-auto custom-scrollbar space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-black text-gray-400 text-[10px] uppercase tracking-widest">Missions disponibles</h3>
            <button onClick={fetchOrders} className="text-[10px] font-bold text-blue-600 uppercase">Actualiser</button>
          </div>
          
          {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').map(order => (
            <div key={order.id} className={`bg-white p-5 rounded-[32px] border transition-all shadow-sm ${
              order.status === 'ARRIVED' ? 'border-emerald-200 bg-emerald-50/30 ring-4 ring-emerald-50' : 'border-gray-100'
            }`}>
              <div className="flex justify-between items-start mb-4">
                <span className={`text-[9px] font-black px-3 py-1 rounded-lg uppercase tracking-widest shadow-sm ${
                  order.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 
                  order.status === 'ARRIVED' ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
                }`}>
                  {order.status === 'ARRIVED' ? 'A destination' : order.status}
                </span>
                <span className="font-black text-gray-900 text-lg">{order.total_amount} F</span>
              </div>
              
              <div className="space-y-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-50 rounded-xl text-gray-400"><MapPin size={16} /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse</p>
                    <p className="text-xs font-bold text-gray-900 leading-tight">{order.delivery_address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Banknote size={16} /></div>
                  <div>
                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Paiement</p>
                    <p className="text-xs font-bold text-emerald-800 italic">Espèces à l'arrivée</p>
                  </div>
                </div>
              </div>
              
              <div className="flex gap-2">
                {order.status === 'PENDING' && (
                  <button 
                    onClick={() => updateOrderStatus(order.id, OrderStatus.ASSIGNED)} 
                    disabled={!isOnline}
                    className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs hover:bg-black transition-all active:scale-95 disabled:opacity-30"
                  >
                    Accepter la mission
                  </button>
                )}
                {order.status === 'ASSIGNED' && (
                  <button onClick={() => updateOrderStatus(order.id, OrderStatus.IN_PROGRESS)} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-blue-100">
                    Démarrer le trajet
                  </button>
                )}
                {order.status === 'IN_PROGRESS' && (
                  <>
                    <button onClick={() => openNavigation(order)} className="p-4 bg-gray-100 text-gray-900 rounded-2xl border border-gray-200">
                      <Navigation2 size={20} />
                    </button>
                    <button onClick={() => updateOrderStatus(order.id, OrderStatus.ARRIVED)} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-emerald-100">
                      Signaler Arrivée
                    </button>
                  </>
                )}
                {order.status === 'ARRIVED' && (
                  <div className="flex-1 py-4 text-center bg-white border-2 border-dashed border-emerald-200 rounded-2xl flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">En attente du client</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED').length === 0 && (
            <div className="py-20 text-center opacity-20">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={40} />
              </div>
              <p className="font-black text-sm uppercase tracking-widest">Rien à signaler</p>
            </div>
          )}
        </div>

        {/* Bottom Nav */}
        <div className="bg-white h-24 border-t flex justify-around items-center px-6 pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col items-center gap-1.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl shadow-sm"><ClipboardList size={22} /></div>
            <span className="text-[9px] font-black uppercase tracking-tighter">Missions</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 opacity-30 grayscale">
            <div className="p-2"><Wallet size={22} /></div>
            <span className="text-[9px] font-black uppercase tracking-tighter">Revenus</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 opacity-30 grayscale">
            <div className="p-2"><MapIcon size={22} /></div>
            <span className="text-[9px] font-black uppercase tracking-tighter">Carte</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LivreurApp;
