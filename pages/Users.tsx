
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  Users as UsersIcon, 
  Search, 
  Filter, 
  MoreVertical, 
  ShieldCheck, 
  Truck, 
  User,
  Loader2,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { Profile } from '../types';

const Users: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setProfiles(data);
    setLoading(false);
  };

  const updateUserRole = async (userId: string, newRole: 'CLIENT' | 'LIVREUR' | 'ADMIN') => {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId);
    
    if (!error) {
      setProfiles(profiles.map(p => p.id === userId ? { ...p, role: newRole } : p));
    } else {
      alert("Erreur lors de la mise à jour : " + error.message);
    }
  };

  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'ALL' || p.role === filterRole;
    return matchesSearch && matchesRole;
  });

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-emerald-600" size={40} /></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Gestion des Utilisateurs</h2>
        <p className="text-gray-500 mt-1">Gérez les accès, les rôles et les validations KYC des livreurs.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un nom ou email..." 
            className="w-full bg-white border border-gray-100 rounded-2xl py-3 pl-12 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter size={18} className="text-gray-400" />
          <select 
            className="bg-white border border-gray-100 rounded-xl py-2 px-4 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="ALL">Tous les rôles</option>
            <option value="CLIENT">Clients</option>
            <option value="LIVREUR">Livreurs</option>
            <option value="ADMIN">Admins</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Utilisateur</th>
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Rôle</th>
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Statut KYC</th>
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredProfiles.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.id}`} 
                      className="w-10 h-10 rounded-xl bg-gray-100"
                      alt=""
                    />
                    <div>
                      <p className="font-bold text-gray-900">{user.full_name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    user.role === 'ADMIN' ? 'bg-indigo-50 text-indigo-600' :
                    user.role === 'LIVREUR' ? 'bg-orange-50 text-orange-600' :
                    'bg-emerald-50 text-emerald-600'
                  }`}>
                    {user.role === 'ADMIN' ? <ShieldCheck size={12} /> : 
                     user.role === 'LIVREUR' ? <Truck size={12} /> : <User size={12} />}
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {user.kyc_status === 'VERIFIED' ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : user.kyc_status === 'REJECTED' ? (
                      <XCircle size={16} className="text-red-500" />
                    ) : (
                      <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
                    )}
                    <span className="text-xs font-bold text-gray-600 uppercase">{user.kyc_status}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => updateUserRole(user.id, 'LIVREUR')}
                      className="p-2 hover:bg-orange-50 text-orange-600 rounded-lg transition-colors title='Promouvoir Livreur'"
                    >
                      <Truck size={18} />
                    </button>
                    <button 
                      onClick={() => updateUserRole(user.id, 'ADMIN')}
                      className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors title='Promouvoir Admin'"
                    >
                      <ShieldCheck size={18} />
                    </button>
                    <button 
                      onClick={() => updateUserRole(user.id, 'CLIENT')}
                      className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors title='Rétrograder Client'"
                    >
                      <User size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProfiles.length === 0 && (
          <div className="py-20 text-center">
            <UsersIcon size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-medium">Aucun utilisateur trouvé.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Users;
