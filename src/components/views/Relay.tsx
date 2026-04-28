import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Package, CheckCircle2, Clock } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet marker icons not loading correctly in some environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/map-pin.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
  className: 'custom-leaflet-icon-emerald',
});

const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/navigation.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: 'custom-leaflet-icon-rider',
});

export default function Relay({ user }: { user: User }) {
  const [progress, setProgress] = useState(0); // 0 to 100
  const [eta, setEta] = useState(12);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  // Villasis to Urdaneta coordinates
  const startPos: [number, number] = [15.9015, 120.5898];
  const endPos: [number, number] = [15.9761, 120.5707];
  
  // Simulated route path (simplified)
  const routePositions: [number, number][] = [
    startPos,
    [15.9200, 120.5850],
    [15.9400, 120.5800],
    [15.9600, 120.5750],
    endPos
  ];

  // Calculate rider position based on progress
  const getRiderPosition = () => {
    const latDiff = endPos[0] - startPos[0];
    const lngDiff = endPos[1] - startPos[1];
    
    // Smooth interpolation for the demo
    const currentLat = startPos[0] + (latDiff * (progress / 100));
    const currentLng = startPos[1] + (lngDiff * (progress / 100));
    
    return [currentLat, currentLng] as [number, number];
  };

  const riderPos = getRiderPosition();

  // Simulate progress
  useEffect(() => {
    if (progress >= 100) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 2; // Accelerated for demo purposes
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [progress]);

  // Update ETA based on progress
  useEffect(() => {
    const newEta = Math.max(1, Math.round(12 * (1 - progress / 100)));
    setEta(newEta);
    
    const d = new Date();
    d.setMinutes(d.getMinutes() + newEta);
    setEstimatedDeliveryTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [progress]);

  
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-12 gap-6"
    >
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black tracking-tighter uppercase">Active Relay</h2>
            <p className="text-stone-500 font-bold text-xs uppercase tracking-[0.2em]">Batch ID: #PH-URD-102 • Pangasinan Hub</p>
          </div>
          <div className="flex gap-2">
             <div className="bento-tag bg-emerald-100 text-emerald-800 border-emerald-900">GPS ACTIVE</div>
             <div className="bento-tag bg-blue-100 text-blue-800 border-blue-900">ENCRYPTED</div>
          </div>
        </header>

        <section className="bento-card-dark min-h-[450px] flex flex-col relative overflow-hidden group">
          {/* Schematic Map Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          </div>

          <div className="z-10 relative flex-grow">
            <div className="flex justify-between items-start mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-500 border-2 border-stone-900 rounded-2xl flex items-center justify-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  <Navigation size={28} className="text-stone-900 animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest leading-none mb-1">Current Vector</p>
                  <p className="text-xl font-black uppercase tracking-tight">Urdaneta Central Hub</p>
                </div>
              </div>
              <div className="text-right bento-card border-white/10 bg-white/5 py-4 px-6 flex flex-col justify-center">
                <div className="flex items-center gap-2 justify-end mb-1">
                   <Clock size={16} className="text-emerald-500" />
                   <p className="text-3xl font-black text-emerald-500 leading-none">{eta}m</p>
                </div>
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-3">ETA • Arrival Delta</p>
                <p className="text-lg font-black text-white leading-none mb-1">{estimatedDeliveryTime}</p>
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Est. Delivery Time</p>
              </div>
            </div>

            {/* Simulated Tracking Map */}
            <div className="relative h-64 w-full bg-stone-900/50 rounded-3xl border-2 border-white/5 overflow-hidden mb-8 z-0">
               <MapContainer 
                 center={[15.9388, 120.5802]} 
                 zoom={13} 
                 zoomControl={false}
                 scrollWheelZoom={false}
                 className="w-full h-full"
                 attributionControl={false}
               >
                 <TileLayer
                   attribution="© Google Maps"
                   url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
                   subdomains={['mt0','mt1','mt2','mt3']}
                 />
                 
                 {/* Full route polyline background */}
                 <Polyline positions={routePositions} pathOptions={{ color: '#000000', opacity: 0.2, weight: 4 }} />
                 
                 {/* Traveled route polyline */}
                 <Polyline 
                   positions={[startPos, riderPos]} 
                   pathOptions={{ color: '#2563eb', weight: 5 }} 
                 />

                 {/* Hub locations */}
                 <Marker position={startPos}>
                   <Popup>Villasis Hub</Popup>
                 </Marker>
                 <Marker position={endPos}>
                   <Popup>Urdaneta Central Hub</Popup>
                 </Marker>

                 {/* Rider Marker */}
                 <Marker position={riderPos} icon={riderIcon}>
                   <Popup>Current Vector</Popup>
                 </Marker>
               </MapContainer>
               
               <div className="absolute bottom-4 left-4 flex gap-4 z-[400]">
                  <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl">
                     <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                     <span className="text-[9px] font-black text-white uppercase tracking-widest">Live Map View</span>
                  </div>
               </div>
            </div>

            <div className="space-y-6 pl-6 border-l-2 border-white/10">
               <div className="relative">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 bg-emerald-500 border-2 border-stone-900 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <p className="text-xs font-black uppercase text-emerald-500 mb-1 tracking-widest flex items-center gap-2">
                    <MapPin size={12} />
                    Current Node
                  </p>
                  <p className="font-bold text-lg mb-1">Delivering: 12kg native produce batch</p>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Final Stop: Urdaneta Central Kitchen</p>
               </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full mt-10 bg-emerald-100 text-emerald-900 py-6 rounded-3xl border-2 border-emerald-500 font-black text-lg text-center flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={24} /> Delivery Confirmed!
              </motion.div>
            ) : progress >= 100 ? (
              <motion.button 
                key="confirm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onClick={() => {
                  setShowSuccess(true);
                  setTimeout(() => {
                    setShowSuccess(false);
                    setProgress(0);
                  }, 3000);
                }}
                className="w-full mt-10 bg-emerald-500 text-white py-6 rounded-3xl border-2 border-emerald-900 font-black text-lg uppercase tracking-tighter shadow-[8px_8px_0px_0px_rgba(16,185,129,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all active:translate-x-[4px] active:translate-y-[4px]">
                Confirm Delivery
              </motion.button>
            ) : (
              <motion.div 
                key="progress"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full mt-10 bg-white/5 text-stone-500 py-6 rounded-3xl border-2 border-white/10 font-black text-lg uppercase tracking-tighter text-center cursor-not-allowed">
                Delivery in Progress...
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="bento-card">
          <p className="text-stone-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Relay Analytics</p>
          <div className="space-y-6">
            <div>
              <p className="text-4xl font-black">₱2,480.00</p>
              <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Active batch value</p>
            </div>
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
               <motion.div 
                 className="bg-emerald-600 h-full" 
                 initial={{ width: 0 }}
                 animate={{ width: `${progress}%` }}
               />
            </div>
            <div className="flex justify-between items-center bg-stone-50 p-4 rounded-xl border border-stone-200">
              <span className="text-xs font-bold uppercase tracking-widest">Eco-Drive Index</span>
              <span className="text-emerald-600 font-black text-lg">94%</span>
            </div>
          </div>
        </div>

        <div className="bento-card h-full bg-emerald-50 border-emerald-900 border-2">
           <h3 className="font-black text-xs uppercase tracking-[0.2em] text-emerald-900 mb-4">Sustainability Bonus</h3>
           <div className="flex flex-col items-center justify-center h-48 py-8">
              <div className="text-4xl font-black text-emerald-900">12.2kg</div>
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest text-center mt-2 mx-auto max-w-[150px]">CO2 saved by batching Villasis orders</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
}
