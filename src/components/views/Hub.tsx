import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';
import { Globe, BarChart3, Users, Leaf, ArrowUpRight, Zap, Map as MapIcon } from 'lucide-react';
import { optimizeDeliveryRoute, RouteEfficiency } from '../../services/logisticsService';

export default function Hub({ user }: { user: User }) {
  const [efficiency, setEfficiency] = useState<RouteEfficiency | null>(null);

  useEffect(() => {
    // Simulate optimizing a batch of orders
    const result = optimizeDeliveryRoute([{}, {}, {}]);
    setEfficiency(result);
  }, []);

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
      </div>

      {/* Main Optimization Engine (Bento Card Large) */}
      <div className="col-span-12 lg:col-span-8 row-span-4 bento-card relative overflow-hidden flex flex-col">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Fleet Engine</h3>
            <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Global Route Batching</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black">{efficiency?.totalDistance || '14.2 km'}</span>
            <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Active Batch Length</p>
          </div>
        </div>

        {/* Abstract Schematic Viz */}
        <div className="flex-grow bg-stone-50 border-2 border-stone-100 rounded-3xl p-8 relative min-h-[300px]">
          <div className="absolute top-10 left-10 flex flex-col items-center">
            <div className="w-10 h-10 bg-amber-400 border-2 border-stone-900 rounded-full flex items-center justify-center text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">F1</div>
            <span className="text-9px mt-1 font-black uppercase tracking-tighter">Villasis Valley</span>
          </div>
          <div className="absolute bottom-10 left-32 flex flex-col items-center">
            <div className="w-10 h-10 bg-amber-400 border-2 border-stone-900 rounded-full flex items-center justify-center text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">F2</div>
            <span className="text-9px mt-1 font-black uppercase tracking-tighter">Binalonan Greens</span>
          </div>
          <div className="absolute top-20 right-20 flex flex-col items-center">
            <div className="w-10 h-10 bg-blue-400 border-2 border-stone-900 rounded-full flex items-center justify-center text-xs font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">C1</div>
            <span className="text-9px mt-1 font-black uppercase tracking-tighter">Urdaneta Central</span>
          </div>
          <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
            <path d="M 60 60 L 140 280 L 600 100" fill="none" stroke="black" strokeWidth="4" strokeDasharray="12 6" />
          </svg>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-6">
           <div className="p-4 bg-stone-100 rounded-2xl border-2 border-stone-900">
             <p className="text-[9px] uppercase text-stone-400 font-black tracking-widest leading-none mb-1">Batch Load</p>
             <p className="text-sm font-black uppercase">12kg Eggplant</p>
           </div>
           <div className="p-4 bg-stone-100 rounded-2xl border-2 border-stone-900">
             <p className="text-[9px] uppercase text-stone-400 font-black tracking-widest leading-none mb-1">Recipe Sync</p>
             <p className="text-sm font-black uppercase">Pinakbet-Set</p>
           </div>
           <div className="p-4 bg-emerald-600 text-white rounded-2xl border-2 border-stone-900">
             <p className="text-[9px] uppercase text-white/50 font-black tracking-widest leading-none mb-1">CO2 Delta</p>
             <p className="text-sm font-black uppercase">-12.2 kg</p>
           </div>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="col-span-12 lg:col-span-4 row-span-2 bento-card-dark">
         <h3 className="text-lg font-black uppercase mb-6 text-emerald-400 tracking-tighter">Impact Summary</h3>
         <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-white/10 pb-4">
              <div>
                <p className="text-4xl font-black text-white leading-none tracking-tighter">1.2t</p>
                <p className="text-[10px] uppercase font-black text-stone-500 mt-2 tracking-widest">Carbon Neutralized</p>
              </div>
              <div className="w-16 h-1 w-full bg-stone-800 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[84%]" />
              </div>
            </div>
            <div className="flex justify-between items-center">
               <div>
                  <p className="text-2xl font-black">₱742,000</p>
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
            <div className="p-4 bg-amber-50 border-2 border-stone-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
               <p className="text-xs font-black uppercase tracking-widest mb-1">Low Inventory</p>
               <p className="text-xs font-bold leading-tight">Baker's Mill Sourdough stock critically low for batch #44.</p>
            </div>
            <div className="p-4 bg-blue-50 border-2 border-stone-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
               <p className="text-xs font-black uppercase tracking-widest mb-1">Route Sync</p>
               <p className="text-xs font-bold leading-tight">High density detected in Area B. Sourcing recalibration required.</p>
            </div>
         </div>
      </div>

      {/* Sustainable Ledger (Footprint) */}
      <div className="col-span-12 lg:col-span-12 bento-card bg-emerald-50 border-emerald-900">
         <div className="flex items-center gap-6">
            <Globe className="text-emerald-900" size={32} />
            <div>
               <h4 className="text-emerald-900 font-black uppercase tracking-widest text-sm leading-none">Sustainability Protocol Active</h4>
               <p className="text-emerald-700 text-xs font-bold mt-1">Our algorithm has merged 8 active deliveries into 2 optimized relay loops today, saving 42kg of carbon emissions.</p>
            </div>
         </div>
      </div>
    </motion.div>
  );
}
