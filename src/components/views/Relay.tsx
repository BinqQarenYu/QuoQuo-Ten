import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Navigation, Package, CheckCircle2, Clock, Globe } from 'lucide-react';
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
  const [progress, setProgress] = useState(0); // 0 to 100 for simulated
  const [eta, setEta] = useState(12);
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTxCount, setActiveTxCount] = useState(0);

  // New states for real-time tracking
  const [useLiveTracking, setUseLiveTracking] = useState(false);
  const [liveLocation, setLiveLocation] = useState<[number, number] | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>('En Route');
  const [manualEtaDelta, setManualEtaDelta] = useState(0);

  useEffect(() => {
    // Listen to real shipped/processing orders to show active activity
    const q = query(collection(db, 'transactions'), where('status', 'in', ['shipped', 'processing']));
    const unsub = onSnapshot(q, (snap) => {
      setActiveTxCount(snap.docs.length);
    }, (error) => {
      console.log('Error fetching active tx for relay', error);
    });
    return () => unsub();
  }, []);

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

  useEffect(() => {
    let watchId: NodeJS.Timeout;
    if (useLiveTracking) {
      // Simulate live GPS by picking points along the route
      watchId = setInterval(async () => {
        setProgress(prev => {
          const next = prev >= 100 ? 100 : prev + 1;
          
          // Calculate pos within setProgress callback to align, but we actually 
          // need to calculate it to push to firestore. 
          // Let's do calculation next.
          return next;
        });

      }, 3000); // 3 seconds interval for live "GPS updates"
    }
    return () => {
      if (watchId !== undefined) clearInterval(watchId);
    };
  }, [useLiveTracking]);
  
  // Another effect to listen to progress changes and optionally push to DB if live
  useEffect(() => {
    if (useLiveTracking) {
      const pos = getSimulatedRiderPosition();
      setLiveLocation(pos);
      
      import('firebase/firestore').then(({ doc, setDoc }) => {
        setDoc(doc(db, 'riders', user.uid), {
          lat: pos[0],
          lng: pos[1],
          updatedAt: Date.now()
        }).catch(err => {
          console.error("Error saving GPS", err);
        });
      });
    }
  }, [progress, useLiveTracking, user.uid]);

  // Calculate rider position based on progress (Simulated)
  const getSimulatedRiderPosition = () => {
    if (progress >= 100) return endPos;
    const totalSegments = routePositions.length - 1;
    const progressPerSegment = 100 / totalSegments;
    const currentSegmentIndex = Math.min(Math.floor(progress / progressPerSegment), totalSegments - 1);
    const segmentProgress = (progress % progressPerSegment) / progressPerSegment;

    const start = routePositions[currentSegmentIndex];
    const end = routePositions[currentSegmentIndex + 1];

    if (!start || !end) return endPos;

    const latDiff = end[0] - start[0];
    const lngDiff = end[1] - start[1];
    
    return [
      start[0] + (latDiff * segmentProgress),
      start[1] + (lngDiff * segmentProgress)
    ] as [number, number];
  };

  const currentRiderPos = useLiveTracking && liveLocation ? liveLocation : getSimulatedRiderPosition();

  const getTraveledRoute = (): [number, number][] => {
    if (useLiveTracking && liveLocation) {
      return [startPos, liveLocation];
    }
    const totalSegments = routePositions.length - 1;
    const progressPerSegment = 100 / totalSegments;
    const currentSegmentIndex = Math.min(Math.floor(progress / progressPerSegment), totalSegments - 1);
    
    const traveled = routePositions.slice(0, currentSegmentIndex + 1);
    traveled.push(currentRiderPos);
    return traveled;
  };

  // Simulate progress when not tracking live
  useEffect(() => {
    if (useLiveTracking) return;
    if (progress >= 100) return;
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 2; // Accelerated for demo purposes
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [progress, useLiveTracking]);

  // Update ETA based on distance/progress
  useEffect(() => {
    let newEta = 0;
    if (useLiveTracking && liveLocation) {
        // Distance-based rough ETA calc
        const dist = Math.sqrt(Math.pow(endPos[0] - liveLocation[0], 2) + Math.pow(endPos[1] - liveLocation[1], 2));
        newEta = Math.round(dist * 500); // rough conversion
    } else {
        newEta = Math.round(12 * (1 - progress / 100));
    }
    
    // Apply manual adjustment delta
    newEta = Math.max(1, newEta + manualEtaDelta);

    setEta(newEta);
    const d = new Date();
    d.setMinutes(d.getMinutes() + newEta);
    setEstimatedDeliveryTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [progress, useLiveTracking, liveLocation, manualEtaDelta]);

  
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
			 <button 
			   onClick={() => setUseLiveTracking(!useLiveTracking)}
			   className={`bento-tag cursor-pointer ${useLiveTracking ? 'bg-amber-100 text-amber-800 border-amber-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-stone-100 text-stone-800 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'}`}
			 >
			   <Globe size={12} className="inline mr-1"/> {useLiveTracking ? 'STOP LIVE TRACKING' : 'START LIVE GPS'}
			 </button>
             {activeTxCount > 0 && <div className="bento-tag bg-blue-100 text-blue-800 border-blue-900 border-2 font-black shadow-none animate-pulse">DB: {activeTxCount} ACTIVE TXNS</div>}
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
              <div className="text-right bento-card border-white/10 bg-white/5 py-4 px-6 flex flex-col justify-center min-w-[200px]">
                <div className="flex items-center gap-4 justify-end mb-1">
                   <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                     <button onClick={() => setManualEtaDelta(prev => prev - 1)} className="text-red-400 hover:text-red-300 hover:bg-red-400/20 w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono">-</button>
                     <button onClick={() => setManualEtaDelta(prev => prev + 1)} className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/20 w-6 h-6 rounded-full flex items-center justify-center font-bold font-mono">+</button>
                   </div>
                   <div className="flex items-center gap-2">
                     <Clock size={16} className="text-emerald-500" />
                     <p className="text-3xl font-black text-emerald-500 leading-none">{eta}m</p>
                   </div>
                </div>
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest mb-3 flex items-center justify-end gap-2">
                   ETA • Arrival Delta {manualEtaDelta !== 0 && <span className="bg-stone-800 text-stone-300 px-1.5 py-0.5 rounded-sm">{(manualEtaDelta > 0 ? '+' : '') + manualEtaDelta}m</span>}
                </p>
                <p className="text-lg font-black text-white leading-none mb-1">{estimatedDeliveryTime}</p>
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Est. Delivery Time</p>
              </div>
            </div>

            {/* Simulated Tracking Map */}
            <div className="relative h-64 w-full bg-stone-900/50 rounded-3xl border-2 border-white/5 overflow-hidden mb-8 z-0">
               {typeof window !== 'undefined' && currentRiderPos[0] && (
               <MapContainer 
                 center={useLiveTracking ? currentRiderPos : [15.9388, 120.5802]} 
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
                   positions={getTraveledRoute()} 
                   pathOptions={{ color: '#2563eb', weight: 5 }} 
                 />

                 {/* Hub locations and pickups */}
                 <Marker position={startPos}>
                   <Popup>Villasis Hub</Popup>
                 </Marker>
                 <Marker position={[15.9200, 120.5850]} icon={customMarkerIcon}>
                   <Popup>Farm A (Pickup)</Popup>
                 </Marker>
                 <Marker position={[15.9400, 120.5800]} icon={customMarkerIcon}>
                   <Popup>Farm B (Pickup)</Popup>
                 </Marker>
                 <Marker position={[15.9600, 120.5750]} icon={customMarkerIcon}>
                   <Popup>Farm C (Pickup)</Popup>
                 </Marker>
                 <Marker position={endPos}>
                   <Popup>Urdaneta Central Hub</Popup>
                 </Marker>

                 {/* Rider Marker */}
                 <Marker position={currentRiderPos} icon={riderIcon}>
                   <Popup>Current Vector</Popup>
                 </Marker>
               </MapContainer>
               )}
               
               <div className="absolute bottom-4 left-4 flex gap-4 z-[400]">
                  <div className="bg-black/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 shadow-2xl">
                     <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                     <span className="text-[9px] font-black text-white uppercase tracking-widest">Live Map View</span>
                  </div>
               </div>
            </div>

            <div className="space-y-6 pl-6 border-l-2 border-white/10 flex justify-between">
               <div className="relative">
                  <div className="absolute -left-[31px] top-1 w-4 h-4 bg-emerald-500 border-2 border-stone-900 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <p className="text-xs font-black uppercase text-emerald-500 mb-1 tracking-widest flex items-center gap-2">
                    <MapPin size={12} />
                    Current Node
                  </p>
                  <p className="font-bold text-lg mb-1">Delivering: 12kg native produce batch</p>
                  <p className="text-[10px] text-stone-500 font-bold uppercase tracking-widest">Final Stop: Urdaneta Central Kitchen</p>
               </div>
			   
			   <div className="text-right">
			      <p className="text-[10px] font-black uppercase text-stone-500 tracking-widest mb-1">Status Update</p>
				  <select 
				    value={liveStatus}
					onChange={e => setLiveStatus(e.target.value)}
					className="bg-black text-emerald-500 border-2 border-emerald-900 rounded-xl px-4 py-2 font-black uppercase tracking-widest text-xs outline-none"
				  >
				    <option value="Picking Up">Picking Up</option>
					<option value="En Route">En Route</option>
					<option value="Arriving">Arriving</option>
					<option value="Delivered">Delivered</option>
				  </select>
			   </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {showSuccess || liveStatus === 'Delivered' ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="w-full mt-10 bg-emerald-100 text-emerald-900 py-6 rounded-3xl border-2 border-emerald-500 font-black text-lg text-center flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={24} /> Delivery Confirmed!
              </motion.div>
            ) : progress >= 100 && !useLiveTracking ? (
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
                className="w-full mt-10 bg-white/5 text-stone-500 py-6 rounded-3xl border-2 border-white/10 font-black text-lg uppercase tracking-tighter text-center cursor-not-allowed flex justify-center items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-stone-500 animate-pulse" /> {liveStatus}...
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
            {!useLiveTracking && (
            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden border border-stone-200">
               <motion.div 
                 className="bg-emerald-600 h-full" 
                 initial={{ width: 0 }}
                 animate={{ width: `${progress}%` }}
               />
            </div>
            )}
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
