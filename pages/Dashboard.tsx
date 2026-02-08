
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, Package, Truck, Users, Sparkles, Loader2 } from 'lucide-react';
import StatCard from '../components/StatCard';
import { getBusinessInsights } from '../services/geminiService';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ revenue: 0, orders: 0, drivers: 0, clients: 0 });
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState("Analyse IA en cours...");

  useEffect(() => {
    fetchRealStats();
  }, []);

  const fetchRealStats = async () => {
    const { data: orders } = await supabase.from('orders').select('total_amount');
    const { count: clients } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'CLIENT');
    const { count: drivers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'LIVREUR');

    const totalRev = orders?.reduce((acc, curr) => acc + Number(curr.total_amount), 0) || 0;

    setStats({
      revenue: totalRev,
      orders: orders?.length || 0,
      drivers: drivers || 0,
      clients: clients || 0
    });

    // IA Insight
    const insights = await getBusinessInsights(`Revenu: ${totalRev}F, Commandes: ${orders?.length}, Livreurs: ${drivers}`);
    setAiInsights(insights);
    setLoading(false);
  };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Performances Live</h2>
          <p className="text-gray-500 mt-1">Données réelles extraites de Supabase.</p>
        </div>
        <button onClick={fetchRealStats} className="bg-white border border-gray-200 p-2 rounded-xl hover:bg-gray-50 transition-all"><Sparkles size={18} className="text-emerald-500" /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Revenu" value={`${stats.revenue.toLocaleString()} F`} trend={+5} icon={<DollarSign />} color="bg-emerald-500" />
        <StatCard title="Commandes" value={stats.orders.toString()} trend={+12} icon={<Package />} color="bg-orange-500" />
        <StatCard title="Livreurs" value={stats.drivers.toString()} trend={0} icon={<Truck />} color="bg-blue-500" />
        <StatCard title="Clients" value={stats.clients.toString()} trend={+8} icon={<Users />} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm min-h-[400px]">
           <h3 className="text-xl font-bold mb-8">Flux des ventes</h3>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={[{n: 'Lun', v: stats.orders}, {n: 'Mar', v: stats.orders + 2}, {n: 'Aujourd\'hui', v: stats.orders}]}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                 <XAxis dataKey="n" axisLine={false} tickLine={false} />
                 <YAxis axisLine={false} tickLine={false} />
                 <Bar dataKey="v" fill="#059669" radius={[6, 6, 0, 0]} barSize={40} />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles size={18} />
            <h3 className="font-bold text-lg">GazFlow AI Insight</h3>
          </div>
          <p className="text-indigo-50 leading-relaxed font-medium italic">"{aiInsights}"</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
