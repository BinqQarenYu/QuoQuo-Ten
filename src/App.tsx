/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sprout, 
  ChefHat, 
  Bike, 
  Globe, 
  User as UserIcon, 
  LogOut,
  ChevronRight,
  TrendingUp,
  MapPin,
  Clock,
  Leaf
} from 'lucide-react';

// Components
import Kitchen from './components/views/Kitchen';
import Harvest from './components/views/Harvest';
import Relay from './components/views/Relay';
import Hub from './components/views/Hub';

type Role = 'client' | 'farmer' | 'rider' | 'admin';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          setRole(userDoc.data().role as Role);
        } else {
          // Default to client for new users
          const newRole: Role = 'client';
          await setDoc(doc(db, 'users', u.uid), {
            email: u.email,
            role: newRole,
            displayName: u.displayName
          });
          setRole(newRole);
        }
      } else {
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  // Persona switcher for dev
  const switchRole = async (newRole: Role) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { role: newRole }, { merge: true });
    setRole(newRole);
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <Leaf className="w-12 h-12 text-emerald-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-stone-50 p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="flex justify-center">
            <div className="bg-emerald-600 p-4 rounded-3xl shadow-xl shadow-emerald-200">
              <Leaf className="w-12 h-12 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-stone-900 font-sans">AgriRoute</h1>
            <p className="text-stone-600">Fresh produce from farm to kitchen, optimized for the planet.</p>
          </div>
          <button 
            onClick={handleLogin}
            className="w-full bg-stone-900 text-white py-4 px-6 rounded-2xl font-medium flex items-center justify-center gap-3 hover:bg-stone-800 transition-colors"
          >
            <UserIcon className="w-5 h-5" />
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans p-6 flex flex-col">
      {/* Dev Role Switcher */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white border-2 border-stone-900 rounded-full px-4 py-2 flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <span className="text-[10px] uppercase font-black text-stone-400 mr-2 border-r-2 pr-4 border-stone-900">Dev Mode</span>
        <button onClick={() => switchRole('client')} className={`p-2 rounded-lg transition-all ${role === 'client' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><ChefHat size={18} /></button>
        <button onClick={() => switchRole('farmer')} className={`p-2 rounded-lg transition-all ${role === 'farmer' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Sprout size={18} /></button>
        <button onClick={() => switchRole('rider')} className={`p-2 rounded-lg transition-all ${role === 'rider' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Bike size={18} /></button>
        <button onClick={() => switchRole('admin')} className={`p-2 rounded-lg transition-all ${role === 'admin' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Globe size={18} /></button>
      </div>

      <header className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-600 border-2 border-stone-900 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            A
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">
            AgriRoute <span className="text-emerald-600">OS</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="hidden md:flex gap-4">
             <div className="bento-tag">Network: 142 Farms Active</div>
             <div className="bento-tag-emerald">● Live Optimization Active</div>
          </div>
          <div className="flex items-center gap-4 border-l-2 border-stone-200 pl-6">
             <div className="text-right">
                <p className="text-xs font-black uppercase leading-none">{user.displayName}</p>
                <p className="text-[10px] uppercase font-bold text-emerald-600 mt-1">{role} terminal</p>
             </div>
             <button onClick={handleLogout} className="w-10 h-10 border-2 border-stone-900 rounded-xl flex items-center justify-center hover:bg-stone-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
               <LogOut size={16} />
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <AnimatePresence mode="wait">
          {role === 'client' && <Kitchen key="kitchen" user={user} />}
          {role === 'farmer' && <Harvest key="harvest" user={user} />}
          {role === 'rider' && <Relay key="relay" user={user} />}
          {role === 'admin' && <Hub key="hub" user={user} />}
        </AnimatePresence>
      </main>

      <footer className="mt-10 flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest border-t-2 border-stone-100 pt-6">
        <p>© 2026 AGRIROUTE LOGISTICS NETWORK v1.0.4</p>
        <div className="flex gap-6">
          <span>System Stable: 99.9%</span>
          <span className="text-emerald-600">Last Batching: Just Now</span>
        </div>
      </footer>
    </div>
  );
}
