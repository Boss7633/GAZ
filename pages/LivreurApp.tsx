
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Map as MapIcon, 
  ClipboardList, 
  Wallet, 
  Navigation2, 
  Loader2, 
  Compass, 
  MapPin,
  Banknote,
  AlertCircle,
  Truck,
  Phone
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
  
  const trackInterval = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const mapMarkersRef = useRef<any>({ driver: null, client: null, route: null });

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

  // Initialisation et mise à jour de la carte Leaflet
  useEffect(() => {
    if (activeTab === 'carte' && mapContainerRef.current && !mapInstanceRef.current) {
      const L = (window as any).L;
      if (!L) return;

      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(currentPos || [5.3484, -4.0305], 15);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current);
    }

    if (activeTab === 'carte' && mapInstanceRef.current) {
      updateMapMarkers();
    }
  }, [activeTab, orders, currentPos]);

  const parseLocation = (loc: any): [number, number] | null => {
    if (!loc) return null;
    if (typeof loc === 'string') {
      const coords = loc.match(/-?\d+\.?\d*/g);
      return coords && coords.length >= 2 ? [parseFloat(coords[1]), parseFloat(coords[0])] : null;
    }
    return null;
  };

  const updateMapMarkers = () => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    // Nettoyage
    if (mapMarkersRef.current.driver) map.removeLayer(mapMarkersRef.current.driver);
    if (mapMarkersRef.current.client) map.removeLayer(mapMarkersRef.current.client);
    if (mapMarkersRef.current.route) map.removeLayer(mapMarkersRef.current.route);

    const activeOrder = orders.find(o => o.status === 'IN_PROGRESS' || o.status === 'ARRIVED');
    const points: any[] = [];

    // Marqueur Livreur
    if (currentPos) {
      mapMarkersRef.current.driver = L.marker(currentPos, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="bg-blue-600 p-2 rounded-full border-2 border-white text-white shadow-lg animate-pulse"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon></svg></div>`,
          iconSize: [32, 32], iconAnchor: [16, 16]
        })
      }).addTo(map);
      points.push(currentPos);
    }

    // Marqueur Client & Itinéraire
    if (activeOrder) {
      const clientPos = parseLocation(activeOrder.delivery_location);
      if (clientPos) {
        mapMarkersRef.current.client = L.marker(clientPos, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="bg-orange-500 p-2 rounded-full border-2 border-white text-white shadow-lg"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
          })
        }).addTo(map);
        points.push(clientPos);

        if (currentPos) {
          mapMarkersRef.current.route = L.polyline([currentPos, clientPos], {
            color: '#2563eb',
            weight: 4,
            opacity: 0.6,
            dashArray: '10, 10'
          }).addTo(map);
        }
      }
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  };

  const startTracking = () => {
    const updateLocation = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos([latitude, longitude]);
        await supabase.from('profiles').update({ 
          last_location: `POINT(${longitude} ${latitude})`,
          is_online: true 
        }).eq('id', profile.id);
      }, null, { enableHighAccuracy: true });
    };
    updateLocation();
    trackInterval.current = setInterval(updateLocation, 10000);
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
    const { error } = await supabase
      .from('orders')
      .update({ status: status, livreur_id: profile.id })
      .eq('id', orderId);
    if (!error && status === OrderStatus.IN_PROGRESS) {
      setActiveTab('carte');
    }
  };

  return (
    <div className="flex justify-center items-center py-10 bg-gray-100 min-h-screen">
      <div className="w-[375px] h-[812px] bg-gray-50 rounded-[40px] shadow-2xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col font-sans">
        
        {/* Top Header */}
        <div className="bg-white px-6 pt-12 pb-4 border-b flex justify-between items-center z-20">
          <div>
            <h2 className="text-lg font-black text-gray-900">GazFlow Driver</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {isOnline ? 'Connecté' : 'Déconnecté'}
              </span>
            </div>
          </div>
          <button onClick={async () => {
            const next = !isOnline;
            setIsOnline(next);
            await supabase.from('profiles').update({ is_online: next }).eq('id', profile.id);
          }} className={`w-12 h-6 rounded-full p-1 transition-all ${isOnline ? 'bg-emerald-500' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-gray-50 flex flex-col">
          {activeTab === 'carte' ? (
            <div className="absolute inset-0 z-0">
              <div ref={mapContainerRef} className="w-full h-full" />
              
              {/* Overlay Navigation Info */}
              {orders.find(o => o.status === 'IN_PROGRESS') && (
                <div className="absolute top-4 left-4 right-4 z-10">
                  <div className="bg-white p-4 rounded-3xl shadow-xl border border-blue-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Navigation2 size={24} className="animate-bounce" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">En route vers client</p>
                      <p className="font-bold text-gray-900 truncate max-w-[180px]">
                        {orders.find(o => o.status === 'IN_PROGRESS')?.delivery_address}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'revenus' ? (
             <div className="p-8 text-center mt-20 opacity-30">
                <Wallet size={64} className="mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest italic">Module en développement</p>
             </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Welcome Alert */}
              {!isOnline && (
                <div className="bg-orange-50 border border-orange-100 p-5 rounded-[32px] flex gap-4 items-start">
                   <div className="p-3 bg-white rounded-2xl text-orange-500 shadow-sm"><AlertCircle size={24}/></div>
                   <div>
                     <p className="font-black text-orange-900 text-sm">Mode Invisible</p>
                     <p className="text-[11px] text-orange-700 leading-tight mt-1">Activez votre profil pour voir les commandes disponibles autour de vous.</p>
                   </div>
                </div>
              )}

              {/* Order List */}
              {orders.filter(o => o.status !== 'DELIVERED').map(order => (
                <div key={order.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 transition-all hover:shadow-md">
                   <div className="flex justify-between items-start mb-6">
                     <div className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ${
                       order.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 'bg-blue-600 text-white'
                     }`}>
                       {order.status}
                     </div>
                     <span className="font-black text-gray-900 text-xl">{order.total_amount} F</span>
                   </div>

                   <div className="space-y-4 mb-8">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-gray-50 rounded-xl text-gray-400"><MapPin size={16}/></div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Adresse Livraison</p>
                          <p className="text-xs font-bold text-gray-900 leading-tight">{order.delivery_address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Banknote size={16}/></div>
                        <p className="text-xs font-black text-emerald-700 uppercase tracking-widest">Paiement Espèces</p>
                      </div>
                   </div>

                   <div className="flex gap-2">
                     {order.status === 'PENDING' ? (
                        <button 
                          onClick={() => updateOrderStatus(order.id, OrderStatus.ASSIGNED)}
                          disabled={!isOnline}
                          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs active:scale-95 disabled:opacity-20 transition-all"
                        >
                          Accepter Mission
                        </button>
                     ) : order.status === 'ASSIGNED' ? (
                        <button 
                          onClick={() => updateOrderStatus(order.id, OrderStatus.IN_PROGRESS)}
                          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-blue-100 active:scale-95 transition-all"
                        >
                          Démarrer Trajet
                        </button>
                     ) : (
                        <div className="flex gap-2 w-full">
                           <button 
                              onClick={() => setActiveTab('carte')}
                              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2"
                           >
                              <Navigation2 size={16} /> GPS
                           </button>
                           <button 
                              onClick={() => updateOrderStatus(order.id, OrderStatus.ARRIVED)}
                              className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-emerald-100"
                           >
                              Arrivé
                           </button>
                        </div>
                     )}
                   </div>
                </div>
              ))}
              
              {orders.length === 0 && (
                <div className="py-20 text-center opacity-20">
                  <ClipboardList size={48} className="mx-auto mb-2" />
                  <p className="font-black uppercase tracking-widest text-sm">En attente de commandes</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Bottom Bar */}
        <div className="bg-white h-24 border-t border-gray-100 flex justify-around items-center px-6 pb-6 shadow-[0_-10px_20px_rgba(0,0,0,0.02)] z-30">
           <button onClick={() => setActiveTab('missions')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'missions' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}>
              <ClipboardList size={22} />
              <span className="text-[9px] font-black uppercase">Missions</span>
           </button>
           <button onClick={() => setActiveTab('carte')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'carte' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}>
              <MapIcon size={22} />
              <span className="text-[9px] font-black uppercase">Carte</span>
           </button>
           <button onClick={() => setActiveTab('revenus')} className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'revenus' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}>
              <Wallet size={22} />
              <span className="text-[9px] font-black uppercase">Revenus</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default LivreurApp;
