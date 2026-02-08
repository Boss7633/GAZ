
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ShoppingBag, 
  User, 
  Truck, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Loader2, 
  ChevronRight,
  AlertCircle,
  Search
} from 'lucide-react';

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
    fetchOnlineDrivers();

    const orderSub = supabase.channel('admin-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe();

    return () => { supabase.removeChannel(orderSub); };
  }, []);

  const fetchOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select(`*, profiles:client_id(full_name, phone)`)
      .order('created_at', { ascending: false });
    if (data) setOrders(data);
    setLoading(false);
  };

  const fetchOnlineDrivers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, is_online')
      .eq('role', 'LIVREUR')
      .eq('is_online', true);
    if (data) setDrivers(data);
  };

  const assignDriver = async (orderId: string, driverId: string) => {
    setLoading(true);
    const { error } = await supabase
      .from('orders')
      .update({ 
        livreur_id: driverId, 
        status: 'ASSIGNED' 
      })
      .eq('id', orderId);
    
    if (!error) {
      setAssigningId(null);
      fetchOrders();
    }
    setLoading(false);
  };

  if (loading && orders.length === 0) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Flux Commandes</h2>
          <p className="text-gray-500 mt-1">Gérez les demandes clients et assignez les livreurs disponibles.</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-orange-50 text-orange-600 px-4 py-2 rounded-2xl border border-orange-100 flex items-center gap-2 font-black text-xs uppercase">
              <AlertCircle size={16} /> {orders.filter(o => o.status === 'PENDING').length} En attente
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Liste des commandes */}
        <div className="xl:col-span-2 space-y-4">
          {orders.map((order) => (
            <div key={order.id} className={`bg-white p-6 rounded-[32px] border transition-all ${
              order.status === 'PENDING' ? 'border-orange-200 shadow-orange-50 shadow-lg' : 'border-gray-100'
            }`}>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                    order.status === 'PENDING' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <ShoppingBag />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900">Commande #{order.id.slice(0, 8)}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock size={14} className="text-gray-400" />
                      <span className="text-xs font-bold text-gray-400 uppercase">
                        {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest ${
                        order.status === 'PENDING' ? 'bg-orange-50 text-orange-500' : 
                        order.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-gray-900">{order.total_amount} F</p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Total TTC</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-2xl mb-6">
                <div className="flex items-start gap-3">
                  <User size={18} className="text-emerald-600 mt-1" />
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Client</p>
                    <p className="font-bold text-gray-900">{order.profiles?.full_name}</p>
                    <p className="text-xs text-gray-500">{order.profiles?.phone}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-orange-600 mt-1" />
                  <div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Localisation</p>
                    <p className="font-bold text-gray-900 truncate max-w-[200px]">{order.delivery_address}</p>
                    {order.delivery_location && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black mt-1 inline-block uppercase">Coordonnées GPS OK</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                {order.status === 'PENDING' ? (
                  <div className="flex-1">
                    {assigningId === order.id ? (
                      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                        {drivers.length > 0 ? drivers.map(d => (
                          <button 
                            key={d.id}
                            onClick={() => assignDriver(order.id, d.id)}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shrink-0 hover:bg-emerald-700 transition-colors"
                          >
                            <Truck size={14} /> {d.full_name}
                          </button>
                        )) : (
                          <p className="text-xs font-bold text-red-500 italic">Aucun livreur en ligne actuellement.</p>
                        )}
                        <button onClick={() => setAssigningId(null)} className="text-xs font-bold text-gray-400 px-4">Annuler</button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => setAssigningId(order.id)}
                        className="w-full bg-gray-900 text-white py-3 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-black transition-all"
                      >
                        Assigner un livreur <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 size={18} />
                    <span className="text-sm font-black uppercase tracking-widest">Assignée au Livreur</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
              <ShoppingBag size={48} className="mx-auto text-gray-200 mb-4" />
              <p className="font-bold text-gray-400">Aucune commande pour le moment.</p>
            </div>
          )}
        </div>

        {/* Panneau latéral - Statistiques rapides */}
        <div className="space-y-6">
          <div className="bg-indigo-600 p-8 rounded-[40px] text-white shadow-xl relative overflow-hidden">
             <div className="relative z-10">
               <h3 className="font-black text-xl mb-1">Fleet Status</h3>
               <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest">Temps réel</p>
               <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-end border-b border-white/10 pb-4">
                    <p className="text-sm font-medium">Livreurs en ligne</p>
                    <p className="text-2xl font-black">{drivers.length}</p>
                  </div>
                  <div className="flex justify-between items-end border-b border-white/10 pb-4">
                    <p className="text-sm font-medium">Commandes non traitées</p>
                    <p className="text-2xl font-black">{orders.filter(o => o.status === 'PENDING').length}</p>
                  </div>
               </div>
             </div>
             <div className="absolute top-[-20px] right-[-20px] w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Orders;
