
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ClientApp from './pages/ClientApp';
import LivreurApp from './pages/LivreurApp';
import AuthPage from './pages/AuthPage';
import WelcomePage from './pages/WelcomePage';
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
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    // Check if we are coming from an email confirmation link
    // Supabase redirects often contain #access_token or similar
    const hash = window.location.hash;
    const isEmailConfirm = hash.includes('access_token') && (hash.includes('type=signup') || hash.includes('type=recovery'));

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id, isEmailConfirm);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        // Only show welcome on initial SIGNED_IN event if it looks like a confirmation
        fetchProfile(session.user.id, event === 'SIGNED_IN' && isEmailConfirm);
      } else {
        setProfile(null);
        setLoading(false);
        setShowWelcome(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, shouldShowWelcome: boolean = false) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) {
      setProfile(data);
      if (shouldShowWelcome) {
        setShowWelcome(true);
      } else {
        if (data.role === 'ADMIN') setActiveTab('dashboard');
        else if (data.role === 'CLIENT') setActiveTab('client-app');
        else if (data.role === 'LIVREUR') setActiveTab('driver-app');
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleFinishWelcome = () => {
    setShowWelcome(false);
    if (profile) {
      if (profile.role === 'ADMIN') setActiveTab('dashboard');
      else if (profile.role === 'CLIENT') setActiveTab('client-app');
      else if (profile.role === 'LIVREUR') setActiveTab('driver-app');
    }
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

  // Show Welcome Screen if triggered by email confirmation
  if (showWelcome) {
    return <WelcomePage profile={profile} onContinue={handleFinishWelcome} />;
  }

  if (profile.role === 'CLIENT') {
    return (
      <div className="relative">
        <button onClick={handleLogout} className="fixed top-6 left-6 z-50 bg-white/80 backdrop-blur p-3 rounded-full shadow-lg text-red-500 hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
        <ClientApp profile={profile} />
      </div>
    );
  }

  if (profile.role === 'LIVREUR') {
    return (
      <div className="relative">
        <button onClick={handleLogout} className="fixed top-6 left-6 z-50 bg-white/80 backdrop-blur p-3 rounded-full shadow-lg text-red-500 hover:bg-red-50 transition-colors"><LogOut size={20} /></button>
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
            <input type="text" placeholder="Recherche..." className="w-full bg-white border-none rounded-2xl py-3 pl-12 pr-4 text-sm shadow-sm focus:ring-2 focus:ring-emerald-500 outline-none font-medium" />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-bold text-gray-900">{profile.full_name}</p>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">{profile.role}</p>
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
