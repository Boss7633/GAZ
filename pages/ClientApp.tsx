
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
    // Fetch Products
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
      .single();
    
    if (data) {
      setActiveOrder(data);
      setActiveTab('tracking');
    } else {
      setActiveOrder(null);
      // Fetch History if no active order
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

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-emerald-500" /></div>;

  return (
    <div className="flex justify-center items-center py-10 bg-gray-100 min-h-screen">
      <div className="w-[375px] h-[812px] bg-white rounded-[40px] shadow-2xl border-[8px] border-gray-900 overflow-hidden relative flex flex-col">
        
        {/* Header */}
        <div className="p-6 pb-2">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600 font-black">G</div>
               <span className="font-black text-gray-900">GazFlow</span>
            </div>
            {activeOrder && (
              <div className="animate-pulse bg-emerald-500 w-3 h-3 rounded-full"></div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        {!activeOrder && (
          <div className="flex px-6 mb-4">
            <button 
              onClick={() => setActiveTab('shop')}
              className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'shop' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400'}`}
            >
              Boutique
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 text-sm font-bold border-b-2 transition-all ${activeTab === 'history' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400'}`}
            >
              Historique
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-24">
          {activeOrder ? (
            <div className="space-y-8 py-4 animate-in fade-in duration-500">
              <div className="text-center">
                <h3 className="text-xl font-black text-gray-900">Suivi de livraison</h3>
                <p className="text-xs text-gray-500 font-bold uppercase mt-1">Commande #{activeOrder.id.slice(0, 8)}</p>
              </div>

              {/* Progress Stepper Visual */}
              <div className="relative pt-4 pb-12">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100 ml-[-1px]"></div>
                <div 
                  className="absolute left-4 top-0 w-0.5 bg-emerald-500 ml-[-1px] transition-all duration-1000" 
                  style={{ height: `${getStepProgress()}%` }}
                ></div>
                
                <div className="space-y-10 relative">
                  {[
                    { key: 'PENDING', label: 'Commande Validée', sub: 'En attente de livreur', icon: <CheckCircle /> },
                    { key: 'ASSIGNED', label: 'Livreur Trouvé', sub: activeOrder.livreur?.full_name || 'Recherche...', icon: <Truck /> },
                    { key: 'IN_PROGRESS', label: 'En Chemin', sub: 'Le livreur se rapproche', icon: <LocateFixed /> },
                    { key: 'ARRIVED', label: 'Livreur Arrivé', sub: 'Préparez vos espèces', icon: <Banknote /> }
                  ].map((step, idx) => {
                    const isDone = getStepProgress() >= (idx + 1) * 25 || (step.key === 'ARRIVED' && activeOrder.status === 'ARRIVED');
                    return (
                      <div key={step.key} className="flex items-start gap-6">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 shadow-sm border-4 border-white transition-colors ${
                          isDone ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {/* Use React.cloneElement with React.ReactElement<any> to avoid TS error on 'size' property */}
                          {React.cloneElement(step.icon as React.ReactElement<any>, { size: 14 })}
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

              {/* Action Box */}
              {activeOrder.status === 'ARRIVED' ? (
                <div className="bg-emerald-50 p-6 rounded-[32px] border border-emerald-100 text-center animate-bounce-slow">
                  <Banknote size={40} className="mx-auto text-emerald-600 mb-3" />
                  <h4 className="font-black text-emerald-900">Le livreur est là !</h4>
                  <p className="text-[11px] text-emerald-700 font-medium mb-6">
                    Veuillez lui remettre <b>{activeOrder.total_amount} F CFA</b> en espèces puis confirmez ici.
                  </p>
                  <button 
                    onClick={approveDelivery}
                    disabled={ordering}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-200"
                  >
                    {ordering ? <Loader2 className="animate-spin mx-auto" /> : "Confirmer la réception"}
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 p-6 rounded-[32px] border border-gray-100 flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
                    <Clock size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Temps estimé</p>
                    <p className="font-black text-gray-900">15 - 25 minutes</p>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'shop' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="space-y-3">
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Choisir un format</p>
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProduct(p)}
                    className={`w-full group p-4 rounded-3xl border-2 transition-all text-left flex items-center gap-4 ${
                      selectedProduct?.id === p.id ? 'border-emerald-600 bg-emerald-50' : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg shadow-sm transition-colors ${
                      selectedProduct?.id === p.id ? 'bg-emerald-600 text-white' : 'bg-gray-50 text-gray-400'
                    }`}>
                      {p.size}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-gray-900">Bouteille {p.size}kg</p>
                      <p className="text-[10px] text-gray-500 font-medium leading-tight">{p.description}</p>
                      <p className="mt-1 font-black text-emerald-600">{p.price} F CFA</p>
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex items-start gap-4">
                <Banknote size={20} className="text-blue-500 shrink-0 mt-1" />
                <p className="text-[11px] text-blue-800 font-bold leading-relaxed italic">
                  "Paiement uniquement en espèces à la livraison. Vous ne validez que lorsque vous recevez votre gaz."
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              {orderHistory.map((order) => (
                <div key={order.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-emerald-500">
                    <Package size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="font-bold text-gray-900 text-sm">Recharge {order.items?.[0]?.product_id === 1 ? '6kg' : '12.5kg'}</p>
                      <p className="font-black text-xs text-gray-900">{order.total_amount} F</p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">
                      {new Date(order.created_at).toLocaleDateString()} • {order.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Bar Shopping */}
        {activeTab === 'shop' && !activeOrder && (
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-lg border-t border-gray-100">
            <button
              onClick={handleOrder}
              disabled={ordering || !selectedProduct}
              className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 active:scale-95 transition-all disabled:bg-gray-300"
            >
              {ordering ? <Loader2 className="animate-spin" /> : <>Confirmer la commande <ChevronRight size={18} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientApp;
