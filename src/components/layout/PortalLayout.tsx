import React from 'react';
import { User } from 'firebase/auth';
import { LogOut, LayoutDashboard, ShoppingBag, Truck, Sprout, Store, ChevronRight, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PortalLayoutProps {
  role: string | null;
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function PortalLayout({ role, user, onLogout, children }: PortalLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Portal Configurations
  const portals: Record<string, { theme: string; title: string; subtitle: string; icon: React.ReactNode }> = {
    client: {
      theme: 'emerald',
      title: 'AgriRoute Kitchen',
      subtitle: 'Order fresh Farm-to-Table Kits',
      icon: <ShoppingBag size={24} className="text-white" />
    },
    farmer: {
      theme: 'stone',
      title: 'Harvest Portal',
      subtitle: 'Manage Produce & Payouts',
      icon: <Sprout size={24} className="text-white" />
    },
    rider: {
      theme: 'blue',
      title: 'Relay Dispatch',
      subtitle: 'Active Deliveries & Logistics',
      icon: <Truck size={24} className="text-white" />
    },
    admin: {
      theme: 'indigo',
      title: 'Hub Command Center',
      subtitle: 'System & Network Administration',
      icon: <LayoutDashboard size={24} className="text-white" />
    },
    commissary: {
      theme: 'orange',
      title: 'Commissary HQ',
      subtitle: 'Inventory & Processing',
      icon: <Store size={24} className="text-white" />
    },
    grocery: {
      theme: 'orange',
      title: 'Grocery Terminal',
      subtitle: 'Inventory & Stock Management',
      icon: <Store size={24} className="text-white" />
    },
    supermarket: {
       theme: 'orange',
       title: 'Supermarket Terminal',
       subtitle: 'Large Scale Operations',
       icon: <Store size={24} className="text-white" />
    },
    foodstall: {
       theme: 'orange',
       title: 'Food Stall Terminal',
       subtitle: 'Street Food & Snacks',
       icon: <Store size={24} className="text-white" />
    },
    database: {
      theme: 'rose',
      title: 'Database Ops',
      subtitle: 'Raw Data Management',
      icon: <LayoutDashboard size={24} className="text-white" />
    },
    workflow: {
      theme: 'indigo',
      title: 'Workflow Debugger',
      subtitle: 'System Logic & Flows',
      icon: <LayoutDashboard size={24} className="text-white" />
    }
  };

  const currentRole = typeof role === 'string' ? role : 'client';
  const config = portals[currentRole] || portals.client;

  // Derive colors from theme string. Using predefined Tailwind bg and border classes
  let bgClass = "bg-emerald-600";
  let textClass = "text-emerald-600";
  let tagClass = "bg-emerald-50 text-emerald-600 border-emerald-200";

  switch (config.theme) {
    case 'emerald':
      bgClass = "bg-emerald-600"; textClass = "text-emerald-600"; tagClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
      break;
    case 'stone':
      bgClass = "bg-stone-800"; textClass = "text-stone-800"; tagClass = "bg-stone-100 text-stone-800 border-stone-300";
      break;
    case 'blue':
      bgClass = "bg-blue-600"; textClass = "text-blue-600"; tagClass = "bg-blue-50 text-blue-600 border-blue-200";
      break;
    case 'indigo':
      bgClass = "bg-indigo-600"; textClass = "text-indigo-600"; tagClass = "bg-indigo-50 text-indigo-600 border-indigo-200";
      break;
    case 'orange':
      bgClass = "bg-orange-600"; textClass = "text-orange-600"; tagClass = "bg-orange-50 text-orange-600 border-orange-200";
      break;
    case 'rose':
      bgClass = "bg-rose-600"; textClass = "text-rose-600"; tagClass = "bg-rose-50 text-rose-600 border-rose-200";
      break;
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans">
      {/* Top Header representing specific portal */}
      <header className={`sticky top-0 z-40 bg-white border-b-2 border-stone-200 shadow-sm`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 ${bgClass} border-2 border-stone-900 rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`}>
               {config.icon}
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">
                {config.title}
              </h1>
              <p className={`text-xs ${textClass} font-bold mt-1 tracking-wider uppercase`}>
                {config.subtitle}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex flex-col items-end mr-4 border-r-2 border-stone-200 pr-6">
              <span className="text-sm font-bold text-stone-900">{user.displayName}</span>
              <span className={`text-[10px] uppercase font-bold ${textClass}`}>{currentRole} Terminal</span>
            </div>
            
            <button 
              onClick={onLogout} 
              className="hidden md:flex w-10 h-10 border-2 border-stone-900 rounded-xl items-center justify-center hover:bg-stone-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>

            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden p-2 text-stone-500 hover:text-stone-900"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden absolute top-20 left-0 w-full bg-white border-b-2 border-stone-200 shadow-lg z-30 flex flex-col p-4"
          >
             <div className="flex items-center justify-between border-b border-stone-100 pb-4 mb-4">
               <div>
                  <span className="block text-sm font-bold text-stone-900">{user.displayName}</span>
                  <span className={`text-[10px] uppercase font-bold ${textClass}`}>{currentRole} Terminal</span>
               </div>
             </div>
             <button 
                onClick={onLogout} 
                className="w-full py-3 bg-stone-100 rounded-lg text-stone-900 font-bold flex justify-center items-center gap-2 border-2 border-stone-200"
             >
                <LogOut size={16} />
                Sign Out
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="mt-auto border-t-2 border-stone-200 bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
           <p>© 2026 AGRIROUTE LOGISTICS NETWORK v1.0.4</p>
           <div className="flex gap-4 items-center">
             <span className={`px-3 py-1 rounded-full border-2 ${tagClass}`}>System Stable: 99.9%</span>
             <span className={`px-3 py-1 rounded-full border-2 ${tagClass}`}>Last Batching: Just Now</span>
           </div>
        </div>
      </footer>
    </div>
  );
}
