
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  MapPin, 
  ShoppingBag, 
  ChevronRight, 
  Loader2, 
  LocateFixed, 
  History, 
  Info,
  Package,
  Clock,
  Truck,
  CheckCircle,
  Banknote,
  Navigation
} from 'lucide-react';
import { Profile } from '../types';

interface ClientAppProps {
  profile: Profile;
}

const ClientApp: React.FC<ClientAppProps> = ({ profile }) => {
  const [activeTab, setActiveTab] = useState<'shop' | 'history' | 'tracking'>('shop');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);

  useEffect(() => {
    fetchData();
    
    // Suivi Realtime de la commande ET du livreur
    const orderSub = supabase.channel('client-tracking')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: `client_id=eq.${profile.id}`
      }, () => fetchActiveOrder())
      .subscribe();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        null,
        { enableHighAccuracy: true }
      );
    }

    return () => { supabase.removeChannel(orderSub); };
  }, []);

  useEffect(() => {
    if (activeOrder && (activeOrder.status === 'IN_PROGRESS' || activeOrder.status === 'ARRIVED')) {
      // Souscription spécifique au livreur assigné
      const driverSub = supabase.channel(`driver-move-${activeOrder.livreur_id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${activeOrder.livreur_id}`
        }, (payload) => {
          updateMapMarkers(payload.new.last_location);
        })
        .subscribe();
      
      return () => { supabase.removeChannel(driverSub); };
    }
  }, [activeOrder]);

  useEffect(() => {
    if (activeOrder && mapContainerRef.current) {
      setTimeout(() => initMap(), 100);
    }
  }, [activeOrder, activeTab]);

  const initMap = () => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([5.3484, -4.0305], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(mapInstanceRef.current);
    markersLayerRef.current = L.featureGroup().addTo(mapInstanceRef.current);
    
    if (activeOrder.livreur?.last_location) {
      updateMapMarkers(activeOrder.livreur.last_location);
    }
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

  const updateMapMarkers = (driverLoc: any) => {
    const L = (window as any).L;
    if (!L || !markersLayerRef.current || !mapInstanceRef.current) return;

    markersLayerRef.current.clearLayers();
    const points: any[] = [];

    // Position du Client
    const clientPos = parseLocation(activeOrder.delivery_location);
    if (clientPos) {
      L.marker(clientPos, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="bg-emerald-600 p-2 rounded-full border-2 border-white text-white shadow-lg"><svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" stroke-width="3"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg></div>`,
          iconSize: [30, 30], iconAnchor: [15, 15]
        })
      }).addTo(markersLayerRef.current);
      points.push(clientPos);
    }

    // Position du Livreur
    const dPos = parseLocation(driverLoc);
    if (dPos) {
      L.marker(dPos, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="bg-blue-600 p-3 rounded-full border-4 border-white text-white shadow-2xl animate-bounce"><svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="3"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon></svg></div>`,
          iconSize: [40, 40], iconAnchor: [20, 20]
        })
      }).addTo(markersLayerRef.current);
      points.push(dPos);
    }

    if (points.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const { data: pricing } = await supabase
      .from('regional_pricing')
      .select(`price, products (id, size, description)`);
    
    if (pricing) {
      setProducts(pricing.map((item: any) => ({
        id: item.products.id,
        size: item.products.size,
        price: item.price,
        description: item.products.description
      })));
      setSelectedProduct(pricing[1]?.products || pricing[0]?.products);
    }
    await fetchActiveOrder();
    setLoading(false);
  };

  const fetchActiveOrder = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, livreur:livreur_id(full_name, phone, last_location)')
      .eq('client_id', profile.id)
      .neq('status', 'DELIVERED')
      .neq('status', 'CANCELLED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setActiveOrder(data);
      setActiveTab('tracking');
    } else {
      setActiveOrder(null);
      const { data: history } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', profile.id)
        .order('created_at', { ascending: false });
      if (history) setOrderHistory(history);
    }
  };

  const handleOrder = async () => {
    if (!selectedProduct) return;
    setOrdering(true);
    let lat = userCoords?.lat;
    let lng = userCoords?.lng;

    const { error } = await supabase.from('orders').insert({
      client_id: profile.id,
      status: 'PENDING',
      items: [{ product_id: selectedProduct.id, qty: 1 }],
      total_amount: (products.find(p => p.id === selectedProduct.id)?.price || 0) + 1000,
      delivery_fee: 1000,
      payment_method: 'CASH',
      delivery_address: 'Position GPS temps réel',
      delivery_location: lat && lng ? `SRID=4326;POINT(${lng} ${lat})` : null
    });

    if (!error) fetchActiveOrder();
    setOrdering(false);
  };

  const approveDelivery = async () => {
    if (!activeOrder) return;
    setOrdering(true);
    const { error } = await supabase.from('orders').update({ status: 'DELIVERED' }).eq('id', activeOrder.id);
    if (!error) {
      setActiveOrder(null);
      setActiveTab('history');
      fetchData();
    }
    setOrdering(false);
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative">
        <div className="p-6 pb-2 border-b bg-white sticky top-0 z-20">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">G</div>
               <span className="font-black text-gray-900 text-lg">GazFlow</span>
            </div>
            {activeOrder && (
              <div className="bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-100">
                <div className="animate-pulse bg-emerald-500 w-2 h-2 rounded-full"></div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{activeOrder.status}</span>
              </div>
            )}
          </div>
          {!activeOrder && (
            <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl">
              <button onClick={() => setActiveTab('shop')} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'shop' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Boutique</button>
              <button onClick={() => setActiveTab('history')} className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}>Historique</button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
          {activeOrder ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              <div className="h-64 rounded-[32px] overflow-hidden shadow-inner border border-gray-100 bg-gray-50 relative">
                <div ref={mapContainerRef} className="w-full h-full" id="client-map" />
              </div>

              <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-gray-900">Détails Livraison</h3>
                  <span className="text-[10px] font-bold text-gray-400"># {activeOrder.id.slice(0,8)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <Truck size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{activeOrder.livreur?.full_name || 'En attente...'}</p>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Votre livreur GazFlow</p>
                  </div>
                </div>
              </div>

              {activeOrder.status === 'ARRIVED' && (
                <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 text-center animate-bounce">
                  <Banknote size={32} className="mx-auto text-emerald-600 mb-2" />
                  <p className="text-sm font-black text-emerald-900">Livreur arrivé ! Payez {activeOrder.total_amount.toLocaleString()} F</p>
                  <button onClick={approveDelivery} className="mt-4 w-full bg-emerald-600 text-white py-4 rounded-2xl font-black">Valider la réception</button>
                </div>
              )}
            </div>
          ) : activeTab === 'shop' ? (
            <div className="space-y-6">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Choisir mon gaz</p>
              {products.map((p) => (
                <button key={p.id} onClick={() => setSelectedProduct(p)} className={`w-full p-6 rounded-[32px] border-2 transition-all text-left flex items-center gap-6 ${selectedProduct?.id === p.id ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100 bg-white'}`}>
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-xl ${selectedProduct?.id === p.id ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-400'}`}>{p.size}</div>
                  <div className="flex-1">
                    <p className="font-black text-gray-900">Bouteille {p.size}kg</p>
                    <p className="font-black text-emerald-600">{p.price.toLocaleString()} F</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {orderHistory.map((order) => (
                <div key={order.id} className="bg-white p-5 rounded-[24px] border border-gray-100 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-bold text-gray-900">Commande {order.status}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-black">{new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className="font-black text-emerald-600">{order.total_amount.toLocaleString()} F</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {activeTab === 'shop' && !activeOrder && (
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 max-w-md mx-auto z-30">
            <button onClick={handleOrder} disabled={ordering} className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3">
              {ordering ? <Loader2 className="animate-spin" /> : <>Commander maintenant <ChevronRight size={20} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientApp;
