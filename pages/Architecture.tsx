
import React from 'react';
import { Database, ShieldCheck, Zap, Globe, Smartphone, Code, FileText } from 'lucide-react';

const Architecture: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl animate-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Backend Supabase</h2>
          <p className="text-gray-500 mt-2">Architecture PostgreSQL optimisée pour le déploiement en Afrique de l'Ouest.</p>
        </div>
        <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest border border-emerald-200">
          Ready for Deployment
        </div>
      </div>

      {/* Stack Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Database /></div>
          <div>
            <h4 className="font-bold">PostgreSQL + PostGIS</h4>
            <p className="text-sm text-gray-500">Géolocalisation des livraisons et des stocks.</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><ShieldCheck /></div>
          <div>
            <h4 className="font-bold">Auth & RLS</h4>
            <p className="text-sm text-gray-500">Sécurisation granulaire des données par rôle.</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl"><Zap /></div>
          <div>
            <h4 className="font-bold">Real-time DB</h4>
            <p className="text-sm text-gray-500">Alerte stock et tracking livreur instantané.</p>
          </div>
        </div>
      </div>

      {/* Code Display */}
      <div className="bg-gray-900 text-white rounded-3xl shadow-2xl relative overflow-hidden border border-gray-800">
        <div className="flex items-center justify-between px-8 py-4 border-b border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">supabase_schema.sql</span>
          </div>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
          </div>
        </div>
        
        <div className="p-6 overflow-hidden">
          <pre className="text-[13px] font-mono text-emerald-300/90 overflow-x-auto leading-relaxed custom-scrollbar">
{`-- Table des commandes avec support géographique
CREATE TABLE public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    client_id UUID REFERENCES public.profiles(id),
    status order_status DEFAULT 'PENDING',
    payment_method payment_method NOT NULL,
    delivery_location GEOGRAPHY(POINT), -- Utilise PostGIS
    total_amount DECIMAL NOT NULL,
    otp_code TEXT -- Pour validation livraison
);

-- Politiques de Sécurité (RLS)
CREATE POLICY "Client: Voir ses commandes" 
ON public.orders FOR SELECT 
USING (auth.uid() = client_id);`}
          </pre>
        </div>
        
        <div className="px-8 py-4 bg-gray-950 border-t border-gray-800 flex justify-between items-center">
          <p className="text-[10px] text-gray-500 font-medium">PostgreSQL 15.x compatible</p>
          <button className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold transition-colors">
            COPIER LE SCRIPT COMPLET
          </button>
        </div>
      </div>

      {/* Logic Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Smartphone size={20} className="text-blue-500" />
            Flux d'Inscription
          </h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <p className="text-sm text-gray-600 leading-relaxed"><strong>Auth OTP:</strong> L'utilisateur entre son numéro. Firebase/Supabase envoie un SMS.</p>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
              <p className="text-sm text-gray-600 leading-relaxed"><strong>Auto-Profile:</strong> Le trigger SQL crée l'entrée dans <code>profiles</code> avec le rôle choisi.</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Globe size={20} className="text-emerald-500" />
            Webhooks Paiements
          </h3>
          <p className="text-sm text-gray-500 mb-6 italic leading-relaxed">
            Intégration avec les agrégateurs locaux (CinetPay, Fedapay, Hub2) via Edge Functions.
          </p>
          <div className="flex gap-3">
            <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600">MTN MoMo</span>
            <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600">Orange Money</span>
            <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-bold text-gray-600">Wave CI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Architecture;
