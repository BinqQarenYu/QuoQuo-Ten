import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db, auth } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Database, Plus, CheckCircle, XCircle, Clock, AlertCircle, ShoppingCart, BookOpen, Pencil, Save, X } from 'lucide-react';
import { mockRecipes } from '../../lib/recipeData';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface Transaction {
  id: string;
  clientId: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'failed' | 'cancelled';
  totalAmount: number;
  paymentStatus: 'unpaid' | 'paid';
  items: any[];
  createdAt: number;
  updatedAt: number;
}

export default function DatabaseOps({ user }: { user: User }) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'recipes' | 'simulate'>('transactions');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<any>(null);

  const downloadCSV = (filename: string, data: any[]) => {
    if (data.length === 0) return;
    const header = Object.keys(data[0]).join(',') + '\n';
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePuregoldSheet = () => {
    const puregoldInventory = [
      { sku: 'PG-1001', item: 'Local Rice (Sinandomeng)', category: 'Staples', quantity: '5kg package', unitPricePhP: 245, store: 'Puregold' },
      { sku: 'PG-1002', item: 'Spicy Century Tuna', category: 'Canned Goods', quantity: '155g can', unitPricePhP: 42, store: 'Puregold' },
      { sku: 'PG-1003', item: 'Lucky Me Pancit Canton', category: 'Pantry', quantity: '1 pack', unitPricePhP: 16, store: 'Puregold' },
      { sku: 'PG-1004', item: 'Washed Sugar', category: 'Pantry', quantity: '1kg pack', unitPricePhP: 75, store: 'Puregold' },
      { sku: 'PG-1005', item: 'Alaska Evaporada', category: 'Dairy', quantity: '370ml can', unitPricePhP: 38, store: 'Puregold' },
      { sku: 'PG-1006', item: 'Silver Swan Soy Sauce', category: 'Condiments', quantity: '1L bottle', unitPricePhP: 50, store: 'Puregold' },
      { sku: 'PG-1007', item: 'Datu Puti Vinegar', category: 'Condiments', quantity: '1L bottle', unitPricePhP: 48, store: 'Puregold' },
      { sku: 'PG-1008', item: 'Nescafe Classic', category: 'Beverages', quantity: '200g jar', unitPricePhP: 160, store: 'Puregold' },
      { sku: 'PG-1009', item: 'Bear Brand Powdered Milk', category: 'Dairy', quantity: '320g pack', unitPricePhP: 110, store: 'Puregold' },
      { sku: 'PG-1010', item: 'Tide Laundry Powder', category: 'Household', quantity: '1kg pack', unitPricePhP: 180, store: 'Puregold' },
    ];
    downloadCSV('Puregold_Inventory_Sim.csv', puregoldInventory);
  };

  const generateCSISheet = () => {
    const csiInventory = [
      { sku: 'CSI-A1', item: 'Premium Jasmine Rice', category: 'Staples', quantity: '25kg sack', unitPricePhP: 1250, store: 'CSI Supermarket' },
      { sku: 'CSI-A2', item: 'San Marino Corned Tuna', category: 'Canned Goods', quantity: '180g can', unitPricePhP: 55, store: 'CSI Supermarket' },
      { sku: 'CSI-A3', item: 'Nissin Cup Noodles', category: 'Pantry', quantity: '1 cup', unitPricePhP: 25, store: 'CSI Supermarket' },
      { sku: 'CSI-A4', item: 'Brown Sugar', category: 'Pantry', quantity: '1kg pack', unitPricePhP: 65, store: 'CSI Supermarket' },
      { sku: 'CSI-A5', item: 'Nestle All Purpose Cream', category: 'Dairy', quantity: '250ml tetra', unitPricePhP: 68, store: 'CSI Supermarket' },
      { sku: 'CSI-A6', item: 'Maggi Magic Sarap', category: 'Condiments', quantity: '14 sachets', unitPricePhP: 55, store: 'CSI Supermarket' },
      { sku: 'CSI-A7', item: 'UFC Banana Ketchup', category: 'Condiments', quantity: '320g bottle', unitPricePhP: 35, store: 'CSI Supermarket' },
      { sku: 'CSI-A8', item: 'Milo Chocolate Powder', category: 'Beverages', quantity: '1kg pack', unitPricePhP: 290, store: 'CSI Supermarket' },
      { sku: 'CSI-A9', item: 'Magnolia Cheezee', category: 'Dairy', quantity: '165g box', unitPricePhP: 45, store: 'CSI Supermarket' },
      { sku: 'CSI-A10', item: 'Joy Dishwashing Liquid', category: 'Household', quantity: '500ml bottle', unitPricePhP: 115, store: 'CSI Supermarket' },
    ];
    downloadCSV('CSI_Inventory_Sim.csv', csiInventory);
  };

  useEffect(() => {
    const q = query(collection(db, 'transactions'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const txs: Transaction[] = [];
      snapshot.forEach(doc => {
        txs.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      txs.sort((a,b) => b.createdAt - a.createdAt);
      setTransactions(txs);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'transactions');
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab === 'recipes') {
      const fetchRecipes = () => {
        setRecipesLoading(true);
        const q = query(collection(db, 'recipes'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const recs: any[] = [];
            snapshot.forEach(d => recs.push({ id: d.id, ...d.data() }));
            recs.sort((a, b) => b.createdAt - a.createdAt);
            setRecipes(recs);
            setRecipesLoading(false);
        }, (error) => {
            handleFirestoreError(error, OperationType.GET, 'recipes');
        });
        return unsubscribe;
      };
      const unsob = fetchRecipes();
      return () => unsob();
    }
  }, [activeTab]);

  const seedRecipes = async () => {
    setRecipesLoading(true);
    try {
      const now = Date.now();
      const promises = mockRecipes.map(async (rec, idx) => {
        const recipeId = `rec_${now}_${idx}`;
        await setDoc(doc(db, 'recipes', recipeId), {
          ...rec,
          createdAt: now,
          updatedAt: now
        });
      });
      await Promise.all(promises);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'recipes');
    }
  };

  const createMockTransaction = async () => {
    const newId = `tx_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    try {
      await setDoc(doc(db, 'transactions', newId), {
        clientId: user.uid,
        status: 'pending',
        totalAmount: Math.floor(Math.random() * 5000) + 100,
        paymentStatus: 'unpaid',
        items: [{ produceId: 'prod_1', quantity: 2, price: 100 }],
        createdAt: now,
        updatedAt: now
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `transactions/${newId}`);
    }
  };

  const updateStatus = async (id: string, newStatus: string, actionAllowedFields: string[]) => {
      // In a real scenario, this matches the Action updates in rules
      // e.g. cancellation by client
      try {
        await updateDoc(doc(db, 'transactions', id), {
            status: newStatus,
            updatedAt: Date.now()
        });
      } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `transactions/${id}`);
      }
  }

  const deleteTransaction = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recipes', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `recipes/${id}`);
    }
  };

  const saveRecipe = async () => {
    if (!editingRecipe || !editingRecipe.id) return;
    try {
      await updateDoc(doc(db, 'recipes', editingRecipe.id), {
        title: editingRecipe.title,
        description: editingRecipe.description,
        category: editingRecipe.category || "Main Course",
        carbonSavings: editingRecipe.carbonSavings,
        yields: editingRecipe.yields,
        updatedAt: Date.now()
      });
      setEditingRecipe(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `recipes/${editingRecipe.id}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full flex flex-col gap-6"
    >
      <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center gap-6">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-3">
              <Database className="text-emerald-600" /> Database Ops
            </h2>
            <p className="text-stone-500 font-bold text-xs uppercase tracking-[0.2em]">Firestore Management</p>
          </div>
          <div className="flex bg-stone-100 rounded-xl p-1 border-2 border-stone-200 ml-4">
            <button 
              onClick={() => setActiveTab('transactions')}
              className={`px-4 py-2 font-black uppercase text-xs rounded-lg transition-all ${activeTab === 'transactions' ? 'bg-white shadow-sm text-stone-900 border-2 border-stone-900' : 'text-stone-400 hover:text-stone-600 border-2 border-transparent'}`}
            >
              Transactions
            </button>
            <button 
              onClick={() => setActiveTab('recipes')}
              className={`px-4 py-2 font-black uppercase text-xs rounded-lg transition-all flex items-center gap-2 ${activeTab === 'recipes' ? 'bg-white shadow-sm text-stone-900 border-2 border-stone-900' : 'text-stone-400 hover:text-stone-600 border-2 border-transparent'}`}
            >
              Recipes
            </button>
            <button 
              onClick={() => setActiveTab('simulate')}
              className={`px-4 py-2 font-black uppercase text-xs rounded-lg transition-all flex items-center gap-2 ${activeTab === 'simulate' ? 'bg-white shadow-sm text-stone-900 border-2 border-stone-900' : 'text-stone-400 hover:text-stone-600 border-2 border-transparent'}`}
            >
              Simulate
            </button>
          </div>
        </div>

        {activeTab === 'transactions' ? (
          <button 
            onClick={createMockTransaction}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-black uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-2"
          >
            <Plus size={16} /> New Transaction
          </button>
        ) : activeTab === 'recipes' ? (
          <button 
            onClick={seedRecipes}
            disabled={recipesLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black uppercase text-sm border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-2 disabled:opacity-50"
          >
            <BookOpen size={16} className={recipesLoading ? 'animate-pulse' : ''} /> Seed 35 Recipes
          </button>
        ) : null}
      </div>

      <div className="bento-card flex-grow overflow-hidden flex flex-col">
        <h3 className="text-lg font-black uppercase mb-4 tracking-tighter">
          {activeTab === 'transactions' ? 'Ledger Entries' : activeTab === 'recipes' ? 'Standard Recipes Menu' : 'Mock Data Generation'}
        </h3>
        
        <div className="flex-grow overflow-y-auto pr-2 space-y-3">
          {activeTab === 'transactions' ? (
            loading ? (
              <div className="text-center py-10 opacity-50 font-bold uppercase text-xs">Syncing Ledger...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-20 opacity-20">
                <Database size={48} className="mx-auto mb-4" />
                <p className="font-black uppercase text-xs">No transactions in database.</p>
              </div>
            ) : (
              transactions.map(tx => (
                <div key={tx.id} className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${
                      tx.status === 'delivered' ? 'bg-emerald-100 text-emerald-600' :
                      tx.status === 'failed' || tx.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-600'
                    }`}>
                      {tx.status === 'delivered' ? <CheckCircle size={20} /> :
                       tx.status === 'failed' || tx.status === 'cancelled' ? <XCircle size={20} /> :
                       <Clock size={20} />}
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tighter flex items-center gap-2">
                        {tx.id}
                        <span className={`text-[9px] px-2 py-0.5 rounded-full ${tx.paymentStatus === 'paid' ? 'bg-emerald-200 text-emerald-800' : 'bg-red-200 text-red-800'}`}>
                           {tx.paymentStatus.toUpperCase()}
                        </span>
                      </p>
                      <p className="text-[10px] uppercase font-bold text-stone-500">{new Date(tx.createdAt).toLocaleString()} • Client: {tx.clientId.substring(0,6)}...</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className="font-black text-lg">₱{tx.totalAmount.toLocaleString()}</p>
                      <p className="text-[10px] uppercase font-bold text-stone-500">Status: {tx.status}</p>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2">
                      {tx.status === 'pending' && (
                        <button 
                           onClick={() => updateStatus(tx.id, 'cancelled', ['status', 'updatedAt'])}
                           className="p-2 border-2 border-stone-200 rounded-lg hover:border-red-500 hover:text-red-500 transition-colors"
                           title="Cancel Order"
                        >
                           <XCircle size={16} />
                        </button>
                      )}
                      <button 
                         onClick={() => deleteTransaction(tx.id)}
                         className="p-2 border-2 border-stone-200 rounded-lg hover:border-red-500 hover:text-red-500 transition-colors"
                         title="Delete (Admin Only usually)"
                      >
                         <AlertCircle size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : activeTab === 'recipes' ? (
            recipesLoading && recipes.length === 0 ? (
              <div className="text-center py-10 opacity-50 font-bold uppercase text-xs">Syncing Recipes...</div>
            ) : recipes.length === 0 ? (
              <div className="text-center py-20 opacity-20">
                <BookOpen size={48} className="mx-auto mb-4" />
                <p className="font-black uppercase text-xs">No recipes in database. Click "Seed 35 Recipes" to populate.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recipes.map(recipe => (
                   <div key={recipe.id} className="bg-stone-50 border-2 border-stone-200 rounded-2xl p-4 flex flex-col gap-2 relative">
                      {editingRecipe?.id === recipe.id ? (
                        <div className="flex flex-col gap-3 h-full">
                          <input 
                            value={editingRecipe.title}
                            onChange={e => setEditingRecipe({...editingRecipe, title: e.target.value})}
                            className="font-black text-lg uppercase tracking-tight bg-white border border-stone-300 rounded p-2"
                            placeholder="Title"
                          />
                          <input 
                            value={editingRecipe.category || ''}
                            onChange={e => setEditingRecipe({...editingRecipe, category: e.target.value})}
                            className="text-xs font-bold uppercase bg-white border border-stone-300 rounded p-1"
                            placeholder="Category"
                          />
                          <input 
                            value={editingRecipe.carbonSavings}
                            onChange={e => setEditingRecipe({...editingRecipe, carbonSavings: e.target.value})}
                            className="text-xs uppercase text-emerald-600 bg-white border border-stone-300 rounded p-1"
                            placeholder="Carbon Savings (e.g. 2.0kg CO2eq)"
                          />
                          <textarea 
                            value={editingRecipe.description}
                            onChange={e => setEditingRecipe({...editingRecipe, description: e.target.value})}
                            className="text-xs text-stone-700 bg-white border border-stone-300 rounded p-2 resize-none h-20"
                            placeholder="Description"
                          />
                          <input 
                            value={editingRecipe.yields}
                            onChange={e => setEditingRecipe({...editingRecipe, yields: e.target.value})}
                            className="text-xs text-stone-700 bg-white border border-stone-300 rounded p-2"
                            placeholder="Yields (e.g. Serves 2)"
                          />
                          <div className="flex justify-end gap-2 mt-auto">
                            <button 
                              onClick={() => setEditingRecipe(null)}
                              className="px-3 py-1 bg-stone-200 text-stone-600 rounded text-xs font-bold hover:bg-stone-300 transition-colors"
                            >
                              <X size={14} className="inline mr-1" /> Cancel
                            </button>
                            <button 
                              onClick={saveRecipe}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                            >
                              <Save size={14} className="inline mr-1" /> Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="absolute top-4 right-4 text-[9px] font-black uppercase text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                            {recipe.carbonSavings}
                          </div>
                          <h4 className="font-black text-lg uppercase tracking-tight pr-12">{recipe.title}</h4>
                          {recipe.category && (
                            <span className="inline-block px-2 py-0.5 bg-stone-200 text-stone-700 text-[9px] uppercase font-bold rounded w-fit mb-1">
                              {recipe.category}
                            </span>
                          )}
                          <p className="text-xs text-stone-500 font-bold leading-snug line-clamp-2 mb-2">{recipe.description}</p>
                          
                          <div className="text-[10px] uppercase font-bold text-stone-400 mt-auto flex justify-between items-center">
                            <div>
                              <span className="flex items-center gap-1"><CheckCircle size={10} /> {recipe.ingredients.length} Ingredients</span>
                              <span className="flex items-center gap-1 mt-1"><Clock size={10} /> {recipe.yields}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => setEditingRecipe({ ...recipe })}
                                className="p-1.5 border border-stone-200 rounded-md hover:border-blue-500 hover:text-blue-500 transition-colors"
                                title="Edit Recipe"
                              >
                                <Pencil size={14} />
                              </button>
                              <button 
                                onClick={() => deleteRecipe(recipe.id)}
                                className="p-1.5 border border-stone-200 rounded-md hover:border-red-500 hover:text-red-500 transition-colors"
                                title="Delete Recipe"
                              >
                                <AlertCircle size={14} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                   </div>
                ))}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-6">
               <Database size={64} className="text-emerald-500 mb-2" />
               <h4 className="text-2xl font-black uppercase tracking-widest text-stone-800">Generate Retail Data</h4>
               <p className="text-sm font-bold text-stone-500 max-w-md text-center mb-4">
                 Download CSV sheets containing pre-filled grocery inventory data with realistic SKUs, weights, sizes, and pricing. You can upload these to Google Sheets to simulate external integrated inventories.
               </p>
               <div className="flex gap-4">
                 <button 
                   onClick={generatePuregoldSheet}
                   className="bg-[#00603f] hover:bg-[#004d32] text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                 >
                   Download Puregold Data
                 </button>
                 <button 
                   onClick={generateCSISheet}
                   className="bg-[#d22027] hover:bg-[#a6171d] text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                 >
                   Download CSI Data
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
