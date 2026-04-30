/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
  Leaf,
  Database,
  Store,
  ShoppingCart,
  ShoppingBag,
  Tent
} from 'lucide-react';

// Components
import Kitchen from './components/views/Kitchen';
import Harvest from './components/views/Harvest';
import Relay from './components/views/Relay';
import Hub from './components/views/Hub';
import DatabaseOps from './components/views/DatabaseOps';
import Commissary from './components/views/Commissary';
import PortalLayout from './components/layout/PortalLayout';
import WorkflowDebugger from './components/views/WorkflowDebugger';

type Role = 'client' | 'farmer' | 'rider' | 'admin' | 'database' | 'commissary' | 'grocery' | 'supermarket' | 'foodstall' | 'workflow';

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
    <>
      <PortalLayout role={role} user={user} onLogout={handleLogout}>
        <AnimatePresence mode="wait">
          {/* @ts-ignore */}
          {role === 'client' && <Kitchen key="kitchen" user={user} />}
          {/* @ts-ignore */}
          {role === 'farmer' && <Harvest key="harvest" user={user} />}
          {/* @ts-ignore */}
          {role === 'rider' && <Relay key="relay" user={user} />}
          {/* @ts-ignore */}
          {role === 'admin' && <Hub key="hub" user={user} />}
          {/* @ts-ignore */}
          {role === 'database' && <DatabaseOps key="database" user={user} />}
          {/* @ts-ignore */}
          {role === 'commissary' && <Commissary key="commissary" user={user} roleType="commissary" />}
          {/* @ts-ignore */}
          {role === 'grocery' && <Commissary key="grocery" user={user} roleType="grocery" />}
          {/* @ts-ignore */}
          {role === 'supermarket' && <Commissary key="supermarket" user={user} roleType="supermarket" />}
          {/* @ts-ignore */}
          {role === 'foodstall' && <Commissary key="foodstall" user={user} roleType="foodstall" />}
          {/* @ts-ignore */}
          {role === 'workflow' && <WorkflowDebugger key="workflow" user={user} />}
        </AnimatePresence>
      </PortalLayout>

      {/* Dev Role Switcher - Remains fixed to bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-white border-2 border-stone-900 rounded-full px-4 py-2 flex items-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-x-auto max-w-[90vw]">
        <span className="text-[10px] uppercase font-black text-stone-400 mr-2 border-r-2 pr-4 border-stone-900 whitespace-nowrap">Dev Mode</span>
        <button onClick={() => switchRole('client')} title="Client" className={`p-2 rounded-lg transition-all ${role === 'client' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><ChefHat size={18} /></button>
        <button onClick={() => switchRole('farmer')} title="Farmer" className={`p-2 rounded-lg transition-all ${role === 'farmer' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Sprout size={18} /></button>
        <button onClick={() => switchRole('rider')} title="Rider" className={`p-2 rounded-lg transition-all ${role === 'rider' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Bike size={18} /></button>
        <button onClick={() => switchRole('admin')} title="Admin" className={`p-2 rounded-lg transition-all ${role === 'admin' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Globe size={18} /></button>
        <button onClick={() => switchRole('database')} title="Database" className={`p-2 rounded-lg transition-all ${role === 'database' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Database size={18} /></button>
        <button onClick={() => switchRole('workflow')} title="Workflow" className={`p-2 rounded-lg transition-all ${role === 'workflow' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>
        </button>
        <div className="w-[2px] h-6 bg-stone-200 mx-1"></div>
        <button onClick={() => switchRole('commissary')} title="Commissary" className={`p-2 rounded-lg transition-all ${role === 'commissary' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Store size={18} /></button>
        <button onClick={() => switchRole('grocery')} title="Grocery" className={`p-2 rounded-lg transition-all ${role === 'grocery' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><ShoppingBag size={18} /></button>
        <button onClick={() => switchRole('supermarket')} title="Supermarket" className={`p-2 rounded-lg transition-all ${role === 'supermarket' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><ShoppingCart size={18} /></button>
        <button onClick={() => switchRole('foodstall')} title="Food Stall" className={`p-2 rounded-lg transition-all ${role === 'foodstall' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-100 text-stone-400'}`}><Tent size={18} /></button>
      </div>
    </>
  );
}
