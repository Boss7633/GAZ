
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  MapPin, 
  ShoppingBag, 
  ChevronRight, 
  Loader2, 
  CheckCircle2, 
  LocateFixed, 
  History, 
  Info,
  Package,
  Clock,
  Truck,
  CheckCircle,
  Banknote
} from 'lucide-react';
import { Profile, OrderStatus } from '../types';

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

  useEffect(() => {
    fetchData();
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
      .select('*, livreur:livreur_id(full_name, phone)')
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

    if (!error) {
      fetchActiveOrder();
    }
    setOrdering(false);
  };

  const approveDelivery = async () => {
    if (!activeOrder) return;
    setOrdering(true);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'DELIVERED' })
      .eq('id', activeOrder.id);
    
    if (!error) {
      setActiveOrder(null);
      setActiveTab('history');
      fetchData();
    }
    setOrdering(false);
  };

  const getStepProgress = () => {
    if (!activeOrder) return 0;
    switch(activeOrder.status) {
      case 'PENDING': return 25;
      case 'ASSIGNED': return 50;
      case 'IN_PROGRESS': return 75;
      case 'ARRIVED': return 90;
      case 'DELIVERED': return 100;
      default: return 0;
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-white"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-md bg-white min-h-screen flex flex-col shadow-2xl relative">
        {/* Header */}
        <div className="p-6 pb-2 border-b bg-white sticky top-0 z-20">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black shadow-lg">G</div>
               <span className="font-black text-gray-900 text-lg">GazFlow</span>
            </div>
            {activeOrder && (
              <div className="bg-emerald-50 px-3 py-1.5 rounded-full flex items-center gap-2 border border-emerald-100">
                <div className="animate-pulse bg-emerald-500 w-2 h-2 rounded-full"></div>
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">En cours</span>
              </div>
            )}
          </div>

          {!activeOrder && (
            <div className="flex gap-2 p-1 bg-gray-50 rounded-2xl">
              <button 
                onClick={() => setActiveTab('shop')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'shop' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}
              >
                Boutique
              </button>
              <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === 'history' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-400'}`}
              >
                Commandes
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
          {activeOrder ? (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="text-center">
                <h3 className="text-xl font-black text-gray-900">Suivi de livraison</h3>
                <p className="text-[10px] text-gray-400 font-black uppercase mt-1 tracking-tighter">ID: {activeOrder.id.slice(0, 12)}</p>
              </div>

              <div className="relative pt-4 pb-12 max-w-[280px] mx-auto">
                <div className="absolute left-4 top-0 bottom-0 w-1 bg-gray-100 ml-[-2px]"></div>
                <div 
                  className="absolute left-4 top-0 w-1 bg-emerald-500 ml-[-2px] transition-all duration-1000" 
                  style={{ height: `${getStepProgress()}%` }}
                ></div>
                
                <div className="space-y-12 relative">
                  {[
                    { key: 'PENDING', label: 'Commande Validée', sub: 'Attente livreur', icon: <CheckCircle /> },
                    { key: 'ASSIGNED', label: 'Livreur Trouvé', sub: activeOrder.livreur?.full_name || 'En recherche...', icon: <Truck /> },
                    { key: 'IN_PROGRESS', label: 'En Chemin', sub: 'Le gaz arrive !', icon: <LocateFixed /> },
                    { key: 'ARRIVED', label: 'Livreur Arrivé', sub: 'Préparez le cash', icon: <Banknote /> }
                  ].map((step, idx) => {
                    const isDone = getStepProgress() >= (idx + 1) * 25 || (step.key === 'ARRIVED' && activeOrder.status === 'ARRIVED');
                    return (
                      <div key={step.key} className="flex items-start gap-6">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center z-10 shadow-md border-4 border-white transition-all ${
                          isDone ? 'bg-emerald-600 text-white scale-110' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {React.cloneElement(step.icon as React.ReactElement<any>, { size: 16 })}
                        </div>
                        <div>
                          <p className={`text-sm font-black ${isDone ? 'text-gray-900' : 'text-gray-300'}`}>{step.label}</p>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{step.sub}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeOrder.status === 'ARRIVED' ? (
                <div className="bg-emerald-50 p-8 rounded-[40px] border border-emerald-100 text-center animate-in zoom-in">
                  <Banknote size={48} className="mx-auto text-emerald-600 mb-4" />
                  <h4 className="font-black text-emerald-900 text-lg">Paiement Requis</h4>
                  <p className="text-sm text-emerald-700 font-medium mb-8 leading-relaxed">
                    Veuillez remettre <b>{activeOrder.total_amount.toLocaleString()} F</b> en espèces au livreur.
                  </p>
                  <button 
                    onClick={approveDelivery}
                    disabled={ordering}
                    className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black shadow-xl shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {ordering ? <Loader2 className="animate-spin" /> : "J'ai payé & reçu le gaz"}
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 flex items-center gap-5">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                    <Clock size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Estimation</p>
                    <p className="font-black text-gray-900 text-lg">~ 20 minutes</p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'shop' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Catalogue GazFlow</p>
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full group p-6 rounded-[32px] border-2 transition-all text-left flex items-center gap-6 ${
                      selectedProduct?.id === p.id ? 'border-emerald-600 bg-emerald-50 shadow-lg scale-[1.02]' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className={`w-20 h-20 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm transition-colors ${
                      selectedProduct?.id === p.id ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {p.size}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-gray-900 text-xl">Bouteille {p.size}kg</p>
                      <p className="text-xs text-gray-500 font-medium leading-tight mt-1">{p.description}</p>
                      <p className="mt-2 font-black text-emerald-600 text-xl">{p.price.toLocaleString()} F CFA</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100 flex items-start gap-4">
                <Info size={24} className="text-blue-500 shrink-0 mt-1" />
                <p className="text-xs text-blue-800 font-bold leading-relaxed">
                  Paiement sécurisé en espèces lors de la réception. Aucun frais caché.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <h3 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-2">Historique récent</h3>
              {orderHistory.map((order) => (
                <div key={order.id} className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-gray-50 flex items-center justify-center text-emerald-500 shadow-inner">
                    <Package size={28} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-black text-gray-900">Format {order.items?.[0]?.product_id === 1 ? '6kg' : '12.5kg'}</p>
                      <p className="font-black text-gray-900">{order.total_amount.toLocaleString()} F</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                       <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">
                        {new Date(order.created_at).toLocaleDateString()}
                       </p>
                       <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                       <p className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{order.status}</p>
                    </div>
                  </div>
                </div>
              ))}
              {orderHistory.length === 0 && (
                <div className="text-center py-20 opacity-20">
                  <ShoppingBag size={64} className="mx-auto mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">Aucun achat</p>
                </div>
              )}
            </div>
          )}
        </div>

        {activeTab === 'shop' && !activeOrder && (
          <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-100 shadow-[0_-15px_40px_rgba(0,0,0,0.1)] z-30 max-w-md mx-auto">
            <button
              onClick={handleOrder}
              disabled={ordering || !selectedProduct}
              className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:bg-gray-200"
            >
              {ordering ? <Loader2 className="animate-spin" /> : <>Commander maintenant <ChevronRight size={20} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientApp;
