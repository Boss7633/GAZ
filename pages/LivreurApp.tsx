
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Map as MapIcon, 
  ClipboardList, 
  Wallet, 
  Navigation2, 
  Loader2, 
  MapPin,
  Truck,
  Phone,
  ExternalLink,
  CheckCircle2
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
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const watchId = useRef<number | null>(null);

  useEffect(() => {
    fetchOrders();
    
    const channel = supabase.channel('livreur-ops')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();

    if (isOnline) {
      startTracking();
    } else {
      stopTracking();
    }
    
    return () => { 
      supabase.removeChannel(channel); 
      stopTracking();
      if (mapInstanceRef.current) mapInstanceRef.current.remove();
    };
  }, [isOnline]);

  useEffect(() => {
    if (activeTab === 'carte' && mapContainerRef.current) {
      setTimeout(() => initMap(), 100);
    }
  }, [activeTab]);

  const startTracking = () => {
    if (!navigator.geolocation) return;
    
    // watchPosition est bien meilleur que setInterval pour le temps réel
    watchId.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        console.log(`GPS Update: ${latitude}, ${longitude} (Accuracy: ${accuracy}m)`);
        
        setCurrentPos([latitude, longitude]);
        
        // Mise à jour immédiate en base de données
        await supabase.from('profiles').update({ 
          last_location: `SRID=4326;POINT(${longitude} ${latitude})`,
          is_online: true 
        }).eq('id', profile.id);
        
        if (activeTab === 'carte') updateMarkers();
      },
      (err) => console.error("GPS Error:", err),
      { 
        enableHighAccuracy: true, 
        maximumAge: 0, 
        timeout: 5000 
      }
    );
  };

  const stopTracking = () => { 
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, client:client_id(full_name, phone)')
      .or(`status.eq.PENDING,livreur_id.eq.${profile.id}`)
      .neq('status', 'DELIVERED')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const parseLocation = (loc: any): [number, number] | null => {
    if (!loc) return null;
    if (typeof loc === 'string') {
      const coords = loc.match(/-?\d+\.?\d*/g);
      return coords && coords.length >= 2 ? [parseFloat(coords[1]), parseFloat(coords[0])] : null;
    }
    if (loc.coordinates) return [loc.coordinates[1], loc.coordinates[0]];
    return null;
  };

  const initMap = () => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([5.3484, -4.0305], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current);
    markersLayerRef.current = L.featureGroup().addTo(mapInstanceRef.current);
    
    updateMarkers();
  };

  const updateMarkers = () => {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current || !mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();
    const points: any[] = [];

    // Ma position (Livreur)
    if (currentPos) {
      L.marker(currentPos, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="bg-blue-600 p-2 rounded-full border-2 border-white text-white shadow-lg animate-pulse"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="3"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg></div>`,
          iconSize: [28, 28], iconAnchor: [14, 14]
        })
      }).addTo(markersLayerRef.current);
      points.push(currentPos);
    }

    // Positions des clients actifs
    orders.filter(o => o.livreur_id === profile.id || o.status === 'PENDING').forEach(order => {
      const cPos = parseLocation(order.delivery_location);
      if (cPos) {
        L.marker(cPos, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="bg-emerald-600 p-2 rounded-full border-2 border-white text-white shadow-lg"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></div>`,
            iconSize: [34, 34], iconAnchor: [17, 34]
          })
        }).bindPopup(`<b>Client:</b> ${order.client?.full_name || 'En attente'}`).addTo(markersLayerRef.current);
        points.push(cPos);
      }
    });

    if (points.length > 0 && mapInstanceRef.current) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(points), { padding: [60, 60] });
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status, livreur_id: profile.id }).eq('id', orderId);
    fetchOrders();
  };

  const openInExternalMap = (order: any) => {
    const coords = parseLocation(order.delivery_location);
    if (coords) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${coords[0]},${coords[1]}`, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative overflow-hidden">
        <div className="bg-white/80 backdrop-blur-md px-6 pt-12 pb-4 border-b flex justify-between items-center z-20 sticky top-0">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">GazFlow Drive</h2>
            <p className={`text-[10px] font-black uppercase transition-colors ${isOnline ? 'text-emerald-500' : 'text-gray-400'}`}>
              {isOnline ? 'GPS Temps Réel Actif' : 'Mode Hors-ligne'}
            </p>
          </div>
          <button onClick={() => {
            const next = !isOnline;
            setIsOnline(next);
            if (!next) stopTracking();
          }} className={`w-14 h-7 rounded-full p-1 flex items-center transition-all duration-300 ${isOnline ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-gray-300'}`}>
            <div className={`w-5 h-5 bg-white rounded-full transition-transform duration-300 ${isOnline ? 'translate-x-7' : ''}`} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto relative">
          {activeTab === 'carte' ? (
            <div className="h-full w-full absolute inset-0">
               <div ref={mapContainerRef} id="driver-map-live" className="w-full h-full" />
               <div className="absolute bottom-6 left-6 right-6 z-10 space-y-3">
                 {orders.filter(o => o.livreur_id === profile.id).map(o => (
                   <div key={o.id} className="bg-white p-4 rounded-3xl shadow-2xl border border-gray-100 flex items-center justify-between animate-in slide-in-from-bottom-4">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center"><Navigation2 size={20} /></div>
                       <div>
                         <p className="text-sm font-bold text-gray-900">{o.client?.full_name}</p>
                         <p className="text-[10px] font-black text-gray-400 uppercase">Livraison en cours</p>
                       </div>
                     </div>
                     <button onClick={() => openInExternalMap(o)} className="bg-gray-900 text-white p-3 rounded-xl shadow-lg hover:bg-black active:scale-90 transition-all"><ExternalLink size={18} /></button>
                   </div>
                 ))}
               </div>
            </div>
          ) : activeTab === 'missions' ? (
            <div className="p-6 space-y-6 pb-32">
              {orders.length === 0 && (
                <div className="text-center py-20 opacity-30">
                  <Truck size={48} className="mx-auto mb-4" />
                  <p className="font-black uppercase text-xs tracking-widest">Recherche de missions...</p>
                </div>
              )}
              {orders.map(order => (
                <div key={order.id} className={`bg-white rounded-[32px] p-6 shadow-sm border transition-all ${order.livreur_id === profile.id ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${order.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 'bg-blue-600 text-white'}`}>{order.status}</span>
                    <span className="font-black text-gray-900 text-xl">{order.total_amount.toLocaleString()} F</span>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex items-start gap-3">
                      <MapPin size={18} className="text-emerald-500 shrink-0 mt-1" />
                      <p className="text-sm font-bold text-gray-700 leading-tight">{order.delivery_address}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={18} className="text-gray-400" />
                      <p className="text-sm font-bold text-gray-900">{order.client?.phone || 'Non renseigné'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {order.status === 'PENDING' ? (
                      <button onClick={() => updateOrderStatus(order.id, OrderStatus.ASSIGNED)} className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black shadow-lg">Accepter la mission</button>
                    ) : order.status === 'ASSIGNED' ? (
                      <>
                        <button onClick={() => updateOrderStatus(order.id, OrderStatus.IN_PROGRESS)} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black">Démarrer trajet</button>
                        <button onClick={() => setActiveTab('carte')} className="p-4 bg-white border border-gray-200 rounded-2xl text-gray-900"><MapIcon size={20} /></button>
                      </>
                    ) : (
                      <button onClick={() => updateOrderStatus(order.id, OrderStatus.ARRIVED)} className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2">
                        <CheckCircle2 size={20} /> Je suis sur place
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="p-6 text-center py-20 animate-in fade-in">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                 <Wallet size={32} />
               </div>
               <h3 className="text-3xl font-black text-gray-900">{profile.wallet_balance?.toLocaleString() || 0} F</h3>
               <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Gains cumulés</p>
             </div>
          )}
        </div>

        <div className="bg-white/90 backdrop-blur-md h-24 border-t flex justify-around items-center px-8 pb-4 sticky bottom-0 z-30">
           <button onClick={() => setActiveTab('missions')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'missions' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}>
              <ClipboardList size={24} />
              <span className="text-[10px] font-black uppercase">Missions</span>
           </button>
           <button onClick={() => setActiveTab('carte')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'carte' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}>
              <MapIcon size={24} />
              <span className="text-[10px] font-black uppercase tracking-tighter">Carte Direct</span>
           </button>
           <button onClick={() => setActiveTab('revenus')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'revenus' ? 'text-emerald-600 scale-110' : 'text-gray-300'}`}>
              <Wallet size={24} />
              <span className="text-[10px] font-black uppercase">Revenus</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default LivreurApp;
