import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Package, Plus, TrendingUp, Sprout, X, ShoppingBag, LeafyGreen, Calendar, AlertTriangle, Bell, Settings2, Download, Upload } from 'lucide-react';

interface IngredientDetail {
  id: string;
  name: string;
  stock: string;
  price: string;
  status: string;
  icon: string;
  nutrition: string;
  story: string;
  season: string;
}

const DEFAULT_PRODUCE_DATA: IngredientDetail[] = [
  { 
    id: 'calamansi-1',
    name: 'Native Calamansi', 
    stock: '50kg', 
    price: '₱80.00/kg', 
    status: 'In Season', 
    icon: '🍋',
    nutrition: 'High in Vitamin C, potassium, and calcium. Supports immune health.',
    story: 'Sourced from the Binalonan hillside, these native calamansi are hand-picked at peak ripeness to ensure maximum juice content and acidity.',
    season: 'Year-round (Peak: August - October)'
  },
  { 
    id: 'rice-1',
    name: 'Organic Dinorado Rice', 
    stock: '200kg', 
    price: '₱65.00/kg', 
    status: 'Available', 
    icon: '🌾',
    nutrition: 'High fiber content, rich in manganese and magnesium. Gluten-free energy source.',
    story: 'Grown using traditional rain-fed methods in Asingan, this aromatic rice variety supports heritage seed preservation in Pangasinan.',
    season: 'Harvest: November - January'
  },
  { 
    id: 'eggplant-1',
    name: 'Lowland Eggplant', 
    stock: '30kg', 
    price: '₱45.00/kg', 
    status: 'New Harvest', 
    icon: '🍆',
    nutrition: 'Rich in antioxidants like nasunin, fiber, and B-vitamins for brain health.',
    story: 'Cultivated in the fertile plains of Villasis, our eggplants are grown without synthetic pesticides, resulting in a firm, sweet flesh.',
    season: 'Year-round (Best: February - June)'
  },
  { 
    id: 'corn-1',
    name: 'Sweet Corn (Urdaneta)', 
    stock: '100 ears', 
    price: '₱15.00/ea', 
    status: 'In Season', 
    icon: '🌽',
    nutrition: 'Good source of lutein and zeaxanthin for eye health. Rich in complex carbohydrates.',
    story: 'From the heart of Urdaneta City, this legendary sweet corn is famous for its natural sugar content and crisp texture.',
    season: 'April - August'
  },
];

