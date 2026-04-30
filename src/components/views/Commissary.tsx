import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query } from 'firebase/firestore';
import { motion } from 'motion/react';
import { Store, Plus, Package, MapPin, Trash2, ShoppingBag, ShoppingCart, Tent, Download, Upload } from 'lucide-react';

interface CommissaryItem {
  id: string;
  name: string;
  category: string;
  supplier: string;
  stock: number;
  unit: string;
  price: number;
  createdAt: number;
  updatedAt: number;
}

const categories = ['condiment', 'meat', 'vegetable', 'other'];

const getSuppliers = (roleType: string) => {
  if (roleType === 'commissary') return ['QUOQUO Commissary', 'Central Commissary', 'Local Producers'];
  if (roleType === 'grocery') return ['Local Grocery', 'Urdaneta Public Market', 'Binalonan Agrivet'];
  if (roleType === 'supermarket') return ['Puregold Urdaneta', 'CSI Supermarket', 'Magic Mall Supermarket'];
  if (roleType === 'foodstall') return ['Local Food Stall', 'Villasis Butchery', 'Street Market'];
  return ['Urdaneta Public Market', 'Villasis Butchery', 'Binalonan Agrivet', 'Local Producers'];
};

const StoreInventoryCard: React.FC<{ 
  supplier: string; 
  items: CommissaryItem[]; 
  handleDelete: (id: string) => void;
}> = ({ supplier, items, handleDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'condiment',
    stock: 0,
    unit: 'kg',
    price: 0
  });

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(true);
    const now = Date.now();
    const id = `com_${Math.random().toString(36).substr(2, 9)}`;
    const docData: any = {
      ...newItem,
      supplier,
      stock: Number(newItem.stock),
      price: Number(newItem.price),
      createdAt: now,
      updatedAt: now
    };
    try {
      await setDoc(doc(db, 'commissaryItems', id), docData);
      setNewItem({ name: '', category: 'condiment', stock: 0, unit: 'kg', price: 0 });
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsAdding(false); 
    }
  };

  return (
    <div className="bg-white p-6 rounded-3xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col mb-8 last:mb-0">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-stone-100">
        <Store size={28} className="text-emerald-600" />
        <h3 className="text-2xl font-black uppercase tracking-tight text-stone-800">{supplier}</h3>
        <span className="ml-auto bg-stone-100 text-stone-600 px-3 py-1 rounded-lg text-xs font-bold uppercase">
          {items.length} Items Listed
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ADD INVENTORY FORM */}
        <div className="col-span-1 bg-stone-50 border-2 border-stone-200 rounded-2xl p-4 h-fit">
          <h4 className="text-sm font-black uppercase tracking-widest text-stone-500 mb-4 flex items-center gap-2">
            <Package size={16} /> Add Inventory
          </h4>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Item Name</label>
              <input type="text" required value={newItem.name} onChange={e => setNewItem({...newItem, name: e.target.value})} className="w-full bg-white border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none" placeholder="e.g. Dressed Chicken" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Category</label>
                <select value={newItem.category} onChange={e => setNewItem({...newItem, category: e.target.value})} className="w-full bg-white border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none">
                  {categories.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Stock</label>
                <input type="number" min="0" required value={newItem.stock} onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})} className="w-full bg-white border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Unit</label>
                <input type="text" required value={newItem.unit} onChange={e => setNewItem({...newItem, unit: e.target.value})} className="w-full bg-white border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none" placeholder="kg, pcs..." />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-stone-400 mb-1">Price (₱)</label>
                <input type="number" min="0" required value={newItem.price} onChange={e => setNewItem({...newItem, price: Number(e.target.value)})} className="w-full bg-white border-2 border-stone-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-emerald-500 focus:outline-none" />
              </div>
            </div>
            <button type="submit" disabled={isAdding} className="w-full mt-2 bg-stone-900 text-white rounded-xl py-2.5 font-black uppercase text-xs border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50">
              Add Item
            </button>
          </form>
        </div>

        {/* INVENTORY LEDGER */}
        <div className="col-span-1 lg:col-span-2 flex flex-col">
          <h4 className="text-sm font-black uppercase tracking-widest text-stone-500 mb-4">Stock Ledger</h4>
          <div className="flex-grow space-y-3 max-h-[350px] overflow-y-auto pr-2">
            {items.length === 0 ? (
               <div className="text-center py-12 border-2 border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                 <Package size={32} className="mx-auto mb-2 text-stone-300" />
                 <p className="font-bold uppercase text-[10px] text-stone-400">No inventory for this provider.</p>
               </div>
            ) : (
               items.map(item => (
                 <div key={item.id} className="bg-white border-2 border-stone-200 rounded-2xl p-4 flex justify-between items-center group transition-colors hover:border-emerald-400">
                    <div>
                      <div className="flex gap-2 items-center mb-1">
                        <span className={`text-[8px] px-1.5 py-0.5 rounded uppercase font-black ${ item.category === 'meat' ? 'bg-red-100 text-red-600' : item.category === 'condiment' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600' }`}>
                          {item.category}
                        </span>
                        <h4 className="font-black text-base uppercase tracking-tighter text-stone-800">{item.name}</h4>
                      </div>
                      <p className="text-[10px] uppercase font-bold text-stone-400">Listed: {new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="font-black text-lg text-stone-800">₱{item.price}</p>
                        <p className="text-[9px] uppercase font-bold text-stone-400">per {item.unit}</p>
                      </div>
                      <div className="w-16">
                        <p className={`font-black text-lg ${item.stock < 10 ? 'text-red-500' : 'text-stone-800'}`}>{item.stock}</p>
                        <p className="text-[9px] uppercase font-bold text-stone-400">In Stock</p>
                      </div>
                      <button onClick={() => handleDelete(item.id)} className="p-2 border-2 border-stone-200 text-stone-400 rounded-xl hover:border-red-500 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100" title="Remove Item"><Trash2 size={16} /></button>
                    </div>
                 </div>
               ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Commissary({ user, roleType = 'commissary' }: { user: User, roleType?: string }) {
  const currentSuppliers = getSuppliers(roleType);
  const [items, setItems] = useState<CommissaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'commissaryItems'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dbItems: CommissaryItem[] = [];
      snapshot.forEach(doc => {
        dbItems.push({ id: doc.id, ...doc.data() } as CommissaryItem);
      });
      dbItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(dbItems);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching commissary items:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateMockItem = async () => {
    const now = Date.now();
    const id = `com_${Math.random().toString(36).substr(2, 9)}`;
    // Assign to a random supplier from current context
    const randomSupplier = currentSuppliers[Math.floor(Math.random() * currentSuppliers.length)];
    const mock = { name: 'Dressed Chicken', category: 'meat', supplier: randomSupplier, stock: 50, unit: 'kg', price: 180, createdAt: now, updatedAt: now };
    try {
      await setDoc(doc(db, 'commissaryItems', id), mock);
    } catch (e) { console.error(e); } 
  };

  const handleDelete = async (id: string) => {
    try { await deleteDoc(doc(db, 'commissaryItems', id)); } 
    catch (e) { console.error(e); }
  };

  const exportCSV = () => {
    const headers = ['id', 'name', 'category', 'supplier', 'stock', 'unit', 'price'];
    const rows = items.map(item => 
      headers.map(h => `"${(item[h as keyof CommissaryItem] || '').toString().replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Provider_Inventory_${new Date().toISOString().split('T')[0]}.csv`;
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
      
      // Map over imports to write them to database
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const rawValues = line.match(/(?:\"([^\"]*)\")|([^\,]+)/g) || [];
        const values = rawValues.map(v => v.replace(/^"|"$/g, '').trim());
        
        const obj: any = {};
        headers.forEach((h, idx) => {
           if (idx < values.length) {
              obj[h] = values[idx] || '';
           }
        });
        
        if (obj.name) {
           const id = obj.id || `com_${Math.random().toString(36).substr(2, 9)}`;
           const now = Date.now();
           // if supplier isn't defined or isn't in current group, maybe map it?
           const fallbackSupplier = currentSuppliers.find(s => s.toLowerCase().includes((obj.store || obj.supplier || '').toLowerCase())) || obj.supplier || obj.store || currentSuppliers[0];
           
           const itemData: any = {
             name: obj.name || obj.item,
             category: obj.category || 'condiment',
             supplier: fallbackSupplier,
             stock: obj.stock !== undefined ? Number(obj.stock) : (obj.quantity ? parseInt(obj.quantity, 10) || 50 : 0),
             unit: obj.unit || (obj.quantity && typeof obj.quantity === 'string' && obj.quantity.includes('kg') ? 'kg' : 'pcs'),
             price: Number(obj.price || obj.unitPricePhP) || 0,
             updatedAt: now,
           };
           // Only set createdAt if adding new
           if (!obj.id) itemData.createdAt = now;
           
           await setDoc(doc(db, 'commissaryItems', id), itemData, { merge: true });
        }
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="h-full flex flex-col gap-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-6 rounded-3xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] gap-4">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
            {roleType === 'grocery' ? <ShoppingBag className="text-emerald-600" size={36} /> : roleType === 'supermarket' ? <ShoppingCart className="text-emerald-600" size={36} /> : roleType === 'foodstall' ? <Tent className="text-emerald-600" size={36} /> : <Store className="text-emerald-600" size={36} />}
            {roleType === 'grocery' ? 'Grocery Terminals' : roleType === 'supermarket' ? 'Supermarket Terminals' : roleType === 'foodstall' ? 'Food Stall Terminals' : 'Commissary Terminals'}
          </h2>
          <p className="text-stone-500 font-bold text-sm uppercase tracking-[0.1em] mt-1">Independent Provider Ledgers</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            accept=".csv" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={importCSV} 
          />
          <button onClick={exportCSV} className="bg-stone-100 text-stone-900 px-4 py-2 rounded-xl font-black uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-2">
            <Download size={16} /> Export All CSV
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="bg-indigo-100 text-indigo-900 px-4 py-2 rounded-xl font-black uppercase text-sm border-2 border-indigo-900 shadow-[2px_2px_0px_0px_rgba(49,46,129,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-2">
            <Upload size={16} /> Import Data
          </button>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 pb-10">
        {loading ? (
          <div className="text-center py-20 font-black uppercase tracking-widest text-stone-400">Loading Integrations...</div>
        ) : (
          <div className="space-y-6">
             {currentSuppliers.map(supplier => (
               <StoreInventoryCard 
                 key={supplier}
                 supplier={supplier}
                 items={items.filter(item => item.supplier === supplier)}
                 handleDelete={handleDelete}
               />
             ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
