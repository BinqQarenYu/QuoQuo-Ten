import { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, setDoc, query, collection, onSnapshot, orderBy, updateDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Globe, BarChart3, Users, Leaf, ArrowUpRight, Zap, Map as MapIcon, Navigation } from 'lucide-react';
import { optimizeDeliveryRoute, RouteEfficiency } from '../../services/logisticsService';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons not loading correctly in some environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const farmIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/tractor.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: 'custom-leaflet-icon-amber',
});

const hubIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/home.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: 'custom-leaflet-icon-blue',
});

const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/navigation.svg',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  className: 'custom-leaflet-icon-emerald',
});

const customerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/shopping-bag.svg',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  className: 'custom-leaflet-icon-stone',
});

export default function Hub({ user }: { user: User }) {
  const [efficiency, setEfficiency] = useState<RouteEfficiency | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simMarkers, setSimMarkers] = useState<{lat: number, lng: number, type: 'rider' | 'farm' | 'customer'}[]>([]);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [dbStats, setDbStats] = useState({ txCount: 0 });

  const [transactions, setTransactions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'map' | 'orders'>('orders');

  useEffect(() => {
    // Simulate optimizing a batch of orders
    const result = optimizeDeliveryRoute([{}, {}, {}]);
    setEfficiency(result);

    // Fetch real transactions
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs: any[] = [];
      snapshot.forEach((doc) => {
        txs.push({ id: doc.id, ...doc.data() });
      });
      setTransactions(txs);
      setDbStats(prev => ({ ...prev, txCount: txs.length }));
    }, (error) => {
      console.error('Error fetching transactions:', error);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (isSimulating) {
      simIntervalRef.current = setInterval(async () => {
        // Generate a live mock transaction
        const now = Date.now();
        const txId = `sim_tx_${Math.random().toString(36).substring(2, 9)}_${now}`;
        try {
          await setDoc(doc(db, 'transactions', txId), {
            clientId: user.uid, // Using admin's uid so we don't need real client IDs
            status: Math.random() > 0.5 ? 'processing' : 'shipped',
            totalAmount: Math.floor(Math.random() * 7000) + 150,
            paymentStatus: 'paid', // Admin allowed to create paid
            items: [{ produceId: 'sim_prod', quantity: Math.floor(Math.random() * 5) + 1, price: 100 }],
            createdAt: now,
            updatedAt: now
          });
          setDbStats(prev => ({ txCount: prev.txCount + 1 }));
        } catch (e) {
          console.error("Simulation DB Write Error:", e);
        }
      }, 2500); // Fire a transaction every 2.5s for "live" feel
    } else {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    }
    return () => {
      if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    }
  }, [isSimulating, user.uid]);

  const toggleSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      setSimMarkers([]);
    } else {
      setIsSimulating(true);
      const newMarkers: {lat: number, lng: number, type: 'rider' | 'farm' | 'customer'}[] = [];
      const centerLat = 15.96;
      const centerLng = 120.56;
      
      // Generate 200 customers, 50 farms, 80 riders in the region
      for(let i=0; i<330; i++) {
        let type: 'rider' | 'farm' | 'customer' = 'customer';
        if (i < 50) type = 'farm';
        else if (i < 130) type = 'rider';
        
        newMarkers.push({
          lat: centerLat + (Math.random() - 0.5) * 0.3,
          lng: centerLng + (Math.random() - 0.5) * 0.3,
          type
        });
      }
      setSimMarkers(newMarkers);
    }
  };

  // Hub and Farm locations for the batch
  const centralHub: [number, number] = [15.9761, 120.5707]; // Urdaneta
  const farm1: [number, number] = [15.9015, 120.5898]; // Villasis
  const farm2: [number, number] = [16.0433, 120.5983]; // Binalonan
  const farm3: [number, number] = [15.9288, 120.5050]; // Malasiqui

  // Batched routes
  const routeAlpha: [number, number][] = [farm1, [15.93, 120.58], [15.95, 120.575], centralHub];
  const routeBeta: [number, number][] = [farm2, [16.01, 120.58], [15.99, 120.575], centralHub];
  const routeGamma: [number, number][] = [farm3, [15.94, 120.52], [15.96, 120.55], centralHub];

  // Moving riders (simulated positions)
  const rider1Pos: [number, number] = [15.94, 120.578];
  const rider2Pos: [number, number] = [16.00, 120.577];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-12 grid-rows-6 gap-6 h-full"
    >
      {/* Network Stats Bar */}
      <div className="col-span-12 flex justify-between items-center mb-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase">Network Hub <span className="text-emerald-600">v4.2</span></h2>
          <p className="text-stone-500 font-bold text-xs uppercase tracking-[0.2em]">Live supply chain oversight</p>
        </div>
        <div className="flex gap-2 bg-stone-100 p-1 rounded-xl border-2 border-stone-900">
           <button 
             onClick={() => setActiveTab('orders')}
             className={`px-4 py-2 font-black uppercase text-xs rounded-lg transition-all ${activeTab === 'orders' ? 'bg-white shadow-sm text-stone-900 border-2 border-stone-900' : 'text-stone-400 hover:text-stone-600 border-2 border-transparent'}`}
           >
             Operations List
           </button>
           <button 
             onClick={() => setActiveTab('map')}
             className={`px-4 py-2 font-black uppercase text-xs rounded-lg transition-all ${activeTab === 'map' ? 'bg-white shadow-sm text-stone-900 border-2 border-stone-900' : 'text-stone-400 hover:text-stone-600 border-2 border-transparent'}`}
           >
             Live Map View
           </button>
        </div>
      </div>

      {activeTab === 'map' ? (
        <>
          {/* Main Optimization Engine (Bento Card Large) */}
          <div className="col-span-12 lg:col-span-8 row-span-4 bento-card relative overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-8 z-10">
          <div>
             <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
               Fleet Engine
               {isSimulating && <span className="bg-red-500 text-white text-[9px] px-2 py-0.5 rounded-full animate-pulse shadow-md">MASSIVE SIM ACTIVE</span>}
               {isSimulating && <span className="bg-stone-900 text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-mono flex items-center gap-1 shadow-md"><Zap size={8} /> {dbStats.txCount} TXNS</span>}
             </h3>
             <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Global Route Batching</p>
             <button 
               onClick={toggleSimulation} 
               className={`mt-2 text-[10px] px-3 py-1.5 rounded-lg border-2 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${isSimulating ? 'bg-red-100 text-red-600 border-red-600' : 'bg-stone-900 text-white border-stone-900'}`}
             >
               {isSimulating ? 'Stop Simulation' : 'Run Massive Simulation'}
             </button>
          </div>
          <div className="text-right">
             <span className="text-3xl font-black">{isSimulating ? '8,424.2 km' : efficiency?.totalDistance || '14.2 km'}</span>
             <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Active Batch Length</p>
          </div>
        </div>

        {/* Global Route Batching Map */}
        <div className="flex-grow bg-stone-50 rounded-3xl overflow-hidden relative min-h-[300px] border-2 border-stone-900 border-b-8 z-0">
          <MapContainer 
            center={[15.96, 120.56]} 
            zoom={11} 
            zoomControl={true}
            scrollWheelZoom={true}
            className="w-full h-full"
            attributionControl={false}
          >
            {/* Google Maps Hybrid (Satellite + Streets) */}
            <TileLayer
              attribution="&copy; Google Maps"
              url="https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
              subdomains={['mt0','mt1','mt2','mt3']}
            />
            
            {/* Batched Routes */}
            <Polyline positions={routeAlpha} pathOptions={{ color: '#f59e0b', weight: 4, opacity: 0.8 }} />
            <Polyline positions={routeBeta} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }} />
            <Polyline positions={routeGamma} pathOptions={{ color: '#8b5cf6', weight: 4, opacity: 0.8, dashArray: '8, 8' }} />

            {/* Farm Origins */}
            <Marker position={farm1} icon={farmIcon}>
              <Popup className="font-black uppercase text-xs">Farm Alpha (Villasis)</Popup>
            </Marker>
            <Marker position={farm2} icon={farmIcon}>
              <Popup className="font-black uppercase text-xs">Farm Beta (Binalonan)</Popup>
            </Marker>
            <Marker position={farm3}>
              <Popup className="font-black uppercase text-xs">Farm Gamma (Malasiqui) - Prep Phase</Popup>
            </Marker>

            {/* Central Hub Destination */}
            <Marker position={centralHub} icon={hubIcon}>
              <Popup className="font-black uppercase text-xs">Central Sortation Hub</Popup>
            </Marker>

            {/* Active Active Riders */}
            <Marker position={rider1Pos} icon={riderIcon}>
              <Popup className="font-black uppercase text-xs text-emerald-600">Rider #124 - Batch A</Popup>
            </Marker>
            <Marker position={rider2Pos} icon={riderIcon}>
              <Popup className="font-black uppercase text-xs text-blue-600">Rider #088 - Batch B</Popup>
            </Marker>
            
            {/* Massive Simulation Markers */}
            {isSimulating && simMarkers.map((marker, idx) => (
              <Marker 
                key={idx} 
                position={[marker.lat, marker.lng]} 
                icon={marker.type === 'farm' ? farmIcon : marker.type === 'rider' ? riderIcon : customerIcon}
              >
              </Marker>
            ))}
          </MapContainer>
          
          <div className="absolute top-4 right-4 z-[400] flex gap-2">
             <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 flex items-center gap-2 shadow-2xl">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-[9px] font-black text-white uppercase tracking-widest">Live Fleet: {isSimulating ? '82' : '2'}</span>
             </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-6 z-10">
           <div className="p-4 bg-stone-100 rounded-2xl border-2 border-stone-900 border-b-4">
             <p className="text-[9px] uppercase text-stone-400 font-black tracking-widest leading-none mb-1">Batch Load</p>
             <p className="text-sm font-black uppercase">{isSimulating ? '12,450kg Mixed' : '42kg Mixed'}</p>
           </div>
           <div className="p-4 bg-stone-100 rounded-2xl border-2 border-stone-900 border-b-4">
             <p className="text-[9px] uppercase text-stone-400 font-black tracking-widest leading-none mb-1">Merged Routes</p>
             <p className="text-sm font-black uppercase">{isSimulating ? '2,140 ➔ 312 Loops' : '5 ➔ 2 Loops'}</p>
           </div>
           <div className="p-4 bg-emerald-600 text-white rounded-2xl border-2 border-stone-900 border-b-4">
             <p className="text-[9px] uppercase text-emerald-200 font-black tracking-widest leading-none mb-1">CO2 Delta</p>
             <p className="text-sm font-black uppercase">{isSimulating ? '-9,842.4 kg' : '-18.4 kg'}</p>
           </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="col-span-12 lg:col-span-4 row-span-2 bento-card-dark">
         <h3 className="text-lg font-black uppercase mb-6 text-emerald-400 tracking-tighter">Impact Summary</h3>
         <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-white/10 pb-4">
              <div>
                <p className="text-4xl font-black text-white leading-none tracking-tighter">{isSimulating ? '142.8t' : '1.2t'}</p>
                <p className="text-[10px] uppercase font-black text-stone-500 mt-2 tracking-widest">Carbon Neutralized</p>
              </div>
              <div className="w-16 h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                <div className={`bg-emerald-500 h-full ${isSimulating ? 'w-[98%]' : 'w-[84%]'}`} />
              </div>
            </div>
            <div className="flex justify-between items-center">
               <div>
                  <p className="text-2xl font-black">{isSimulating ? '₱18,442,000' : '₱742,000'}</p>
                  <p className="text-[10px] uppercase font-bold text-stone-500 tracking-widest">Local Payouts</p>
               </div>
               <ArrowUpRight className="text-emerald-500" />
            </div>
         </div>
      </div>

      {/* Efficiency Alerts */}
      <div className="col-span-12 lg:col-span-4 row-span-2 bento-card">
         <h3 className="text-lg font-black uppercase mb-6 tracking-tighter">System Alerts</h3>
         <div className="space-y-4">
            <div className="p-4 bg-amber-50 border-2 border-stone-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
               <p className="text-xs font-black uppercase tracking-widest mb-1">{isSimulating ? 'Massive Demand' : 'Low Inventory'}</p>
               <p className="text-xs font-bold leading-tight">{isSimulating ? 'Surge in orders outstripping supply in Area X. Recalibrating dynamic pricing.' : 'Baker\'s Mill Sourdough stock critically low for batch #44.'}</p>
            </div>
            <div className="p-4 bg-blue-50 border-2 border-stone-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[4px_6px_0px_0px_rgba(0,0,0,1)] transition-all">
               <p className="text-xs font-black uppercase tracking-widest mb-1">Route Sync</p>
               <p className="text-xs font-bold leading-tight">{isSimulating ? '74 batched routes optimized. 12 minor delays reported due to weather.' : 'High density detected in Area B. Sourcing recalibration required.'}</p>
            </div>
         </div>
      </div>

      {/* Sustainable Ledger (Footprint) */}
      <div className="col-span-12 bento-card bg-emerald-50 border-emerald-900">
         <div className="flex items-center gap-6">
            <Globe className="text-emerald-900" size={32} />
            <div>
               <h4 className="text-emerald-900 font-black uppercase tracking-widest text-sm leading-none">Sustainability Protocol Active</h4>
               <p className="text-emerald-700 text-xs font-bold mt-1">Our algorithm has merged 8 active deliveries into 2 optimized relay loops today, saving 42kg of carbon emissions.</p>
            </div>
         </div>
      </div>
      </>
      ) : (
        <div className="col-span-12 bento-card pb-8">
           <div className="flex justify-between items-center mb-6">
             <h3 className="text-xl font-black uppercase tracking-tighter">Kitchen Meal Kit Orders</h3>
             <span className="bg-emerald-100 text-emerald-800 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded border-2 border-emerald-800 shadow-[2px_2px_0_0_#065f46]">{transactions.filter(t => t.type === 'meal_kit' || !t.type).length} Active Runs</span>
           </div>
           
           <div className="space-y-6">
             {transactions.filter(t => t.type === 'meal_kit' || t.recipes).map((tx) => (
               <div key={tx.id} className="border-2 border-stone-900 rounded-2xl overflow-hidden shadow-[4px_4px_0_0_#1c1917] bg-white">
                 <div className="bg-stone-100 border-b-2 border-stone-900 p-4 flex justify-between items-center h-full">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-1">Order Ref: {tx.id.substring(0,12)}...</p>
                      <h4 className="font-black text-lg uppercase tracking-tight">{tx.recipes?.map((r: any) => `${r.title} (x${r.servings})`).join(', ')}</h4>
                    </div>
                    <div className="text-right">
                       <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase border-2 shadow-[2px_2px_0_0_rgba(0,0,0,1)] ${tx.status === 'pending' ? 'bg-amber-400 text-black border-stone-900' : tx.status === 'shipped' ? 'bg-blue-400 text-black border-stone-900' : 'bg-emerald-400 text-white border-stone-900'}`}>
                         {tx.status}
                       </span>
                    </div>
                 </div>
                 
                 <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 border-b-2 border-stone-100 pb-2">Ingredients Source (Farms)</h5>
                       <table className="w-full text-left border-collapse">
                         <thead>
                           <tr>
                             <th className="text-[9px] uppercase tracking-widest font-bold text-stone-400 pb-2 border-b border-stone-100">Item</th>
                             <th className="text-[9px] uppercase tracking-widest font-bold text-stone-400 pb-2 border-b border-stone-100">Qty</th>
                             <th className="text-[9px] uppercase tracking-widest font-bold text-stone-400 pb-2 border-b border-stone-100">Farm/Provider</th>
                           </tr>
                         </thead>
                         <tbody>
                           {tx.items?.map((item: any, i: number) => (
                             <tr key={i} className="group">
                               <td className="py-2 text-xs font-black uppercase border-b border-stone-50 group-last:border-0">{item.name || item.produceId}</td>
                               <td className="py-2 text-xs font-bold border-b border-stone-50 group-last:border-0">{item.quantity}</td>
                               <td className="py-2 text-[10px] font-bold text-emerald-600 border-b border-stone-50 group-last:border-0">{item.farmerName || 'Hub / Mixed'}</td>
                             </tr>
                           ))}
                         </tbody>
                       </table>
                    </div>
                    <div>
                       <h5 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-3 border-b-2 border-stone-100 pb-2">Logistics Assignment</h5>
                       <div className="space-y-3">
                          <label className="block text-[10px] font-black uppercase tracking-widest text-stone-500">Assign Rider</label>
                          <select 
                            className="w-full bg-stone-50 border-2 border-stone-300 rounded-xl px-4 py-2 text-sm font-black uppercase"
                            value={tx.riderId || ""}
                            onChange={async (e) => {
                               try {
                                 await updateDoc(doc(db, 'transactions', tx.id), {
                                    riderId: e.target.value,
                                    status: e.target.value ? 'shipped' : 'pending' // Just a mock transition
                                 });
                               } catch (err) {
                                  console.error("Failed to assign rider", err);
                               }
                            }}
                          >
                             <option value="">-- Unassigned --</option>
                             <option value="rider_124">Rider #124 (Active)</option>
                             <option value="rider_088">Rider #088 (Returning)</option>
                             <option value="rider_042">Rider #042 (Standby)</option>
                          </select>
                          {tx.riderId && (
                             <p className="text-[10px] font-bold text-emerald-600 mt-2 bg-emerald-50 p-2 rounded">
                               Assigned. Rider will be notified to collect items from listed farms.
                             </p>
                          )}
                       </div>
                    </div>
                 </div>
               </div>
             ))}
             {transactions.filter(t => t.type === 'meal_kit' || t.recipes).length === 0 && (
               <div className="py-12 text-center text-stone-400">
                  <p className="font-black uppercase tracking-widest text-sm">No Active Meal Kit Orders</p>
               </div>
             )}
           </div>
        </div>
      )}
    </motion.div>
  );
}
