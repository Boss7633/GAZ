
import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Truck, MapPin, Loader2, Navigation, AlertCircle, RefreshCw } from 'lucide-react';

const DeliveryMap: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [activeDrivers, setActiveDrivers] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const mapRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);

  useEffect(() => {
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      mapRef.current = L.map('admin-map').setView([5.3484, -4.0305], 13); // Abidjan par défaut
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(mapRef.current);
      
      // Groupe pour gérer les marqueurs proprement
      layerGroupRef.current = L.featureGroup().addTo(mapRef.current);
    }

    fetchData();

    // Souscription temps réel aux changements de profils (positions livreurs)
    const driverSub = supabase.channel('driver-locations-realtime')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles',
        filter: 'role=eq.LIVREUR' 
      }, (payload) => {
        console.log("Mise à jour position reçue:", payload.new);
        fetchData();
      })
      .subscribe();

    const orderSub = supabase.channel('order-tracking-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(driverSub);
      supabase.removeChannel(orderSub);
    };
  }, []);

  // Fonction utilitaire pour parser les points PostGIS
  const parsePostGISPoint = (loc: any): [number, number] | null => {
    if (!loc) return null;
    try {
      // Si c'est une chaîne "POINT(lng lat)"
      if (typeof loc === 'string') {
        const coords = loc.match(/-?\d+\.?\d*/g);
        if (coords && coords.length >= 2) {
          // PostGIS est LNG LAT -> Leaflet a besoin de [LAT, LNG]
          return [parseFloat(coords[1]), parseFloat(coords[0])];
        }
      } 
      // Si c'est déjà un objet (certains drivers Supabase retournent du GeoJSON)
      if (loc.coordinates) {
        return [loc.coordinates[1], loc.coordinates[0]];
      }
    } catch (e) {
      console.error("Erreur parsing position:", e);
    }
    return null;
  };

  const fetchData = async () => {
    const L = (window as any).L;
    if (!L || !layerGroupRef.current) return;
    
    // Récupérer livreurs en ligne
    const { data: drivers } = await supabase
      .from('profiles')
      .select('id, full_name, last_location, role, is_online')
      .eq('role', 'LIVREUR')
      .eq('is_online', true);

    // Récupérer commandes actives
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, delivery_location, total_amount')
      .neq('status', 'DELIVERED')
      .neq('status', 'CANCELLED');

    setActiveDrivers(drivers || []);
    setPendingOrders(orders || []);
    setLoading(false);

    // Vider les anciens marqueurs
    layerGroupRef.current.clearLayers();

    // Ajouter marqueurs livreurs
    drivers?.forEach(d => {
      const coords = parsePostGISPoint(d.last_location);
      if (coords) {
        const marker = L.marker(coords, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="bg-blue-600 p-2 rounded-full shadow-lg border-2 border-white text-white animate-pulse">
                     <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                       <rect x="1" y="3" width="15" height="13"></rect>
                       <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                       <circle cx="5.5" cy="18.5" r="2.5"></circle>
                       <circle cx="18.5" cy="18.5" r="2.5"></circle>
                     </svg>
                   </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).bindPopup(`<b>Livreur:</b> ${d.full_name}<br/><span class="text-xs text-emerald-600 font-bold uppercase">En ligne</span>`);
        layerGroupRef.current.addLayer(marker);
      }
    });

    // Ajouter marqueurs commandes
    orders?.forEach(o => {
      const coords = parsePostGISPoint(o.delivery_location);
      if (coords) {
        const marker = L.marker(coords, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div class="bg-orange-500 p-2 rounded-full shadow-lg border-2 border-white text-white">
                     <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path>
                       <path d="M3 6h18"></path>
                       <path d="M16 10a4 4 0 0 1-8 0"></path>
                     </svg>
                   </div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).bindPopup(`<b>Commande:</b> #${o.id.slice(0,5)}<br/><b>Statut:</b> ${o.status}`);
        layerGroupRef.current.addLayer(marker);
      }
    });

    // Ajuster la vue si des marqueurs existent
    if (layerGroupRef.current.getLayers().length > 0) {
      mapRef.current.fitBounds(layerGroupRef.current.getBounds(), { padding: [50, 50], maxZoom: 15 });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Suivi GPS Temps Réel</h2>
          <p className="text-gray-500 mt-1">Localisation précise des livreurs et des points de livraison.</p>
        </div>
        <div className="flex gap-3">
           <button onClick={fetchData} className="p-3 bg-white border border-gray-200 rounded-2xl hover:bg-gray-50 text-gray-600 transition-all">
             <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
           </button>
           <div className="bg-white px-5 py-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-bold text-gray-700">{activeDrivers.length} Livreurs</span>
           </div>
           <div className="bg-white px-5 py-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-sm font-bold text-gray-700">{pendingOrders.length} Commandes</span>
           </div>
        </div>
      </div>

      <div className="relative group">
        <div id="admin-map" className="shadow-2xl border border-gray-200 z-10 transition-all group-hover:border-emerald-200"></div>
        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-md z-20 flex flex-col items-center justify-center rounded-[24px]">
            <Loader2 className="animate-spin text-emerald-600 mb-4" size={48} />
            <p className="font-black text-emerald-900 text-sm uppercase tracking-widest">Initialisation GPS...</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
          <h3 className="font-black text-gray-900 text-lg mb-6 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Truck size={20} /></div>
            Livreurs en mission
          </h3>
          <div className="space-y-4">
            {activeDrivers.map(d => (
              <div key={d.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl hover:bg-blue-50/50 transition-colors border border-transparent hover:border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  <span className="font-bold text-gray-800 text-sm">{d.full_name}</span>
                </div>
                <span className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded-lg font-black uppercase tracking-tighter shadow-sm">Signal GPS OK</span>
              </div>
            ))}
            {activeDrivers.length === 0 && (
              <div className="text-center py-10 opacity-40">
                <AlertCircle size={32} className="mx-auto mb-2" />
                <p className="text-sm font-bold uppercase tracking-widest">Aucun livreur connecté</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm">
          <h3 className="font-black text-gray-900 text-lg mb-6 flex items-center gap-3">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><MapPin size={20} /></div>
            Alertes Livraison
          </h3>
          <div className="space-y-4">
             {pendingOrders.map(o => (
               <div key={o.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-transparent hover:border-orange-100 transition-all">
                  <div>
                    <span className="font-black text-gray-900 text-sm italic">ID {o.id.slice(0,8)}</span>
                    <p className="text-[10px] text-orange-600 font-black uppercase tracking-widest mt-0.5">{o.status}</p>
                  </div>
                  <button className="p-3 bg-white text-blue-600 hover:bg-blue-600 hover:text-white rounded-xl shadow-sm transition-all">
                    <Navigation size={18} />
                  </button>
               </div>
             ))}
             {pendingOrders.length === 0 && (
               <div className="text-center py-10 opacity-40">
                 <AlertCircle size={32} className="mx-auto mb-2" />
                 <p className="text-sm font-bold uppercase tracking-widest">Tout est calme</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeliveryMap;