export default function Harvest({ user }: { user: User }) {
  const [selectedItem, setSelectedItem] = useState<IngredientDetail | null>(null);
  const [sortBy, setSortBy] = useState<'quantity' | 'price' | 'status' | null>(null);
  const [thresholds, setThresholds] = useState<Record<string, number>>({});
  const [syncing, setSyncing] = useState(false);
  const [produceData, setProduceData] = useState<IngredientDetail[]>(DEFAULT_PRODUCE_DATA);
  const [toasts, setToasts] = useState<{ id: string, title: string, message: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevLowStockIds = useRef<Set<string>>(new Set());

  // Load persistent thresholds on mount
  useEffect(() => {
    const docRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(docRef, (userDoc) => {
      if (userDoc.exists() && userDoc.data().alertThresholds) {
        setThresholds(userDoc.data().alertThresholds);
      } else if (!userDoc.exists() || !userDoc.data().alertThresholds) {
        // Fallback for first-time use
        setThresholds(prev => Object.keys(prev).length === 0 ? {
          'calamansi-1': 60,
          'eggplant-1': 10
        } : prev);
      }
      if (userDoc.exists() && userDoc.data().produceLedger) {
        setProduceData(userDoc.data().produceLedger);
      }
    }, (error) => {
      console.error("Error listening to user doc:", error);
    });
    
    return () => unsub();
  }, [user.uid]);

  const parseStock = (stockStr: string) => parseFloat(stockStr.replace(/[^0-9.]/g, '')) || 0;

  const getSortedData = () => {
    let data = [...produceData];
    if (!sortBy) return data;

    return data.sort((a, b) => {
      if (sortBy === 'quantity') {
        const valA = parseStock(a.stock);
        const valB = parseStock(b.stock);
        return valB - valA; // High to low stock
      }
      if (sortBy === 'price') {
        const valA = parseFloat(a.price.replace(/[^0-9.]/g, '')) || 0;
        const valB = parseFloat(b.price.replace(/[^0-9.]/g, '')) || 0;
        return valA - valB; // Low to high price
      }
      if (sortBy === 'status') {
        return (a.status || '').localeCompare(b.status || '');
      }
      return 0;
    });
  };

  const lowStockItems = produceData.filter(item => {
    const threshold = thresholds[item.id] || 0;
    return parseStock(item.stock) < threshold;
  });

  // Trigger real-time toasts for new low-stock items
  useEffect(() => {
    const currentLowIds = new Set(lowStockItems.map(i => i.id));
    const newLowItems = lowStockItems.filter(i => !prevLowStockIds.current.has(i.id));
    
    if (newLowItems.length > 0) {
      const newToasts = newLowItems.map(item => ({
        id: `toast_${Date.now()}_${item.id}`,
        title: "Critical Supply Alert",
        message: `Your stock of ${item.name} has fallen below the safety threshold (${item.stock} left). Consider re-ordering immediately.`
      }));
      
      setToasts(prev => [...prev, ...newToasts]);
      
      newToasts.forEach(t => {
        setTimeout(() => {
          setToasts(prev => prev.filter(x => x.id !== t.id));
        }, 8000);
      });
    }

    prevLowStockIds.current = currentLowIds;
  }, [lowStockItems]);

  const handleUpdateThreshold = async (id: string, val: string) => {
    const num = parseInt(val) || 0;
    const newThresholds = { ...thresholds, [id]: num };
    setThresholds(newThresholds);
    
    // De-bounce or immediate sync for demo
    setSyncing(true);
    try {
      await setDoc(doc(db, 'users', user.uid), { alertThresholds: newThresholds }, { merge: true });
    } finally {
      setSyncing(false);
    }
  };

  const exportCSV = () => {
    // Generate CSV from current produce data
    const headers = ['id', 'name', 'stock', 'price', 'status', 'icon', 'nutrition', 'story', 'season'];
    const rows = produceData.map(item => headers.map(h => `"${(item[h as keyof IngredientDetail] || '').replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Stock_Ledger_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      
      const lines = text.split('\n');
      if (lines.length < 2) return;
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const newProduceData: IngredientDetail[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const rawValues = line.match(/(?:\"([^\"]*)\")|([^\,]+)/g) || [];
        const values = rawValues.map(v => v.replace(/^"|"$/g, '').trim());
        
        const obj: Partial<IngredientDetail> = {};
        headers.forEach((h, idx) => {
           if (idx < values.length) {
              obj[h as keyof IngredientDetail] = values[idx] || '';
           }
        });
        
        if (obj.id && obj.name) {
           newProduceData.push(obj as IngredientDetail);
        }
      }

      setProduceData(newProduceData);
      setSyncing(true);
      try {
        await setDoc(doc(db, 'users', user.uid), { produceLedger: newProduceData }, { merge: true });
      } finally {
        setSyncing(false);
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-12 gap-6 relative"
    >
      <div className="col-span-12 lg:col-span-12 flex flex-col lg:flex-row justify-between items-start lg:items-end mb-4 gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter">Harvest Control</h2>
          <p className="text-stone-500 font-bold text-xs uppercase tracking-[0.2em]">Listing active for 142 clients</p>
        </div>
        <div className="flex flex-wrap gap-4">
           {/* Hidden File Input */}
           <input 
             type="file" 
             accept=".csv" 
             className="hidden" 
             ref={fileInputRef} 
             onChange={importCSV} 
           />
           <button 
             onClick={exportCSV}
             className="bg-stone-100 text-stone-900 px-6 py-4 border-2 border-stone-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center gap-2"
           >
             <Download size={16} /> Export to Excel
           </button>
           <button 
             onClick={() => fileInputRef.current?.click()}
             className="bg-indigo-100 text-indigo-900 px-6 py-4 border-2 border-indigo-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(49,46,129,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center gap-2"
           >
             <Upload size={16} /> Import from Excel
           </button>
           <button className="bg-emerald-600 text-white px-8 py-4 border-2 border-stone-900 rounded-2xl font-black text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-center flex items-center gap-2">
             <Plus size={16} /> Add Batch
           </button>
        </div>
      </div>

      <AnimatePresence>
        {lowStockItems.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="col-span-12 overflow-hidden"
          >
            <div className="bg-rose-50 border-2 border-rose-900 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[8px_8px_0px_0px_rgba(225,29,72,0.1)]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-rose-600 border-2 border-stone-900 rounded-xl flex items-center justify-center text-white">
                  <Bell size={24} className="animate-bounce" />
                </div>
                <div>
                  <h4 className="font-black uppercase text-rose-900 tracking-tighter">Supply Critical Alert</h4>
                  <p className="text-xs font-bold text-rose-700 uppercase tracking-widest whitespace-nowrap">
                    {lowStockItems.length} items below safety threshold
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {lowStockItems.slice(0, 3).map(item => (
                  <div key={item.id} className="bg-white border-2 border-stone-900 px-3 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-2">
                    {item.icon} {item.name}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="col-span-12 md:col-span-4 bento-card">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 border-2 border-stone-900 rounded-xl flex items-center justify-center bg-emerald-50">
            <Sprout size={24} className="text-emerald-600" />
          </div>
          <div className="bento-tag-emerald">+12%</div>
        </div>
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1">Seasonal Yield</p>
        <p className="text-4xl font-black font-display">1.4 <span className="text-lg">tons</span></p>
      </div>

      <div className="col-span-12 md:col-span-4 bento-card">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 border-2 border-stone-900 rounded-xl flex items-center justify-center bg-amber-50">
            <TrendingUp size={24} className="text-amber-600" />
          </div>
        </div>
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1">Direct Profit (PHP)</p>
        <p className="text-4xl font-black font-display">₱24,820</p>
      </div>

      <div className="col-span-12 md:col-span-4 bento-card">
        <div className="flex justify-between items-start mb-6">
          <div className="w-12 h-12 border-2 border-stone-900 rounded-xl flex items-center justify-center bg-blue-50">
            <Package size={24} className="text-blue-600" />
          </div>
        </div>
        <p className="text-stone-400 text-[10px] font-black uppercase tracking-widest mb-1">Active Batches</p>
        <p className="text-4xl font-black font-display">08 <span className="text-lg uppercase">Riders</span></p>
      </div>

      <div className="col-span-12 bento-card">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h3 className="font-black text-xl tracking-tighter uppercase">Live Produce Ledger</h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-stone-400 mr-2 tracking-widest">Sort by:</span>
            <button 
              onClick={() => setSortBy(sortBy === 'quantity' ? null : 'quantity')} 
              className={`px-4 py-2 border-2 border-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'quantity' ? 'bg-stone-900 text-white shadow-none' : 'bg-white hover:bg-stone-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
            >
              Stock
            </button>
            <button 
              onClick={() => setSortBy(sortBy === 'price' ? null : 'price')} 
              className={`px-4 py-2 border-2 border-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'price' ? 'bg-stone-900 text-white shadow-none' : 'bg-white hover:bg-stone-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
            >
              Price
            </button>
            <button 
              onClick={() => setSortBy(sortBy === 'status' ? null : 'status')} 
              className={`px-4 py-2 border-2 border-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'status' ? 'bg-stone-900 text-white shadow-none' : 'bg-white hover:bg-stone-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
            >
              Status
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {getSortedData().map((item) => {
            const isLowStock = parseStock(item.stock) < (thresholds[item.id] || 0);
            return (
              <div 
                key={item.id} 
                onClick={() => setSelectedItem(item)}
                className={`flex items-center justify-between p-6 border-[3px] rounded-2xl hover:bg-white transition-all cursor-pointer group relative overflow-hidden ${
                  isLowStock 
                    ? 'bg-rose-50 border-rose-600 shadow-[4px_4px_0px_0px_rgba(225,29,72,1)]' 
                    : 'bg-stone-50 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                }`}
              >
                {isLowStock && (
                  <div className="absolute top-0 right-0 bg-rose-600 text-white px-4 py-1.5 rounded-bl-2xl border-l-2 border-b-2 border-rose-900 text-[10px] font-black uppercase tracking-widest z-10 flex items-center gap-1.5">
                    <AlertTriangle size={12} className="animate-pulse" /> Supply Critical
                  </div>
                )}
                <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 bg-white border-2 border-stone-900 rounded-xl flex items-center justify-center text-3xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:bg-emerald-50 transition-colors ${isLowStock ? 'border-rose-600 shadow-[2px_2px_0px_0px_rgba(225,29,72,1)]' : ''}`}>
                    {item.icon}
                  </div>
                  <div>
                    <p className={`font-black uppercase text-sm leading-tight ${isLowStock ? 'text-rose-900' : ''}`}>{item.name}</p>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mt-1">{item.status}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-2xl ${isLowStock ? 'text-rose-600' : ''}`}>{item.stock}</p>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">{item.price}</p>
                  <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <span className="text-[8px] font-black uppercase text-stone-400 tracking-widest leading-none">Alert threshold:</span>
                    <input 
                      type="number" 
                      value={thresholds[item.id] !== undefined ? thresholds[item.id] : ''}
                      onChange={(e) => handleUpdateThreshold(item.id, e.target.value)}
                      placeholder="0"
                      className="w-14 bg-white border-2 border-stone-200 rounded-md px-1.5 py-0.5 text-xs font-black text-center text-stone-900 focus:border-stone-900 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ingredient Detail Dialog */}
      <AnimatePresence>
        {selectedItem && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-[70] p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="bento-card relative shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] bg-white overflow-hidden">
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-6 right-6 p-2 rounded-xl hover:bg-stone-100 transition-colors border-2 border-transparent hover:border-stone-900"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-6 mb-8 pt-4">
                  <div className="w-20 h-20 bg-stone-100 border-2 border-stone-900 rounded-3xl flex items-center justify-center text-5xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    {selectedItem.icon}
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-3xl font-black tracking-tighter uppercase leading-none mb-2">{selectedItem.name}</h3>
                    <div className="flex gap-2">
                       <span className="bento-tag-emerald">{selectedItem.status}</span>
                       <span className="bento-tag">{selectedItem.price}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Alert Threshold Setting */}
                  <div className="p-5 bg-stone-900 text-white border-2 border-stone-900 rounded-2xl relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Settings2 size={16} className="text-emerald-400" />
                        <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400 font-display">Alert Settings</h4>
                      </div>
                      <AnimatePresence>
                        {syncing && (
                          <motion.span 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-[8px] font-black uppercase text-emerald-400 animate-pulse"
                          >
                            Saving to OS...
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {parseStock(selectedItem.stock) < (thresholds[selectedItem.id] || 0) && (
                        <span className="bg-rose-600 text-white px-2 py-1 rounded text-[8px] font-black uppercase">Low Stock active</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                       <div className="flex-grow">
                          <p className="text-[10px] font-black uppercase text-stone-400 mb-2">Notify when stock below ({selectedItem.stock.replace(/[0-9.]/g, '')})</p>
                          <input 
                            type="number" 
                            value={thresholds[selectedItem.id] || 0}
                            onChange={(e) => handleUpdateThreshold(selectedItem.id, e.target.value)}
                            className="w-full bg-stone-800 border-2 border-stone-700 rounded-xl px-4 py-2 text-white font-black focus:border-emerald-500 outline-none transition-colors"
                          />
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-stone-400 mb-1">Current</p>
                          <p className="text-2xl font-black">{selectedItem.stock}</p>
                       </div>
                    </div>
                  </div>

                  <div className="p-5 bg-emerald-50 border-2 border-stone-900 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                       <LeafyGreen size={16} className="text-emerald-700" />
                       <h4 className="text-xs font-black uppercase tracking-widest text-emerald-900">Nutritional Profile</h4>
                    </div>
                    <p className="text-sm font-bold text-emerald-800 leading-relaxed">{selectedItem.nutrition}</p>
                  </div>

                  <div className="p-5 bg-stone-50 border-2 border-stone-900 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                       <ShoppingBag size={16} className="text-stone-700" />
                       <h4 className="text-xs font-black uppercase tracking-widest text-stone-900">Farmer's Story</h4>
                    </div>
                    <p className="text-sm font-bold text-stone-600 leading-relaxed italic mb-4">"{selectedItem.story}"</p>
                    <div className="flex items-center gap-2 bg-white/50 p-2 rounded-lg border border-stone-200">
                      <div className="w-6 h-6 bg-emerald-600 rounded flex items-center justify-center">
                        <TrendingUp size={12} className="text-white" />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-tighter">Harvested in Pangasinan District 3</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-5 bg-amber-50 border-2 border-stone-900 rounded-2xl">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-white border-2 border-stone-900 rounded-xl flex items-center justify-center">
                          <Calendar size={20} className="text-amber-600" />
                       </div>
                       <div>
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-900 leading-none">Seasonality</h4>
                          <p className="text-sm font-black mt-1 uppercase">{selectedItem.season}</p>
                       </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => setSelectedItem(null)}
                  className="w-full mt-8 bg-stone-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[4px_4px_0px_0px_rgba(16,185,129,1)] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
                >
                  Close Terminal
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-4 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white border-[3px] border-stone-900 p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(225,29,72,1)] flex items-start gap-3 pointer-events-auto"
            >
              <div className="bg-rose-100 p-2 rounded-xl mt-1">
                <AlertTriangle size={20} className="text-rose-600" />
              </div>
              <div className="flex-grow">
                <h4 className="font-black uppercase text-rose-900 tracking-tighter leading-tight mb-1">{toast.title}</h4>
                <p className="text-xs font-bold text-stone-500 leading-snug">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="text-stone-400 hover:text-stone-900 transition-colors"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
