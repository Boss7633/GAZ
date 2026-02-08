
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
  Phone,
  Target,
  LocateFixed,
  TrendingUp,
  History,
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
  const [walletBalance, setWalletBalance] = useState(profile.wallet_balance || 0);
  
  const trackInterval = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  // Séparation des commandes par état
  const activeMissions = useMemo(() => orders.filter(o => o.status !== 'DELIVERED' && o.status !== 'CANCELLED'), [orders]);
  const completedMissions = useMemo(() => orders.filter(o => o.status === 'DELIVERED'), [orders]);

  // Calcul des gains du jour
  const todayEarnings = useMemo(() => {
    const today = new Date().toDateString();
    return completedMissions
      .filter(o => new Date(o.updated_at).toDateString() === today)
      .reduce((acc, curr) => acc + (curr.delivery_fee || 1000), 0);
  }, [completedMissions]);

  useEffect(() => {
    fetchOrders();
    fetchProfileData();

    const channel = supabase.channel('livreur-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${profile.id}` }, (payload) => {
        setWalletBalance(payload.new.wallet_balance);
      })
      .subscribe();

    if (isOnline) startTracking();
    else stopTracking();

    return () => { 
      supabase.removeChannel(channel); 
      stopTracking();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isOnline]);

  useEffect(() => {
    let timer: any;
    if (activeTab === 'carte') {
      timer = setTimeout(() => initOrUpdateMap(), 100);
    }
    return () => { if (timer) clearTimeout(timer); };
  }, [activeTab, orders, currentPos]);

  const fetchProfileData = async () => {
    const { data } = await supabase.from('profiles').select('wallet_balance').eq('id', profile.id).single();
    if (data) setWalletBalance(data.wallet_balance);
  };

  const initOrUpdateMap = () => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView(currentPos || [5.3484, -4.0305], 13);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current);
      markersLayerRef.current = L.featureGroup().addTo(mapInstanceRef.current);
    }
    updateMarkers();
  };

  const updateMarkers = () => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!L || !map || !layer) return;

    layer.clearLayers();
    const activeOrder = activeMissions.find(o => ['ASSIGNED', 'IN_PROGRESS', 'ARRIVED'].includes(o.status));
    const points: any[] = [];

    if (currentPos) {
      L.marker(currentPos, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="bg-blue-600 p-2.5 rounded-full border-2 border-white text-white shadow-2xl animate-pulse">
                   <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon></svg>
                 </div>`,
          iconSize: [36, 36], iconAnchor: [18, 18]
        })
      }).addTo(layer);
      points.push(currentPos);
    }

    if (activeOrder) {
      const clientPos = parseLocation(activeOrder.delivery_location);
      if (clientPos) {
        L.marker(clientPos, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="bg-orange-500 p-2.5 rounded-full border-2 border-white text-white shadow-2xl">
                     <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="3" fill="none"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                   </div>`,
            iconSize: [36, 36], iconAnchor: [18, 18]
          })
        }).addTo(layer);
        points.push(clientPos);
        if (currentPos) {
          L.polyline([currentPos, clientPos], { color: '#2563eb', weight: 4, opacity: 0.4, dashArray: '8, 12' }).addTo(layer);
        }
      }
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  };

  const recenterMap = () => {
    if (mapInstanceRef.current && currentPos) {
      mapInstanceRef.current.flyTo(currentPos, 16);
    }
  };

  const parseLocation = (loc: any): [number, number] | null => {
    if (!loc) return null;
    try {
      if (typeof loc === 'string') {
        const coords = loc.match(/-?\d+\.?\d*/g);
        return coords && coords.length >= 2 ? [parseFloat(coords[1]), parseFloat(coords[0])] : null;
      }
      if (loc.coordinates) return [loc.coordinates[1], loc.coordinates[0]];
    } catch (e) { console.error(e); }
    return null;
  };

  const startTracking = () => {
    if (!navigator.geolocation) return;
    const updateLocation = () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCurrentPos([latitude, longitude]);
        await supabase.from('profiles').update({ 
          last_location: `POINT(${longitude} ${latitude})`,
          is_online: true 
        }).eq('id', profile.id);
      }, (err) => console.warn(err), { enableHighAccuracy: true });
    };
    updateLocation();
    trackInterval.current = setInterval(updateLocation, 10000);
  };

  const stopTracking = () => { if (trackInterval.current) clearInterval(trackInterval.current); };

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
    
    // Si la commande est livrée, on crédite le livreur (simulation de commission)
    if (!error && status === OrderStatus.DELIVERED) {
      const { data: currentProfile } = await supabase.from('profiles').select('wallet_balance').eq('id', profile.id).single();
      if (currentProfile) {
        const newBalance = (currentProfile.wallet_balance || 0) + 1000; // 1000 F par livraison
        await supabase.from('profiles').update({ wallet_balance: newBalance }).eq('id', profile.id);
      }
    }

    if (!error && (status === OrderStatus.ASSIGNED || status === OrderStatus.IN_PROGRESS)) {
      setActiveTab('carte');
    }
    fetchOrders();
  };

  return (
    <div className="flex justify-center items-center py-10 bg-gray-100 min-h-screen">
      <div className="w-[375px] h-[812px] bg-gray-50 rounded-[40px] shadow-2xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col font-sans">
        
        {/* Header */}
        <div className="bg-white px-6 pt-12 pb-4 border-b flex justify-between items-center z-20">
          <div>
            <h2 className="text-lg font-black text-gray-900 tracking-tight">GazFlow Drive</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                {isOnline ? 'En service' : 'Hors-ligne'}
              </span>
            </div>
          </div>
          <button onClick={async () => {
            const next = !isOnline;
            setIsOnline(next);
            await supabase.from('profiles').update({ is_online: next }).eq('id', profile.id);
          }} className={`w-12 h-6 rounded-full p-1 transition-all ${isOnline ? 'bg-emerald-500' : 'bg-gray-200'}`}>
            <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform transform ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <div className="flex-1 relative overflow-hidden bg-gray-50 flex flex-col">
          {activeTab === 'carte' ? (
            <div className="w-full h-full relative">
              <div ref={mapContainerRef} className="w-full h-full z-0" style={{ height: '100%' }} />
              
              {/* Floating UI on Map */}
              <div className="absolute top-4 left-4 right-4 z-10">
                {activeMissions.find(o => ['ASSIGNED', 'IN_PROGRESS'].includes(o.status)) ? (
                  <div className="bg-white/95 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-blue-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                      <Navigation2 size={24} className="animate-bounce" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">En mission</p>
                      <p className="font-bold text-gray-900 truncate">{activeMissions.find(o => ['ASSIGNED', 'IN_PROGRESS', 'ARRIVED'].includes(o.status))?.delivery_address}</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/80 backdrop-blur-md p-4 rounded-3xl shadow-lg border border-gray-100 flex items-center gap-3">
                    <Target size={18} className="text-gray-400" />
                    <p className="text-xs font-bold text-gray-500">Prêt pour une mission...</p>
                  </div>
                )}
              </div>

              {/* Recenter Button */}
              <button 
                onClick={recenterMap}
                className="absolute bottom-6 right-6 z-10 w-14 h-14 bg-white rounded-2xl shadow-xl flex items-center justify-center text-gray-900 border border-gray-100 active:scale-90 transition-all"
              >
                <LocateFixed size={24} />
              </button>
            </div>
          ) : activeTab === 'revenus' ? (
             <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-in fade-in duration-500">
                <div className="bg-emerald-600 p-8 rounded-[40px] text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                   <div className="relative z-10">
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Solde Portefeuille</p>
                      <h3 className="text-4xl font-black mt-1">{walletBalance.toLocaleString()} F</h3>
                      <div className="mt-8 flex gap-4">
                        <div className="bg-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
                           <p className="text-[9px] font-black uppercase opacity-60">Aujourd'hui</p>
                           <p className="font-bold">+{todayEarnings} F</p>
                        </div>
                        <div className="bg-white/10 px-4 py-3 rounded-2xl backdrop-blur-sm">
                           <p className="text-[9px] font-black uppercase opacity-60">Livraisons</p>
                           <p className="font-bold">{completedMissions.length}</p>
                        </div>
                      </div>
                   </div>
                   <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>

                <div className="space-y-4">
                   <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                     <History size={18} className="text-gray-400" />
                     Derniers Gains
                   </h4>
                   {completedMissions.map(o => (
                     <div key={o.id} className="bg-white p-5 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                             <CheckCircle2 size={20} />
                           </div>
                           <div>
                              <p className="text-sm font-bold text-gray-900">Livraison #{o.id.slice(0,5)}</p>
                              <p className="text-[10px] font-black text-gray-400 uppercase">{new Date(o.updated_at).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <p className="font-black text-emerald-600">+1 000 F</p>
                     </div>
                   ))}
                   {completedMissions.length === 0 && (
                     <div className="py-20 text-center opacity-30">
                        <TrendingUp size={48} className="mx-auto mb-2" />
                        <p className="font-black uppercase tracking-widest text-[10px]">Aucun gain enregistré</p>
                     </div>
                   )}
                </div>
             </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {!isOnline && (
                <div className="bg-orange-50 border border-orange-100 p-6 rounded-[32px] flex gap-4 items-start animate-in fade-in">
                   <div className="p-3 bg-white rounded-2xl text-orange-500 shadow-sm"><AlertCircle size={24}/></div>
                   <div>
                     <p className="font-black text-orange-900 text-sm">Mode indisponible</p>
                     <p className="text-[11px] text-orange-700 leading-tight mt-1">Activez votre disponibilité pour recevoir des missions.</p>
                   </div>
                </div>
              )}

              {activeMissions.map(order => (
                <div key={order.id} className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 group transition-all">
                   <div className="flex justify-between items-start mb-6">
                     <div className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${
                       order.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 'bg-blue-600 text-white shadow-sm'
                     }`}>
                       {order.status === 'PENDING' ? 'Nouvelle' : 'En cours'}
                     </div>
                     <span className="font-black text-gray-900 text-xl tracking-tight">{order.total_amount} F</span>
                   </div>

                   <div className="space-y-4 mb-8">
                      <div className="flex items-start gap-4">
                        <div className="p-2.5 bg-gray-50 rounded-xl text-gray-400"><MapPin size={18}/></div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Client: {order.client?.full_name}</p>
                          <p className="text-sm font-bold text-gray-900 leading-tight mt-0.5">{order.delivery_address}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600"><Banknote size={18}/></div>
                        <div>
                           <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Paiement</p>
                           <p className="text-sm font-bold text-gray-900">Encaissez {order.total_amount} F cash</p>
                        </div>
                      </div>
                   </div>

                   <div className="flex gap-2">
                     {order.status === 'PENDING' ? (
                        <button 
                          onClick={() => updateOrderStatus(order.id, OrderStatus.ASSIGNED)}
                          disabled={!isOnline}
                          className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-xs active:scale-95 disabled:opacity-30 transition-all shadow-lg"
                        >
                          Accepter la mission
                        </button>
                     ) : order.status === 'ASSIGNED' ? (
                        <button 
                          onClick={() => updateOrderStatus(order.id, OrderStatus.IN_PROGRESS)}
                          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs shadow-xl shadow-blue-100 active:scale-95 transition-all"
                        >
                          Démarrer le trajet
                        </button>
                     ) : (
                        <div className="flex gap-2 w-full">
                           <button 
                              onClick={() => setActiveTab('carte')}
                              className="flex-1 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 shadow-lg"
                           >
                              <Navigation2 size={16} /> GPS
                           </button>
                           <button 
                              onClick={() => updateOrderStatus(order.id, OrderStatus.ARRIVED)}
                              className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-black text-xs shadow-xl shadow-emerald-100"
                           >
                              Arrivé
                           </button>
                        </div>
                     )}
                   </div>
                </div>
              ))}
              
              {activeMissions.length === 0 && (
                <div className="py-20 text-center opacity-30">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ClipboardList size={32} />
                  </div>
                  <p className="font-black uppercase tracking-widest text-xs">Aucune mission active</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tab Bar */}
        <div className="bg-white h-24 border-t border-gray-100 flex justify-around items-center px-6 pb-6 shadow-[0_-15px_30px_rgba(0,0,0,0.03)] z-30">
           <button onClick={() => setActiveTab('missions')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'missions' ? 'text-emerald-600' : 'text-gray-300'}`}>
              <ClipboardList size={22} />
              <span className="text-[9px] font-black uppercase tracking-widest">Missions</span>
           </button>
           <button onClick={() => setActiveTab('carte')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'carte' ? 'text-emerald-600' : 'text-gray-300'}`}>
              <MapIcon size={22} />
              <span className="text-[9px] font-black uppercase tracking-widest">Carte</span>
           </button>
           <button onClick={() => setActiveTab('revenus')} className={`flex flex-col items-center gap-2 transition-all ${activeTab === 'revenus' ? 'text-emerald-600' : 'text-gray-300'}`}>
              <Wallet size={22} />
              <span className="text-[9px] font-black uppercase tracking-widest">Revenus</span>
           </button>
        </div>
      </div>
    </div>
  );
};

export default LivreurApp;
