
import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  ArrowRight, 
  Zap, 
  ChevronLeft, 
  Loader2, 
  User, 
  Truck, 
  ShieldCheck, 
  Mail, 
  Lock, 
  Smartphone,
  MapPin,
  LockKeyhole,
  Info
} from 'lucide-react';

interface AuthPageProps {
  onLogin: (role: any) => void;
}

type AuthStep = 'role-selection' | 'auth-form';
type UserRole = 'CLIENT' | 'LIVREUR' | 'ADMIN';
type AuthMode = 'login' | 'signup';

const AuthPage: React.FC<AuthPageProps> = () => {
  const [step, setStep] = useState<AuthStep>('role-selection');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; type?: string } | null>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    region: 'Abidjan'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSelectRole = (role: UserRole) => {
    setSelectedRole(role);
    setStep('auth-form');
    setError(null);
    setMode('login');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signup' && selectedRole === 'CLIENT') {
        const { error: signUpError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
              phone: formData.phone,
              role: selectedRole,
              region_name: formData.region
            }
          }
        });
        
        if (signUpError) throw signUpError;
        
        alert("Compte créé ! Si 'Confirm Email' est activé dans Supabase, vérifiez vos mails. Sinon, connectez-vous.");
        setMode('login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) throw signInError;
      }
    } catch (err: any) {
      console.error("Auth Exception:", err);
      let msg = err.message || "Erreur de connexion.";
      let type = "";

      if (msg.includes("Email not confirmed")) {
        msg = "L'e-mail n'est pas confirmé. Désactivez 'Confirm Email' dans Authentication > Settings sur votre dashboard Supabase pour tester sans e-mail.";
        type = "warning";
      } else if (msg.includes("Invalid login credentials")) {
        msg = "Identifiants invalides. Vérifiez votre e-mail ou créez un compte.";
      }

      setError({ message: msg, type });
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { id: 'CLIENT' as UserRole, title: 'Client', desc: 'Commander du gaz en 1 clic', icon: <User size={32} />, color: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:border-emerald-500' },
    { id: 'LIVREUR' as UserRole, title: 'Livreur', desc: 'Accès transporteur (Professionnel)', icon: <Truck size={32} />, color: 'bg-orange-50 text-orange-600 border-orange-100 hover:border-orange-500' },
    { id: 'ADMIN' as UserRole, title: 'Administrateur', desc: 'Gestion centralisée GazFlow', icon: <ShieldCheck size={32} />, color: 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:border-indigo-500' }
  ];

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-50 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-50 rounded-full blur-3xl opacity-50" />

      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-xl mx-auto mb-6 transform hover:rotate-6 transition-transform">
            <Zap size={32} />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">GazFlow</h1>
          <p className="text-gray-500 mt-2 font-medium">Distribution d'énergie intelligente</p>
        </div>

        {step === 'role-selection' ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h2 className="text-xl font-bold text-center mb-8 text-gray-800">Choisissez votre profil</h2>
            <div className="grid grid-cols-1 gap-4">
              {roles.map((role) => (
                <button key={role.id} onClick={() => handleSelectRole(role.id)} className={`flex items-center gap-6 p-6 rounded-3xl border-2 transition-all group text-left ${role.color}`}>
                  <div className="p-4 bg-white rounded-2xl shadow-sm group-hover:scale-110 transition-transform">{role.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-black text-lg text-gray-900">{role.title}</h3>
                    <p className="text-sm text-gray-500 font-medium">{role.desc}</p>
                  </div>
                  <ArrowRight className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white border border-gray-100 shadow-2xl rounded-[40px] p-8 md:p-10 animate-in slide-in-from-right-8 duration-500">
            <button onClick={() => setStep('role-selection')} className="flex items-center gap-2 text-gray-400 font-bold text-sm mb-8 hover:text-gray-900 transition-colors">
              <ChevronLeft size={20} /> Retour
            </button>

            <div className="flex justify-between items-end mb-8">
              <div>
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest block mb-1">Espace {selectedRole}</span>
                <h2 className="text-3xl font-black text-gray-900">{selectedRole === 'CLIENT' ? (mode === 'login' ? 'Connexion' : 'Inscription') : 'Connexion Pro'}</h2>
              </div>
              {selectedRole === 'CLIENT' && (
                <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-sm font-bold text-emerald-600 hover:underline">
                  {mode === 'login' ? "Créer un compte" : "Se connecter"}
                </button>
              )}
            </div>

            {selectedRole !== 'CLIENT' && (
              <div className="mb-6 p-4 bg-slate-50 text-slate-600 rounded-2xl text-[11px] font-semibold flex items-start gap-3 border border-slate-100">
                <LockKeyhole size={18} className="shrink-0 text-slate-400 mt-0.5" />
                <div><p className="text-slate-900 mb-1">Accès restreint</p>Inscriptions gérées par l'administration.</div>
              </div>
            )}

            {error && (
              <div className={`mb-6 p-4 rounded-2xl text-xs font-bold border flex items-center gap-3 animate-shake ${
                error.type === 'warning' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                <div className={`w-2 h-2 rounded-full shrink-0 ${error.type === 'warning' ? 'bg-orange-500' : 'bg-red-600'}`} />
                <span className="leading-tight">{error.message}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
              {mode === 'signup' && selectedRole === 'CLIENT' && (
                <>
                  <div className="relative">
                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input name="fullName" placeholder="Nom complet" required className="w-full bg-gray-50 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent focus:bg-white transition-all font-medium text-gray-900" value={formData.fullName} onChange={handleChange} />
                  </div>
                  <div className="relative">
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input name="phone" placeholder="Téléphone" required className="w-full bg-gray-50 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent focus:bg-white transition-all font-medium text-gray-900" value={formData.phone} onChange={handleChange} />
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <select name="region" className="w-full bg-gray-50 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent focus:bg-white transition-all font-medium text-gray-900 appearance-none" value={formData.region} onChange={handleChange}>
                      <option value="Abidjan">Abidjan, Côte d'Ivoire</option>
                      <option value="Dakar">Dakar, Sénégal</option>
                      <option value="Lomé">Lomé, Togo</option>
                    </select>
                  </div>
                </>
              )}
              
              <div className="relative">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input name="email" type="email" placeholder="Email" required className="w-full bg-gray-50 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent focus:bg-white transition-all font-medium text-gray-900" value={formData.email} onChange={handleChange} />
              </div>

              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input name="password" type="password" placeholder="Mot de passe" required className="w-full bg-gray-50 rounded-2xl py-4 pl-14 pr-6 outline-none focus:ring-2 focus:ring-emerald-500 border border-transparent focus:bg-white transition-all font-medium text-gray-900" value={formData.password} onChange={handleChange} />
              </div>

              <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white py-4 mt-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin" size={24} /> : <>{mode === 'login' ? 'Se connecter' : 'Confirmer'}<ArrowRight size={20} /></>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
