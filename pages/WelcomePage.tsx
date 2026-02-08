
import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Zap, Sparkles, Loader2 } from 'lucide-react';
import { Profile } from '../types';

interface WelcomePageProps {
  profile: Profile;
  onContinue: () => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ profile, onContinue }) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-50 rounded-full blur-3xl opacity-40 animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50 rounded-full blur-3xl opacity-40 animate-pulse" />

      <div className={`max-w-md w-full text-center transition-all duration-1000 transform ${showContent ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'}`}>
        
        {/* Success Icon Animation */}
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-emerald-200 rounded-full blur-xl opacity-50 animate-ping" />
          <div className="relative w-24 h-24 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-2xl">
            <CheckCircle size={48} strokeWidth={3} />
          </div>
          <div className="absolute -top-2 -right-2 text-yellow-400 animate-bounce">
            <Sparkles size={24} />
          </div>
        </div>

        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
          Compte Confirmé !
        </h1>
        
        <p className="text-gray-500 text-lg font-medium mb-10 leading-relaxed">
          Bienvenue dans la famille <span className="text-emerald-600 font-bold">GazFlow</span>, {profile.full_name}. Votre accès est désormais activé.
        </p>

        <div className="bg-gray-50 border border-gray-100 rounded-[32px] p-6 mb-10 flex items-center gap-4 text-left">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm">
            <Zap size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Votre Profil</p>
            <p className="font-bold text-gray-900">{profile.role === 'CLIENT' ? 'Client Particulier' : profile.role === 'LIVREUR' ? 'Partenaire Livreur' : 'Administrateur'}</p>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all group"
        >
          Accéder à mon espace
          <ArrowRight className="group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="mt-8 text-xs text-gray-400 font-bold uppercase tracking-widest">
          GazFlow • Énergie intelligente pour l'Afrique
        </p>
      </div>
    </div>
  );
};

export default WelcomePage;
