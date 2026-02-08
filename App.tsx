
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ClientApp from './pages/ClientApp';
import LivreurApp from './pages/LivreurApp';
import AuthPage from './pages/AuthPage';
import Users from './pages/Users';
import DeliveryMap from './pages/DeliveryMap';
import Orders from './pages/Orders';
import { supabase } from './services/supabaseClient';
import { Search, Bell, HelpCircle, LogOut } from 'lucide-react';
import { Profile } from './types';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data);
      if (data.role === 'ADMIN') setActiveTab('dashboard');
      else if (data.role === 'CLIENT') setActiveTab('client-app');
      else if (data.role === 'LIVREUR') setActiveTab('driver-app');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderAdminContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'users': return <Users />;
      case 'orders': return <Orders />;
      case 'delivery': return <DeliveryMap />;
      case 'client-app': return <ClientApp profile={profile!} />;
      case 'driver-app': return <LivreurApp profile={profile!} />;
      default: return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!session || !profile) {
    return <AuthPage onLogin={() => {}} />;
  }

  if (profile.role === 'CLIENT') {
    return (
      <div className="relative">
        <button onClick={handleLogout} className="fixed top-6 left-6 z-50 bg-white/80 backdrop-blur p-3 rounded-full shadow-lg text-red-500"><LogOut size={20} /></button>
        <ClientApp profile={profile} />
      </div>
    );
  }

  if (profile.role === 'LIVREUR') {
    return (
      <div className="relative">
        <button onClick={handleLogout} className="fixed top-6 left-6 z-50 bg-white/80 backdrop-blur p-3 rounded-full shadow-lg text-red-500"><LogOut size={20} /></button>
        <LivreurApp profile={profile} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} onLogout={handleLogout} />
      <main className="flex-1 ml-64 p-8 lg:p-12 pb-24">
        <header className="flex justify-between items-center mb-10">
          <div className="relative w-96 hidden md:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Recherche..." className="w-full bg-white border-none rounded-2xl py-3 pl-12 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{profile.full_name}</p>
              <p className="text-xs font-medium text-emerald-600 uppercase tracking-widest">{profile.role}</p>
            </div>
            <img src={profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.id}`} alt="Profile" className="w-10 h-10 rounded-xl object-cover ring-2 ring-white shadow-sm" />
          </div>
        </header>
        {renderAdminContent()}
      </main>
    </div>
  );
};

export default App;
