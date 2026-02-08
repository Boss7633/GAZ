
import React from 'react';
import { NAVIGATION, COLORS } from '../constants';
import { LogOut } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, onLogout }) => {
  return (
    <div className="w-64 bg-white border-r h-screen fixed left-0 top-0 flex flex-col shadow-sm z-40">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white shadow-lg">
          <span className="font-bold text-xl">G</span>
        </div>
        <div>
          <h1 className="font-bold text-gray-900 leading-tight text-lg">GazFlow</h1>
          <p className="text-[10px] text-emerald-600 font-bold tracking-widest uppercase">Admin SaaS</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {NAVIGATION.map((item) => (
          <button
            key={item.path}
            onClick={() => setActiveTab(item.path)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              activeTab === item.path
                ? 'bg-emerald-50 text-emerald-700 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <span className={activeTab === item.path ? 'text-emerald-600' : 'text-gray-400'}>
              {item.icon}
            </span>
            <span className="font-semibold text-sm">{item.name}</span>
            {activeTab === item.path && (
              <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600" />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t space-y-2">
        <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
            <span className="text-xs font-bold">AD</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-xs font-bold text-gray-900 truncate">Admin</p>
            <p className="text-[10px] text-gray-500 truncate">Connecté</p>
          </div>
        </div>
        
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Déconnexion</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
