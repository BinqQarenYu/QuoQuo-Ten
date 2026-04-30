import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UtensilsCrossed, Sparkles, ShoppingCart, Leaf, Wind, Filter, Check, MapPin, AlertTriangle, X, Heart, Star, StarHalf, BookOpen, Phone, Mail, Globe, Camera, LocateFixed, Navigation } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { getRecipeSuggestions, SuggestedRecipe, FarmIngredient } from '../../services/aiService';

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
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const riderIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/navigation.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: 'custom-leaflet-icon-rider',
});

const customerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/lucide-static@0.321.0/icons/home.svg',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  className: 'custom-leaflet-icon-customer',
});

// Fix for default marker icons in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface EnhancedIngredient extends FarmIngredient {
  isOrganic?: boolean;
  isSeasonal?: boolean;
}

interface Transaction {
  id: string;
  status: string;
  type: string;
  recipes: { title: string; servings: number }[];
  items: { name: string; quantity: number; farmerName: string }[];
  totalAmount: number;
  paymentStatus: string;
  createdAt: number;
}

interface FarmDetails {
  id: string;
  name: string;
  description: string;
  sustainabilityPractices: string[];
  averageRating: number;
  ratingCount: number;
  userRating?: number;
  history?: string;
  photos?: string[];
  contactInfo?: { email?: string; phone?: string; website?: string };
}

function MapControls() {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const mapContainer = map.getContainer();
      if (mapContainer && !mapContainer.contains(e.target as Node)) {
        map.closePopup();
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [map]);

  const handleLocate = () => {
    if (!('geolocation' in navigator)) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        map.flyTo([latitude, longitude], 13);
        setLocating(false);
      },
      (err) => {
        console.error(err);
        alert('Could not get your location. Please check your browser permissions.');
        setLocating(false);
      }
    );
  };

  return (
    <div className="absolute top-4 right-4 z-[1000]">
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleLocate();
        }}
        disabled={locating}
        title="Centering map on current location"
        className="bg-white border-2 border-stone-900 rounded-xl p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-stone-50 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50"
      >
        <LocateFixed size={20} className={`text-emerald-700 ${locating ? 'animate-pulse' : ''}`} />
      </button>
    </div>
  );
}

export default function Kitchen({ user }: { user: User }) {
  const [recipes, setRecipes] = useState<SuggestedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState<string[]>([]);
  const [favoritesSyncing, setFavoritesSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<'carbon' | 'availability' | 'title' | 'yields'>('carbon');
  const [cart, setCart] = useState<{recipe: SuggestedRecipe, servings: number}[]>(() => {
    try {
      const saved = localStorage.getItem(`kitchen_cart_${user.uid}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
      return [];
    } catch (e) {
      console.error("Failed to load cart from local storage", e);
      return [];
    }
  });
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    try {
      return localStorage.getItem(`kitchen_address_${user.uid}`) || '';
    } catch (e) {
      return '';
    }
  });

  useEffect(() => {
    localStorage.setItem(`kitchen_cart_${user.uid}`, JSON.stringify(cart));
  }, [cart, user.uid]);

  useEffect(() => {
    localStorage.setItem(`kitchen_address_${user.uid}`, deliveryAddress);
  }, [deliveryAddress, user.uid]);

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `kitchen_cart_${user.uid}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setCart(parsed);
          }
        } catch (err) {
          console.error("Failed to parse cart from storage event", err);
        }
      }
      if (e.key === `kitchen_address_${user.uid}` && e.newValue !== null) {
        setDeliveryAddress(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [user.uid]);

  const [showHistory, setShowHistory] = useState(false);
  const [showFarmersDirectory, setShowFarmersDirectory] = useState(false);
  const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
  const [newRecipe, setNewRecipe] = useState<Partial<SuggestedRecipe>>({
    title: '',
    description: '',
    category: '',
    carbonSavings: '',
    yields: '',
    instructions: [],
    ingredients: []
  });
  const [newIngredientName, setNewIngredientName] = useState('');
  const [newIngredientAmount, setNewIngredientAmount] = useState('');
  const [newInstruction, setNewInstruction] = useState('');
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  const [activeRiders, setActiveRiders] = useState<{id: string, lat: number, lng: number}[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [txSortBy, setTxSortBy] = useState<'date' | 'amount' | 'status'>('date');

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'riders'), (snap) => {
      setActiveRiders(snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as {id: string, lat: number, lng: number})));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'riders');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoadingHistory(true);
      try {
        const q = query(collection(db, 'transactions'), where('clientId', '==', user.uid));
        const unsub = onSnapshot(q, (snap) => {
          const docs = snap.docs.map(doc => {
            const data = doc.data();
            // Generate pseudo-random location near Urdaneta for demo purposes
            const defaultLat = 15.9758 + (parseInt(doc.id.substring(0, 5), 16) % 1000) / 10000 - 0.05;
            const defaultLng = 120.5707 + (parseInt(doc.id.substring(5, 10), 16) % 1000) / 10000 - 0.05;
            return {
              id: doc.id,
              lat: data.deliveryLocation?.lat || defaultLat,
              lng: data.deliveryLocation?.lng || defaultLng,
              ...data
            } as Transaction & { lat: number, lng: number };
          });
          setTransactions(docs.sort((a,b) => b.createdAt - a.createdAt));
          setLoadingHistory(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, 'transactions');
          setLoadingHistory(false);
        });
        return unsub;
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'transactions');
        setLoadingHistory(false);
      }
    };
    const unsubscribePromise = fetchHistory();
    return () => {
      unsubscribePromise.then(unsub => { if (unsub) unsub(); });
    };
  }, [user.uid]);

  const addToCart = (recipe: SuggestedRecipe, e: React.MouseEvent) => {
    e.stopPropagation();
    setCart(prev => {
      const existing = prev.find(item => item.recipe.title === recipe.title);
      if (existing) {
        return prev.map(item => item.recipe.title === recipe.title ? { ...item, servings: item.servings + 1 } : item);
      }
      return [...prev, { recipe, servings: 1 }];
    });
  };

  const removeFromCart = (recipeTitle: string) => {
    setCart(prev => prev.filter(item => item.recipe.title !== recipeTitle));
  };

  const updateCartServings = (recipeTitle: string, servings: number) => {
    if (servings < 1) {
      removeFromCart(recipeTitle);
      return;
    }
    setCart(prev => prev.map(item => item.recipe.title === recipeTitle ? { ...item, servings } : item));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!deliveryAddress.trim()) {
      alert("Please specify a delivery address.");
      return;
    }
    setLoading(true);
    const now = Date.now();
    const orderId = `order_${Math.random().toString(36).substring(2, 9)}_${now}`;
    try {
      
      const ingredientsList = cart.flatMap(item => 
        item.recipe.ingredients.map(ing => {
            const matched = getBestMatchedIngredient(ing.name);
            return {
              name: ing.name,
              quantity: item.servings,
              farmerName: matched?.farmerName || 'Various'
            }
        })
      );

      await setDoc(doc(db, 'transactions', orderId), {
        clientId: user.uid,
        status: 'pending',
        type: 'meal_kit',
        recipes: cart.map(c => ({ title: c.recipe.title, servings: c.servings })),
        items: ingredientsList,
        totalAmount: cart.reduce((acc, curr) => acc + (curr.servings * 150), 0), // Mock price
        paymentStatus: 'paid',
        deliveryAddress: deliveryAddress.trim(),
        lat: 15.9758 + (Math.random() * 0.04 - 0.02),
        lng: 120.5707 + (Math.random() * 0.04 - 0.02),
        createdAt: now,
        updatedAt: now
      });
      
      setCart([]);
      setDeliveryAddress('');
      setShowHistory(true);
      alert(`Success! ${cart.length} Meal Kit(s) have been ordered for delivery to ${deliveryAddress.trim()}. The Hub is now processing your request.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `transactions/${orderId}`);
      alert('Checkout failed.');
    } finally {
      setLoading(false);
    }
  };
  const [farmsData, setFarmsData] = useState<Record<string, FarmDetails>>({});
  const [submittingRating, setSubmittingRating] = useState<string | null>(null);

  const submitFarmRating = async (farmName: string, rating: number) => {
    const farm = farmsData[farmName];
    if (!farm) return;
    
    setSubmittingRating(farmName);
    try {
      await addDoc(collection(db, 'farms', farm.id, 'ratings'), {
        userId: user.uid,
        rating,
        createdAt: new Date().getTime()
      });
      
      const newCount = farm.ratingCount + 1;
      const newAverage = ((farm.averageRating * farm.ratingCount) + rating) / newCount;
      
      setFarmsData(prev => ({
        ...prev,
        [farmName]: {
          ...farm,
          ratingCount: newCount,
          averageRating: newAverage,
          userRating: rating
        }
      }));
    } catch (err) {
      console.error("Failed to rate farm", err);
    } finally {
      setSubmittingRating(null);
    }
  };

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const docRef = doc(db, 'users', user.uid);
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().favoriteRecipes) {
          setFavoriteRecipes(snap.data().favoriteRecipes);
        }
      } catch (err) {
        console.error("Failed to load favorites", err);
      }
    };
    loadFavorites();
  }, [user.uid]);

  const toggleFavorite = async (recipeTitle: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent modal opening if clicked on card
    const isFav = favoriteRecipes.includes(recipeTitle);
    const newFavorites = isFav 
      ? favoriteRecipes.filter(t => t !== recipeTitle)
      : [...favoriteRecipes, recipeTitle];
      
    setFavoriteRecipes(newFavorites);
    setFavoritesSyncing(true);
    
    try {
      await setDoc(doc(db, 'users', user.uid), { favoriteRecipes: newFavorites }, { merge: true });
    } catch (err) {
      console.error("Failed to save favorites", err);
      // Revert optimism if failed
      setFavoriteRecipes(favoriteRecipes);
    } finally {
      setFavoritesSyncing(false);
    }
  };

  const [availableProduce, setAvailableProduce] = useState<EnhancedIngredient[]>([]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const farmNames = Array.from(new Set(availableProduce.map(p => p.farmerName))).filter(Boolean) as string[];
  const recipeCategories = Array.from(new Set(recipes.map(r => r.category))).filter(Boolean) as string[];

  const filteredProduce = availableProduce.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.farmerName.toLowerCase().includes(search.toLowerCase());
    
    const matchesOrganic = activeFilters.includes('organic') ? p.isOrganic : true;
    const matchesSeasonal = activeFilters.includes('seasonal') ? p.isSeasonal : true;
    
    // Check if any active filter matches farm name (case insensitive)
    const activeFarmFilters = activeFilters.filter(f => !['organic', 'seasonal', '100%_available', 'high_carbon', 'large_yield', ...recipeCategories].includes(f));
    const matchesFarm = activeFarmFilters.length > 0 
      ? activeFarmFilters.some(f => p.farmerName.toLowerCase().includes(f.toLowerCase()))
      : true;

    return matchesSearch && matchesOrganic && matchesSeasonal && matchesFarm;
  });

  const [selectedRecipe, setSelectedRecipe] = useState<SuggestedRecipe | null>(null);
  const [selectedFarmProfile, setSelectedFarmProfile] = useState<FarmDetails | null>(null);

  // Substitution map for localized Pangasinan produce
  const handleRateRecipe = async (recipe: SuggestedRecipe, rating: number) => {
    if (!recipe.id) return;
    try {
      const now = Date.now();
      const ratingId = user.uid; // One rating per user per recipe
      await setDoc(doc(db, 'recipes', recipe.id, 'ratings', ratingId), {
        userId: user.uid,
        rating,
        createdAt: now
      });
      // Optionally we could recalculate the average in a cloud function,
      // but since we don't have one, we read all ratings and update it.
      const ratingsSnap = await getDocs(collection(db, 'recipes', recipe.id, 'ratings'));
      let sum = 0;
      let count = 0;
      ratingsSnap.forEach(r => {
        sum += r.data().rating;
        count++;
      });
      const avg = count > 0 ? (sum / count) : 0;
      await setDoc(doc(db, 'recipes', recipe.id), {
        averageRating: Number(avg.toFixed(1)),
        ratingCount: count,
        updatedAt: now
      }, { merge: true });
      
      // Update local state
      setRecipes(prev => prev.map(r => r.id === recipe.id ? { ...r, averageRating: Number(avg.toFixed(1)), ratingCount: count } : r));
      if (selectedRecipe?.id === recipe.id) {
        setSelectedRecipe({ ...selectedRecipe, averageRating: Number(avg.toFixed(1)), ratingCount: count });
      }
    } catch (e) {
      console.error("Failed to rate recipe", e);
    }
  };

  const [hoverRating, setHoverRating] = useState(0);
  const SUBSTITUTIONS: Record<string, string[]> = {
    'Calamansi': ['Lemon', 'Lime', 'Balingbing'],
    'Native Calamansi': ['Lemon', 'Lime', 'Balingbing'],
    'Dinorado Rice': ['Jasmine Rice', 'Brown Rice'],
    'Eggplant': ['Zucchini', 'Upu', 'Sayote'],
    'Lowland Eggplant': ['Zucchini', 'Upu', 'Sayote'],
    'Sweet Corn': ['Baby Corn', 'Cassava', 'Sweet Potato'],
    'Native Ginger': ['Turmeric', 'Galangal'],
    'Ginger': ['Turmeric', 'Galangal'],
    'Tomato': ['Kamias', 'Red Bell Pepper', 'Tamarind'],
    'Onion': ['Shallots', 'Scallions', 'Leeks'],
    'Garlic': ['Shallots', 'Onion Powder', 'Garlic Chives'],
    'Pork': ['Chicken', 'Tofu', 'Mushroom'],
    'Chicken': ['Pork', 'Tofu', 'Seitan'],
    'Fish': ['Tofu', 'Chicken', 'Mushrooms'],
    'Beef': ['Pork', 'Mushroom', 'Lentils'],
    'Soy Sauce': ['Coconut Aminos', 'Liquid Aminos', 'Fish Sauce (for saltiness)'],
    'Vinegar': ['Calamansi Juice', 'Lemon Juice', 'Tamarind Paste'],
    'Spinach': ['Kangkong (Water Spinach)', 'Malunggay', 'Pechay'],
    'Cabbage': ['Pechay', 'Bok Choy', 'Napa Cabbage']
  };

  const FARM_LOCATIONS: Record<string, { lat: number, lng: number }> = {
    'Binalonan Organic': { lat: 16.0469, lng: 120.5905 },
    'Asingan Grains': { lat: 16.0028, lng: 120.6728 },
    'Villasis Valley': { lat: 15.9015, lng: 120.5898 },
    'Central Farms': { lat: 15.9760, lng: 120.5700 },
    'Pozorrubio Gold': { lat: 16.1097, lng: 120.5422 },
    'QUOQUO Commissary': { lat: 15.9712, lng: 120.5655 },
    'Central Commissary': { lat: 15.9754, lng: 120.5700 },
    'Puregold Urdaneta': { lat: 15.9754, lng: 120.5732 },
    'CSI Supermarket': { lat: 15.9780, lng: 120.5710 },
    'Magic Mall Supermarket': { lat: 15.9745, lng: 120.5695 },
    'Local Grocery': { lat: 15.9720, lng: 120.5740 },
    'Urdaneta Public Market': { lat: 15.9772, lng: 120.5715 },
    'Villasis Butchery': { lat: 15.9025, lng: 120.5888 },
    'Binalonan Agrivet': { lat: 16.0450, lng: 120.5910 },
    'Local Producers': { lat: 15.9760, lng: 120.5700 },
    'Local Food Stall': { lat: 15.9733, lng: 120.5688 },
    'Street Market': { lat: 15.9740, lng: 120.5720 }
  };

  const getSubstitutions = (ingName: string) => {
    const key = Object.keys(SUBSTITUTIONS).find(k => 
      ingName.toLowerCase().includes(k.toLowerCase()) || 
      k.toLowerCase().includes(ingName.toLowerCase())
    );
    return key ? SUBSTITUTIONS[key] : [];
  };

  const isAvailable = (ingName: string) => {
    const matched = availableProduce.filter(p => p.name.toLowerCase().includes(ingName.toLowerCase()) || ingName.toLowerCase().includes(p.name.toLowerCase()));
    return matched.some(found => found.stock > 0);
  };

  const getBestMatchedIngredient = (ingName: string) => {
    const matched = availableProduce.filter(p => p.name.toLowerCase().includes(ingName.toLowerCase()) || ingName.toLowerCase().includes(p.name.toLowerCase()));
    if (matched.length === 0) return null;

    const withStock = matched.filter(m => m.stock > 0);
    const candidates = withStock.length > 0 ? withStock : matched;

    // Prefer farmers first
    const farmItem = candidates.find(p => !['QUOQUO Commissary', 'Puregold Urdaneta', 'CSI Supermarket', 'Central Commissary', 'Magic Mall Supermarket', 'Local Grocery', 'Urdaneta Public Market', 'Villasis Butchery', 'Binalonan Agrivet', 'Local Producers', 'Local Food Stall', 'Street Market'].includes(p.farmerName));
    if (farmItem) return farmItem;

    // Fallback 1: QUOQUO Commissary
    const quoquo = candidates.find(p => p.farmerName.includes('QUOQUO'));
    if (quoquo) return quoquo;

    // Fallback 2: Supermarkets and other stalls
    return candidates[0];
  };

  useEffect(() => {
    // Fetch produce and commissary items
    const fetchIngredients = async () => {
      try {
        const [prodSnap, comSnap, farmsSnap] = await Promise.all([
          getDocs(collection(db, 'produce')),
          getDocs(collection(db, 'commissaryItems')),
          getDocs(collection(db, 'farms'))
        ]);
        
        const farmsMap: Record<string, FarmDetails> = {};
        
        const farmPromises = farmsSnap.docs.map(async d => {
          const data = d.data();
          const ratingsSnap = await getDocs(collection(db, 'farms', d.id, 'ratings'));
          let totalRating = 0;
          let ratingCount = 0;
          let userRating: number | undefined = undefined;
          
          ratingsSnap.forEach(r => {
            const rData = r.data();
            totalRating += rData.rating;
            ratingCount++;
            if (rData.userId === user.uid) {
              userRating = rData.rating;
            }
          });
          
          const averageRating = ratingCount > 0 ? totalRating / ratingCount : 0;
          
          farmsMap[data.name] = {
            id: d.id,
            name: data.name,
            description: data.description || '',
            sustainabilityPractices: data.sustainabilityPractices || [],
            averageRating,
            ratingCount,
            userRating,
            history: data.history,
            photos: data.photos,
            contactInfo: data.contactInfo
          };
        });
        
        await Promise.all(farmPromises);
        
        let finalFarmsMap = { ...farmsMap };

        // Seed 50 farmer providers if they don't exist
        if (farmsSnap.empty || Object.keys(farmsMap).length < 2) {
          const firstNames = ['Juan', 'Maria', 'Pedro', 'Ana', 'Jose', 'Luz', 'Ramon', 'Elena', 'Ricardo', 'Teresa', 'Antonio', 'Carmen', 'Francisco', 'Rosa', 'Manuel', 'Gloria', 'Luis', 'Isabel', 'Carlos', 'Flora'];
          const lastNames = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Aquino', 'Garcia', 'Mendoza', 'Torres', 'Rivera', 'Mercado', 'Villanueva', 'Fernandez', 'Gomez'];
          const regions = ['Pangasinan', 'Tarlac', 'Nueva Ecija', 'La Union', 'Ilocos', 'Benguet'];
          const crops = ['Organic Rice', 'Heirloom Tomatoes', 'Native Garlic', 'Eggplants', 'Mangoes', 'Corn', 'Onions', 'Calamansi', 'Leafy Greens', 'Root Crops'];
          
          const newFarms: Promise<any>[] = [];
          
          for (let i = 0; i < 50; i++) {
            const name = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]} Farm`;
            if (finalFarmsMap[name]) continue;
            
            const region = regions[i % regions.length];
            const mainCrop = crops[i % crops.length];
            
            const newFarmData = {
              name,
              description: `A traditional family-owned farm located in the heart of ${region}. We specialize in cultivating high-quality, sustainable ${mainCrop}.`,
              sustainabilityPractices: ['Composting', 'No synthetic pesticides', 'Crop Rotation', 'Water conservation'],
              averageRating: 0,
              ratingCount: 0,
              createdAt: Date.now(),
              history: `Established by the family in the late 1990s, we have been providing fresh ${mainCrop} to local communities for over two decades.`,
              contactInfo: { email: `contact@${name.replace(/\s+/g, '').toLowerCase()}.placeholder.com`, phone: `+63 9${Math.floor(100000000 + Math.random() * 900000000)}` }
            };
            
            const newFarmRef = doc(collection(db, 'farms'));
            newFarms.push(setDoc(newFarmRef, newFarmData).then(() => {
              finalFarmsMap[name] = {
                id: newFarmRef.id,
                ...newFarmData,
                sustainabilityPractices: newFarmData.sustainabilityPractices
              };
            }));
          }
          
          await Promise.all(newFarms);
        }

        setFarmsData(finalFarmsMap);

        const combined: EnhancedIngredient[] = [];
        
        prodSnap.forEach(d => {
          const data = d.data();
          combined.push({
            id: d.id,
            name: data.name,
            price: data.price,
            farmerName: data.farmerName || 'Local Farm',
            stock: data.stock,
            unit: data.unit,
            isOrganic: data.isOrganic,
            isSeasonal: data.isSeasonal ?? true 
          });
        });

        comSnap.forEach(d => {
          const data = d.data();
          combined.push({
            id: d.id,
            name: data.name,
            price: data.price,
            farmerName: data.supplier,
            stock: data.stock,
            unit: data.unit,
            isOrganic: false,
            isSeasonal: false
          });
        });

        if (combined.length === 0) {
           // Fallback mocks if DB empty
           combined.push(
            { id: '1', name: 'Native Calamansi', price: 80, farmerName: 'Binalonan Organic', stock: 50, unit: 'kg', isOrganic: true, isSeasonal: true },
            { id: '2', name: 'Organic Dinorado Rice', price: 65, farmerName: 'Asingan Grains', stock: 200, unit: 'kg', isOrganic: true, isSeasonal: false },
            { id: '3', name: 'Lowland Eggplant', price: 45, farmerName: 'Villasis Valley', stock: 30, unit: 'kg', isOrganic: false, isSeasonal: true },
            { id: '4', name: 'Urdaneta Sweet Corn', price: 15, farmerName: 'Central Farms', stock: 100, unit: 'ears', isOrganic: false, isSeasonal: true },
            { id: '5', name: 'Native Ginger', price: 120, farmerName: 'Pozorrubio Gold', stock: 20, unit: 'kg', isOrganic: true, isSeasonal: true }
           );
        }
        setAvailableProduce(combined);
      } catch (err) {
        console.error("error fetching ingredients", err);
      }
    };
    fetchIngredients();
  }, []);

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'recipes'));
      let dbRecipes: SuggestedRecipe[] = [];
      
      if (snap.empty) {
        const { mockRecipes } = await import('../../lib/recipeData');
        const now = Date.now();
        const promises = mockRecipes.map(async (rec, idx) => {
          const recipeId = `rec_${now}_${idx}`;
          await setDoc(doc(db, 'recipes', recipeId), {
            ...rec,
            averageRating: 0,
            ratingCount: 0,
            createdAt: now,
            updatedAt: now
          });
        });
        await Promise.all(promises);
        dbRecipes = mockRecipes.map((r, idx) => ({
          id: `rec_${now}_${idx}`,
          title: r.title,
          description: r.description,
          category: r.category,
          ingredients: r.ingredients,
          carbonSavings: r.carbonSavings,
          instructions: r.instructions,
          yields: r.yields,
          averageRating: 0,
          ratingCount: 0
        }));
      } else {
        const updatePromises: Promise<void>[] = [];
        snap.forEach(d => {
          const data = d.data();
          let cat = data.category;
          if (!cat) {
             const title = data.title || "";
             cat = "Main Course";
             if (title.toLowerCase().includes("soup") || title.toLowerCase().includes("stew") || title === "Bulalo" || title === "Chicken Tinola" || title === "Pork Nilaga" || title === "Sinigang na Baboy" || title === "Sinampalukang Manok") {
               cat = "Soup & Stew";
             } else if (title.toLowerCase().includes("pansit") || title.toLowerCase().includes("pancit") || title.toLowerCase().includes("noodle")) {
               cat = "Noodles";
             } else if (title === "Champorado" || title === "Buko Pandan" || title.toLowerCase().includes("dessert")) {
               cat = "Dessert";
             } else if (title === "Tapsilog" || title === "Tocino" || title === "Tortang Talong") {
               cat = "Breakfast";
             } else if (title === "Chopsuey" || title === "Pinakbet" || title === "Ginisang Ampalaya" || title === "Adobong Sitaw" || title === "Laing" || title === "Ginisang Sayote" || title === "Ginataang Kalabasa at Sitaw" || title === "Ginisang Upo" || title === "Ginisang Toge") {
               cat = "Vegetable";
             }
             const updatePromise = setDoc(doc(db, 'recipes', d.id), { category: cat }, { merge: true }).catch(e => console.error("Update failed", e));
             updatePromises.push(updatePromise);
          }
          dbRecipes.push({
            id: d.id,
            title: data.title,
            description: data.description,
            category: cat,
            ingredients: data.ingredients,
            carbonSavings: data.carbonSavings,
            instructions: data.instructions,
            yields: data.yields,
            averageRating: data.averageRating || 0,
            ratingCount: data.ratingCount || 0
          });
        });
        if (updatePromises.length > 0) {
          await Promise.all(updatePromises);
        }
      }
      
      if (dbRecipes.length > 0) {
        setRecipes(dbRecipes);
      }
    } catch (error) {
      console.error("Failed to fetch recipes", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []); // Fetch recipes on mount

  const handleCreateRecipe = async () => {
    if (!newRecipe.title || !newRecipe.description) {
      alert("Title and description are required.");
      return;
    }
    setIsSavingRecipe(true);
    try {
      const id = `rec_${Date.now()}`;
      const finalRecipe = {
        title: newRecipe.title,
        description: newRecipe.description,
        category: newRecipe.category || 'General',
        carbonSavings: newRecipe.carbonSavings || '0kg CO2',
        yields: newRecipe.yields || '1 serving',
        instructions: newRecipe.instructions || [],
        ingredients: newRecipe.ingredients || [],
        averageRating: 0,
        ratingCount: 0,
        createdAt: Date.now()
      };
      await setDoc(doc(db, 'recipes', id), finalRecipe);
      setRecipes([finalRecipe as SuggestedRecipe, ...recipes]);
      setIsCreatingRecipe(false);
      setNewRecipe({
        title: '',
        description: '',
        category: '',
        carbonSavings: '',
        yields: '',
        instructions: [],
        ingredients: []
      });
    } catch(err) {
      console.error(err);
      alert("Failed to create recipe");
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleAddIngredient = () => {
    if (!newIngredientName) return;
    setNewRecipe(prev => ({
      ...prev,
      ingredients: [...(prev.ingredients || []), {
        id: null,
        name: newIngredientName,
        amount: newIngredientAmount || 'To taste'
      }]
    }));
    setNewIngredientName('');
    setNewIngredientAmount('');
  };

  const handleRemoveIngredient = (index: number) => {
    setNewRecipe(prev => ({
      ...prev,
      ingredients: (prev.ingredients || []).filter((_, i) => i !== index)
    }));
  };

  const handleAddInstruction = () => {
    if (!newInstruction) return;
    setNewRecipe(prev => ({
      ...prev,
      instructions: [...(prev.instructions || []), newInstruction]
    }));
    setNewInstruction('');
  };

  const handleRemoveInstruction = (index: number) => {
    setNewRecipe(prev => ({
      ...prev,
      instructions: (prev.instructions || []).filter((_, i) => i !== index)
    }));
  };

  const filterOptions = [
    { id: 'organic', label: 'Organic', icon: Leaf },
    { id: 'seasonal', label: 'Seasonal', icon: Wind },
    { id: '100%_available', label: '100% Available', icon: Check },
    { id: 'high_carbon', label: 'High Carbon Savings', icon: Leaf },
    { id: 'large_yield', label: 'Large Yield (>4)', icon: UtensilsCrossed },
    ...recipeCategories.map(cat => ({ id: cat, label: cat, icon: UtensilsCrossed })),
    ...farmNames.map(farm => ({ id: farm, label: farm, icon: Filter }))
  ];


  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="grid grid-cols-12 gap-6"
    >
      <div className="col-span-12 lg:col-span-8 space-y-6">
        <header className="flex flex-col gap-1">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-4xl font-black tracking-tighter">Kitchen terminal</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsCreatingRecipe(true)}
                className="text-xs uppercase font-black bg-emerald-600 text-white px-4 py-2 rounded-xl border-2 border-stone-900 hover:bg-emerald-500 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none mr-2"
              >
                + Create Recipe
              </button>
              <button 
                onClick={() => { setShowFarmersDirectory(!showFarmersDirectory); setShowHistory(false); }}
                className="text-xs uppercase font-black bg-emerald-100 text-emerald-900 px-4 py-2 rounded-xl border-2 border-emerald-900 hover:bg-emerald-200 transition-colors shadow-[2px_2px_0px_0px_rgba(4,120,87,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                {showFarmersDirectory ? 'Back to Kitchen' : 'Meet Our Farmers'}
              </button>
              <button 
                onClick={() => { setShowHistory(!showHistory); setShowFarmersDirectory(false); }}
                className="text-xs uppercase font-black bg-stone-900 text-white px-4 py-2 rounded-xl border-2 border-stone-900 hover:bg-stone-800 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
              >
                {showHistory ? 'Back to Kitchen' : 'Transaction History'}
              </button>
            </div>
          </div>
          <p className="text-stone-500 font-bold text-xs uppercase tracking-[0.2em]">Ready for seasonal sourcing</p>
        </header>

        {showFarmersDirectory ? (
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-widest text-emerald-800 flex items-center gap-2"><Leaf size={20} /> Partner Farmers Directory</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {(Object.values(farmsData) as FarmDetails[]).map((farm, idx) => (
                <div key={idx} className="bg-white rounded-2xl border-2 border-stone-900 overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all flex flex-col h-full cursor-pointer" onClick={() => setSelectedFarmProfile(farm)}>
                  <div className="h-28 bg-emerald-100 flex items-center justify-center relative overflow-hidden group">
                     {farm.photos && farm.photos.length > 0 ? (
                        <img src={farm.photos[0]} alt={farm.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                     ) : (
                        <Leaf size={32} className="text-emerald-300 relative z-10 group-hover:scale-110 transition-transform duration-500" />
                     )}
                     <div className="absolute inset-0 bg-gradient-to-t from-stone-900/40 to-transparent" />
                  </div>
                  <div className="p-4 flex flex-col flex-grow">
                    <div className="flex justify-between items-start mb-2 gap-2">
                       <h4 className="font-black text-lg tracking-tight uppercase leading-tight line-clamp-2">{farm.name}</h4>
                       <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest text-amber-700 shrink-0">
                         <Star size={10} className="fill-amber-500 text-amber-500" />
                         {farm.averageRating > 0 ? farm.averageRating.toFixed(1) : 'New'}
                       </div>
                    </div>
                    <p className="text-xs text-stone-600 font-medium line-clamp-3 mb-4 leading-relaxed">{farm.description || farm.history || "Dedicated local partner farm supplying fresh produce."}</p>
                    
                    {farm.sustainabilityPractices && farm.sustainabilityPractices.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-1">
                        {farm.sustainabilityPractices.slice(0, 2).map((prac, i) => (
                          <span key={i} className="bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-200">
                             {prac}
                          </span>
                        ))}
                        {farm.sustainabilityPractices.length > 2 && (
                          <span className="bg-stone-50 text-stone-500 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-stone-200">
                             +{farm.sustainabilityPractices.length - 2} more
                          </span>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-auto">
                       <button className="w-full py-2 bg-stone-900 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-emerald-600 transition-colors">
                         View Full Profile
                       </button>
                    </div>
                  </div>
                </div>
              ))}
              {Object.keys(farmsData).length === 0 && (
                <div className="col-span-full py-16 text-center border-2 border-stone-200 border-dashed rounded-2xl bg-stone-50">
                  <Leaf size={48} className="mx-auto text-stone-300 mb-4" />
                  <p className="text-sm font-black text-stone-500 uppercase tracking-widest">No detailed farm profiles found.</p>
                </div>
              )}
            </div>
          </div>
        ) : showHistory ? (
          <div className="space-y-4">
            {loadingHistory ? (
              <div className="bg-white border-2 border-stone-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <Sparkles size={48} className="animate-spin text-emerald-600 mx-auto mb-4" />
                <p className="font-black text-lg uppercase">Loading history...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="bg-white border-2 border-stone-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <ShoppingCart size={48} className="text-stone-300 mx-auto mb-4" />
                <p className="font-black text-lg text-stone-500 uppercase">No past orders found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest hidden md:inline">Sort By:</span>
                    <div className="flex flex-wrap items-center border-2 border-stone-900 rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                      <button 
                        onClick={() => setTxSortBy('date')}
                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${txSortBy === 'date' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                      >
                        Date
                      </button>
                      <div className="w-[2px] h-full bg-stone-900" />
                      <button 
                        onClick={() => setTxSortBy('amount')}
                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${txSortBy === 'amount' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                      >
                        Total Amount
                      </button>
                      <div className="w-[2px] h-full bg-stone-900" />
                      <button 
                        onClick={() => setTxSortBy('status')}
                        className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${txSortBy === 'status' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                      >
                        Status
                      </button>
                    </div>
                  </div>
                </div>
                {[...transactions].sort((a, b) => {
                  if (txSortBy === 'date') return b.createdAt - a.createdAt;
                  if (txSortBy === 'amount') return b.totalAmount - a.totalAmount;
                  if (txSortBy === 'status') return a.status.localeCompare(b.status);
                  return 0;
                }).map(tx => (
                  <div key={tx.id} className="bg-white border-2 border-stone-900 rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4">
                    <div className="flex justify-between items-start border-b-2 border-stone-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] uppercase font-black px-2 py-1 rounded-sm ${tx.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{tx.status}</span>
                          <span className="text-[10px] font-bold text-stone-500">{new Date(tx.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="font-black text-xs text-stone-500">Order ID: {tx.id}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-lg text-emerald-600">₱{tx.totalAmount.toFixed(2)}</p>
                        <p className="text-[10px] font-bold text-stone-400 uppercase">{tx.paymentStatus}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-stone-400 mb-2">Recipes Ordered</h4>
                        <div className="space-y-2">
                          {tx.recipes.map((r, i) => (
                            <div key={i} className="flex justify-between items-center text-sm font-bold">
                              <span>{r.title}</span>
                              <span className="text-stone-500">x{r.servings} serving{r.servings > 1 ? 's' : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-stone-400 mb-2">Sourced Ingredients</h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                          {tx.items.map((item, i) => (
                            <div key={i} className="flex justify-between text-[11px] font-bold">
                              <span>{item.name} <span className="text-stone-400">(x{item.quantity})</span></span>
                              <span className="text-emerald-700">{item.farmerName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    {tx.deliveryAddress && (
                       <div className="pt-4 border-t-2 border-stone-100 flex gap-2 items-center text-stone-600">
                         <MapPin size={16} />
                         <span className="text-sm font-bold uppercase tracking-wide">Delivering to: <span className="text-stone-900">{tx.deliveryAddress}</span></span>
                       </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-900 z-10" size={24} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="SEARCH LOCAL RECIPES..." 
              className="w-full bg-white border-2 border-stone-900 rounded-3xl py-6 pl-16 pr-6 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all text-lg font-black uppercase placeholder:text-stone-300 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            />
            <button 
              onClick={fetchRecipes}
              disabled={loading}
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-emerald-600 text-white p-4 rounded-2xl border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50"
            >
              <Sparkles size={20} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {filterOptions.map((opt) => {
              const isActive = activeFilters.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  onClick={() => toggleFilter(opt.id)}
                  className={`flex items-center gap-2 px-4 py-2 border-2 border-stone-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isActive 
                      ? 'bg-stone-900 text-white shadow-none translate-x-[2px] translate-y-[2px]' 
                      : 'bg-white hover:bg-stone-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                  }`}
                >
                  {isActive ? <Check size={12} /> : <opt.icon size={12} />}
                  {opt.label}
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-stone-500 tracking-widest hidden md:inline">Sort By:</span>
              <div className="flex flex-wrap items-center border-2 border-stone-900 rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white">
                <button 
                  onClick={() => setSortBy('carbon')}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'carbon' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  Carbon Savings
                </button>
                <div className="w-[2px] h-full bg-stone-900" />
                <button 
                  onClick={() => setSortBy('availability')}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'availability' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  Availability
                </button>
                <div className="w-[2px] h-full bg-stone-900" />
                <button 
                  onClick={() => setSortBy('title')}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'title' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  Title
                </button>
                <div className="w-[2px] h-full bg-stone-900" />
                <button 
                  onClick={() => setSortBy('yields')}
                  className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'yields' ? 'bg-emerald-600 text-white' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  Yields
                </button>
              </div>
            </div>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
          <AnimatePresence>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bento-card animate-pulse h-64 bg-stone-100" />
              ))
            ) : (
              (() => {
                const parseCarbonSavings = (val: string) => {
                  const match = val.match(/[\d.]+/);
                  return match ? parseFloat(match[0]) : 0;
                };

                const parseYield = (val: string) => {
                  const match = val?.match(/[\d.]+/);
                  return match ? parseFloat(match[0]) : 0;
                };

                const getMissingIngredientsCount = (recipe: SuggestedRecipe) => {
                  return recipe.ingredients.filter(ing => !isAvailable(ing.name)).length;
                };

                const activeRecipeCategories = activeFilters.filter(f => recipeCategories.includes(f));
                const activeFarmFilters = activeFilters.filter(f => !['organic', 'seasonal', '100%_available', 'high_carbon', 'large_yield'].includes(f) && !recipeCategories.includes(f));
                const wantsOrganic = activeFilters.includes('organic');
                const wantsSeasonal = activeFilters.includes('seasonal');
                const wantsFullyAvailable = activeFilters.includes('100%_available');
                const wantsHighCarbon = activeFilters.includes('high_carbon');
                const wantsLargeYield = activeFilters.includes('large_yield');

                const filteredClientRecipes = recipes.filter(recipe => {
                  if (search) {
                    const lowerSearch = search.toLowerCase();
                    const titleMatch = recipe.title.toLowerCase().includes(lowerSearch);
                    const descMatch = recipe.description.toLowerCase().includes(lowerSearch);
                    const ingMatch = recipe.ingredients.some(ing => ing.name.toLowerCase().includes(lowerSearch));
                    
                    if (!titleMatch && !descMatch && !ingMatch) {
                      return false;
                    }
                  }

                  if (wantsFullyAvailable && getMissingIngredientsCount(recipe) > 0) return false;
                  if (wantsHighCarbon && parseCarbonSavings(recipe.carbonSavings) < 3) return false;
                  if (wantsLargeYield && parseYield(recipe.yields) <= 4) return false;

                  const mappedIngredients = recipe.ingredients.map(ing => {
                    return getBestMatchedIngredient(ing.name);
                  }).filter(Boolean) as EnhancedIngredient[];

                  if (wantsOrganic && !mappedIngredients.some(p => p.isOrganic)) return false;
                  if (wantsSeasonal && !mappedIngredients.some(p => p.isSeasonal)) return false;
                  
                  if (activeRecipeCategories.length > 0) {
                     if (!recipe.category || !activeRecipeCategories.includes(recipe.category)) return false;
                  }

                  if (activeFarmFilters.length > 0) {
                    const recipeFarms = mappedIngredients.map(p => p.farmerName);
                    if (!activeFarmFilters.some(f => recipeFarms.includes(f))) return false;
                  }
                  
                  return true;
                });

                const sortedRecipes = [...filteredClientRecipes].sort((a, b) => {
                  if (sortBy === 'availability') {
                    const aMissing = getMissingIngredientsCount(a);
                    const bMissing = getMissingIngredientsCount(b);
                    if (aMissing !== bMissing) {
                      return aMissing - bMissing; // fewer missing is better (ascending)
                    }
                  } else if (sortBy === 'title') {
                    return a.title.localeCompare(b.title);
                  } else if (sortBy === 'yields') {
                    const aYield = parseYield(a.yields);
                    const bYield = parseYield(b.yields);
                    if (aYield !== bYield) {
                      return bYield - aYield; // descending yield
                    }
                  }

                  // Default sort or fallback for tie: Carbon Savings (descending)
                  const aVal = parseCarbonSavings(a.carbonSavings);
                  const bVal = parseCarbonSavings(b.carbonSavings);
                  
                  if (bVal !== aVal) {
                    return bVal - aVal; // descending
                  }
                  
                  return a.title.localeCompare(b.title);
                });

                const getRecipeImage = (category?: string, title?: string) => {
                  const t = title?.toLowerCase() || '';
                  const c = category?.toLowerCase() || '';
                  
                  if (c.includes('noodle') || t.includes('pansit') || t.includes('bihon')) return "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=600&q=80";
                  if (c.includes('soup') || c.includes('stew') || t.includes('sinigang') || t.includes('nilaga') || t.includes('bulalo')) return "https://images.unsplash.com/photo-1548943487-a2e4f4337d6a?w=600&q=80";
                  if (c.includes('dessert') || t.includes('champorado') || t.includes('buko')) return "https://images.unsplash.com/photo-1563729784474-d77fb0d63bb6?w=600&q=80";
                  if (t.includes('adobo') || t.includes('pork') || c.includes('meat') || t.includes('sisig') || t.includes('lechon') || t.includes('tocino') || t.includes('tapa')) return "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80";
                  if (c.includes('vegetable') || t.includes('chopsuey') || t.includes('pinakbet')) return "https://images.unsplash.com/photo-1540420773-d6eb0d0bbdf2?w=600&q=80";
                  if (c.includes('breakfast')) return "https://images.unsplash.com/photo-1533089860892-4c86ecb1ef46?w=600&q=80";
                  if (t.includes('chicken') || t.includes('afritada')) return "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&q=80"; 
                  if (t.includes('fish') || t.includes('paksiw')) return "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&q=80";
                  
                  return null;
                };

                return sortedRecipes.map((recipe, i) => {
                  const imgUrl = getRecipeImage(recipe.category, recipe.title);

                  return (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="bento-card group flex flex-col justify-between cursor-pointer hover:border-emerald-500 transition-all overflow-hidden"
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div>
                      {imgUrl ? (
                        <div className="w-[calc(100%+3rem)] h-40 -mt-6 -mx-6 mb-4 border-b-2 border-stone-900 overflow-hidden bg-stone-100">
                           <img src={imgUrl} alt={recipe.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
                        </div>
                      ) : (
                        <div className="w-[calc(100%+3rem)] h-40 -mt-6 -mx-6 mb-4 border-b-2 border-stone-900 overflow-hidden bg-emerald-50 flex items-center justify-center">
                           <span className="text-6xl group-hover:scale-110 transition-transform duration-500">🥗</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 flex-wrap mb-4">
                        {recipe.category && (
                          <div className="bento-tag bg-stone-900 border-stone-900 text-white">
                            {recipe.category}
                          </div>
                        )}
                        <div className="bento-tag bg-stone-100 border-stone-900 text-stone-900">
                          {recipe.yields || "Yield: Varies"}
                        </div>
                        <div className="bento-tag-emerald">{recipe.carbonSavings} Saved</div>
                        <button 
                          onClick={(e) => toggleFavorite(recipe.title, e)} 
                          disabled={favoritesSyncing}
                          className="p-2 border-2 border-stone-900 rounded-xl bg-white hover:bg-stone-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ml-auto"
                        >
                          <Heart 
                            size={16} 
                            className={favoriteRecipes.includes(recipe.title) ? "fill-rose-500 text-rose-500" : "text-stone-400"} 
                          />
                        </button>
                      </div>
                      <h4 className="text-lg font-black leading-tight mb-2 uppercase">{recipe.title}</h4>
                      {recipe.ratingCount ? (
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="text-amber-500 fill-amber-500" size={14} />
                          <span className="text-xs font-black text-stone-700">{recipe.averageRating}</span>
                          <span className="text-[10px] font-bold text-stone-400">({recipe.ratingCount})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 mb-2">
                          <Star className="text-stone-300" size={14} />
                          <span className="text-[10px] font-bold text-stone-400">No ratings yet</span>
                        </div>
                      )}
                      <p className="text-stone-500 text-xs font-bold leading-relaxed line-clamp-2">{recipe.description}</p>
                    </div>
                    <div className="mt-6 flex flex-col gap-2 text-stone-400">
                      {recipe.ingredients.map((ing, j) => {
                        const matched = getBestMatchedIngredient(ing.name);
                        const available = matched ? matched.stock > 0 : false;
                        const inSeason = matched ? matched.isSeasonal !== false : true;
                        const optimal = available && inSeason;
                        const alts = getSubstitutions(ing.name);
                        return (
                          <div key={j} className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`bento-tag ${!optimal ? 'border-amber-500 text-amber-600' : ''}`}>
                                {ing.name} {!optimal && '⚠️'}
                              </span>
                              {optimal && <span className="text-[10px] text-emerald-600 font-bold">✓ Prime</span>}
                              {!inSeason && available && <span className="text-[10px] text-amber-600 font-bold leading-tight">Out of season</span>}
                              {!available && <span className="text-[10px] text-red-500 font-bold leading-tight">Out of stock</span>}
                            </div>
                            {!optimal && alts.length > 0 && (
                              <div className="flex flex-col gap-0.5 ml-1 mt-1">
                                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest text-[8px] mb-0.5">
                                  Potential Local Substitutes:
                                </p>
                                {alts.map(alt => {
                                  const altMatched = getBestMatchedIngredient(alt);
                                  const altAvailable = altMatched ? altMatched.stock > 0 : false;
                                  return (
                                    <p key={alt} className={`text-[10px] font-bold ${altAvailable ? 'text-emerald-600' : 'text-amber-600/70'}`}>
                                      • {alt} {altAvailable ? '✓' : '⚠️'}
                                    </p>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6 flex gap-2">
                      <button className="flex-1 bg-stone-100 text-stone-900 py-3 rounded-xl border-2 border-stone-900 font-black text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-stone-50 transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none">
                        View
                      </button>
                      <button 
                        onClick={(e) => addToCart(recipe, e)}
                        className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl border-2 border-stone-900 font-black text-[10px] uppercase tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-700 transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none flex items-center justify-center gap-2"
                      >
                        <ShoppingCart size={14} /> Add Kit
                      </button>
                    </div>
                  </motion.div>
                );
              });
              })()
            )}
          </AnimatePresence>
        </section>
        </>
        )}

        {/* Recipe Detail Modal */}
        <AnimatePresence>
          {selectedRecipe && (
            (() => {
              const requiredFarms = selectedRecipe.ingredients.map(ing => {
                const matchedIngredient = getBestMatchedIngredient(ing.name);
                return matchedIngredient?.farmerName || ing.farmerName;
              }).filter((v, i, a) => v && a.indexOf(v) === i) as string[];

              return (
              <>
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedRecipe(null)}
                  className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60]"
                />
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[70] p-6 max-h-[90vh] overflow-y-auto"
                >
                  <div className="bento-card relative shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] bg-white p-8">
                    <header className="flex justify-between items-start mb-8">
                      <div>
                        <div className="flex gap-2 mb-2">
                          <div className="bento-tag bg-stone-100 border-stone-900 text-stone-900 inline-block">
                            {selectedRecipe.yields || "Yield: Varies"}
                          </div>
                          <div className="bento-tag-emerald inline-block">{selectedRecipe.carbonSavings} CO2 Savings</div>
                        </div>
                        <h3 className="text-3xl font-black tracking-tighter uppercase leading-tight mb-2">{selectedRecipe.title}</h3>
                        <p className="text-stone-500 text-sm font-bold leading-relaxed mb-4">{selectedRecipe.description}</p>
                        
                        <div className="flex items-center gap-1 mt-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button 
                              key={star}
                              onMouseEnter={() => setHoverRating(star)}
                              onMouseLeave={() => setHoverRating(0)}
                              onClick={() => handleRateRecipe(selectedRecipe, star)}
                              className="focus:outline-none transition-transform hover:scale-110"
                            >
                              <Star 
                                size={24} 
                                className={`transition-colors ${
                                  (hoverRating || selectedRecipe.averageRating || 0) >= star 
                                    ? "text-amber-500 fill-amber-500" 
                                    : "text-stone-300"
                                }`} 
                              />
                            </button>
                          ))}
                          <span className="text-xs font-black text-stone-700 ml-2">
                            {selectedRecipe.averageRating ? `${selectedRecipe.averageRating} / 5` : "Rate this recipe!"}
                          </span>
                          {selectedRecipe.ratingCount ? <span className="text-[10px] font-bold text-stone-400">({selectedRecipe.ratingCount} ratings)</span> : null}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => toggleFavorite(selectedRecipe.title, e)} 
                          disabled={favoritesSyncing}
                          className="p-2 border-2 border-stone-900 rounded-xl hover:bg-stone-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                        >
                          <Heart 
                            size={20} 
                            className={favoriteRecipes.includes(selectedRecipe.title) ? "fill-rose-500 text-rose-500" : "text-stone-400"} 
                          />
                        </button>
                        <button onClick={() => setSelectedRecipe(null)} className="p-2 border-2 border-stone-900 rounded-xl hover:bg-stone-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"><X size={20} /></button>
                      </div>
                    </header>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-4">Required Ingredients</h4>
                      <div className="space-y-4">
                        {selectedRecipe.ingredients.map((ing, j) => {
                          const matchedIngredient = getBestMatchedIngredient(ing.name);
                          const available = matchedIngredient ? matchedIngredient.stock > 0 : false;
                          const inSeason = matchedIngredient ? matchedIngredient.isSeasonal !== false : true;
                          const optimal = available && inSeason;
                          const alts = getSubstitutions(ing.name);
                          const farm = matchedIngredient?.farmerName || ing.farmerName;
                          const price = matchedIngredient ? `₱${matchedIngredient.price}/${matchedIngredient.unit}` : null;
                          const stock = matchedIngredient ? `${matchedIngredient.stock}${matchedIngredient.unit} limit` : null;

                          return (
                            <div key={j} className={`p-4 border-2 rounded-2xl ${optimal ? 'border-stone-900 bg-white' : 'border-amber-900/20 bg-amber-50'}`}>
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <p className="font-black text-sm uppercase">{ing.name}</p>
                                  <p className="text-xs font-bold text-stone-600 mt-1 bg-stone-100 px-2 py-0.5 rounded inline-block">{ing.amount}</p>
                                </div>
                              </div>
                              
                              <div className="bg-stone-50 rounded-xl border border-stone-200 p-3 flex flex-col gap-2">
                                <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-stone-100">
                                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest flex items-center gap-1">
                                    <MapPin size={10} className="text-emerald-500" /> Origin Farm
                                  </p>
                                  {farm ? (
                                    <div className="flex items-center gap-1 justify-end">
                                      {farmsData[farm] && (
                                        <button 
                                          onClick={(e) => { e.stopPropagation(); setSelectedFarmProfile(farmsData[farm]); }}
                                          className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-200 hover:bg-yellow-100 transition-colors cursor-pointer"
                                          title="View Farm Profile"
                                        >
                                          <Star size={8} className="fill-yellow-500 text-yellow-500" />
                                          <span className="text-[9px] font-black text-yellow-700">
                                            {farmsData[farm].averageRating > 0 ? farmsData[farm].averageRating.toFixed(1) : 'New'}
                                          </span>
                                        </button>
                                      )}
                                      <p className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase text-right">{farm}</p>
                                    </div>
                                  ) : (
                                    <p className="text-[10px] font-bold text-stone-400 uppercase italic text-right">Generic / Supermarket</p>
                                  )}
                                </div>
                                <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-stone-100">
                                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Est. Unit Price</p>
                                  {price ? (
                                    <p className="text-[10px] font-bold text-stone-700">{price}</p>
                                  ) : (
                                    <p className="text-[10px] font-bold text-stone-400 italic">Varies</p>
                                  )}
                                </div>
                                <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-stone-100">
                                  <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest">Inventory Status</p>
                                  {stock && available ? (
                                    <p className="text-[10px] font-bold text-stone-700">{stock} in stock {inSeason ? '' : '(Out of season)'}</p>
                                  ) : (
                                    <p className="text-[10px] font-bold text-amber-600 italic">Unavailable / Request needed</p>
                                  )}
                                </div>
                                {farm && farmsData[farm] && (
                                  <div className="flex justify-between items-center bg-white p-1.5 rounded-lg border border-stone-100">
                                    <p className="text-[9px] font-black uppercase text-stone-400 tracking-widest flex items-center gap-1">
                                      Rate Farm
                                    </p>
                                    <div className="flex gap-1">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <button 
                                          key={star}
                                          disabled={submittingRating === farm || !!farmsData[farm].userRating}
                                          onClick={() => submitFarmRating(farm, star)}
                                          className="p-0.5 hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                                        >
                                          <Star 
                                            size={12} 
                                            className={`transition-colors ${
                                              (farmsData[farm].userRating || 0) >= star 
                                                ? "fill-emerald-500 text-emerald-500" 
                                                : "text-stone-300"
                                            }`}
                                          />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {!optimal && (
                                <div className="mt-4 pt-4 border-t-2 border-stone-100">
                                   <div className="flex items-center gap-2 mb-3 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                                      <AlertTriangle size={14} className="flex-shrink-0" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                                        {!available ? 'Low Stock' : 'Out of Season'}
                                      </p>
                                   </div>
                                   <div className="bg-emerald-50 rounded-xl border-2 border-emerald-100 p-4 relative overflow-hidden">
                                     <div className="absolute -right-4 -top-4 opacity-10">
                                       <Leaf size={64} className="text-emerald-500" />
                                     </div>
                                     <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                       <Sparkles size={12} /> Suggested potential local substitutes:
                                     </p>
                                     <div className="flex flex-wrap gap-2 relative z-10">
                                       {alts.length > 0 ? (
                                         alts.map(alt => {
                                           const localProduce = getBestMatchedIngredient(alt);
                                           const isAltAvailable = localProduce ? localProduce.stock > 0 : false;
                                           return (
                                           <div key={alt} className={`flex flex-col gap-1.5 bg-white border-2 px-3 py-2 rounded-lg text-xs font-black uppercase transition-all cursor-default min-w-[140px] shadow-[2px_2px_0px_0px_rgba(5,150,105,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none ${isAltAvailable ? 'border-emerald-600 text-emerald-700 bg-emerald-50' : 'border-amber-500 text-amber-700 bg-amber-50 opacity-75'}`}>
                                             <div className="flex items-center justify-between gap-2">
                                               <span>{alt}</span>
                                               {isAltAvailable ? <Check size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-amber-500" />}
                                             </div>
                                             {localProduce && (
                                                <div className={`flex flex-col text-[9px] leading-tight normal-case font-bold border-t pt-1.5 mt-0.5 ${isAltAvailable ? 'text-emerald-800/70 border-emerald-200/50' : 'text-amber-800/70 border-amber-200/50'}`}>
                                                  <span className="flex items-center gap-1"><MapPin size={8} /> {localProduce.farmerName}</span>
                                                  <span className="flex items-center gap-1"><ShoppingCart size={8} /> {localProduce.stock}{localProduce.unit} available</span>
                                                </div>
                                              )}
                                              {!isAltAvailable && !localProduce && (
                                                <div className="flex flex-col text-[8px] text-amber-800/70 leading-tight normal-case font-bold border-t border-amber-200/50 pt-1.5 mt-0.5">
                                                  <span>Not locally stocked</span>
                                                </div>
                                              )}
                                           </div>
                                         )})
                                       ) : (
                                         <span className="bg-white border border-stone-200 px-3 py-1.5 rounded-lg text-xs font-bold text-stone-500 italic">
                                           Consider adjusting recipe or consulting regional farm network for generic local veg.
                                         </span>
                                       )}
                                     </div>
                                   </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-4">Preparation</h4>
                      <div className="space-y-4">
                        {selectedRecipe.instructions.map((step, k) => (
                          <div key={k} className="flex gap-4">
                            <span className="text-emerald-600 font-black text-xs">{(k+1).toString().padStart(2, '0')}</span>
                            <p className="text-xs font-medium text-stone-600 leading-relaxed">{step}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Region Map */}
                  <div className="mt-8 border-2 border-stone-900 rounded-3xl p-4 bg-stone-50">
                    <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-4">Supply Route Map (Pangasinan)</h4>
                    <div className="relative w-full h-64 bg-emerald-50 rounded-2xl border-2 border-stone-900 overflow-hidden shadow-[inset_0px_0px_20px_rgba(16,185,129,0.1)]">
                      <MapContainer 
                        center={[15.9758, 120.5707]} 
                        zoom={10} 
                        style={{ height: '100%', width: '100%' }} 
                        closePopupOnClick={true}
                        scrollWheelZoom={true}
                        dragging={true}
                        zoomControl={true}
                      >
                        <MapControls />
                        <TileLayer
                          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <Marker position={[15.9758, 120.5707]}>
                          <Popup closeButton={false} className="farm-popup">
                            <div className="p-3">
                              <span className="font-bold uppercase text-xs">Hub (Urdaneta)</span>
                            </div>
                          </Popup>
                        </Marker>
                        
                        {/* Live Riders */}
                        {activeRiders.map((rider) => (
                          <Marker key={rider.id} position={[rider.lat, rider.lng]} icon={riderIcon}>
                            <Popup closeButton={false} className="farm-popup">
                              <div className="p-2">
                                <span className="font-bold uppercase text-xs text-emerald-600 tracking-widest">Active Rider</span>
                              </div>
                            </Popup>
                          </Marker>
                        ))}

                        {/* Customer Delivery Locations */}
                        {transactions.filter(t => t.status === 'pending' || t.status === 'processing' || t.status === 'shipped').map((tx: any) => (
                          <Marker key={tx.id} position={[tx.lat, tx.lng]} icon={customerIcon}>
                            <Popup closeButton={false} autoPan={true} className="customer-popup">
                              <div className="p-2 min-w-[150px]">
                                <span className="font-bold uppercase text-xs text-blue-600 tracking-widest block mb-2 border-b-2 border-blue-100 pb-1">Order #{tx.id.substring(0, 6)}</span>
                                <div className="text-[10px] space-y-1">
                                   {tx.recipes?.map((r: any, i: number) => (
                                      <div key={i} className="flex justify-between">
                                        <span>{r.title}</span>
                                        <span className="text-stone-400 font-bold">x{r.servings}</span>
                                      </div>
                                   ))}
                                   {(!tx.recipes || tx.recipes.length === 0) && tx.items?.map((item: any, i: number) => (
                                      <div key={i} className="flex justify-between">
                                        <span>{item.name}</span>
                                        <span className="text-stone-400 font-bold">x{item.quantity}</span>
                                      </div>
                                   ))}
                                   <div className="mt-2 text-stone-500 font-black uppercase text-[9px] bg-stone-100 px-2 py-1 flex justify-between rounded items-center">
                                     <span>Status:</span>
                                     <span className={tx.status === 'pending' ? 'text-amber-500' : 'text-blue-500'}>{tx.status}</span>
                                   </div>
                                   {tx.deliveryAddress && (
                                     <div className="mt-2 text-[10px] font-bold text-stone-600 truncate">
                                       <MapPin size={10} className="inline mr-1" />
                                       {tx.deliveryAddress}
                                     </div>
                                   )}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                        ))}

                        {Object.entries(FARM_LOCATIONS).map(([farmName, coords]) => {
                          const farmProduce = availableProduce.filter(p => p.farmerName === farmName);
                          return (
                            <Marker key={farmName} position={[coords.lat, coords.lng]}>
                              <Popup closeButton={false} autoPan={true} className="farm-popup" maxHeight={250}>
                                <div className="p-4 min-w-[220px] max-w-[260px]">
                                  <div className="flex items-center justify-between border-b-2 border-emerald-100 mb-2 pb-1">
                                    <h4 className="font-black uppercase text-[11px] text-emerald-800">{farmName}</h4>
                                    {farmsData[farmName] && (
                                      <div className="flex items-center gap-0.5">
                                        <Star size={10} className="fill-emerald-500 text-emerald-500" />
                                        <span className="text-[10px] font-bold text-emerald-800">
                                          {farmsData[farmName].averageRating > 0 ? farmsData[farmName].averageRating.toFixed(1) : 'New'}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {farmsData[farmName] && (
                                    <div className="mb-3 space-y-2">
                                      {farmsData[farmName].description && (
                                        <p className="text-[10px] text-stone-600 italic">
                                          {farmsData[farmName].description}
                                        </p>
                                      )}
                                      {farmsData[farmName].sustainabilityPractices?.length > 0 && (
                                        <div>
                                          <span className="text-[9px] font-bold uppercase text-emerald-700 block mb-0.5">Practices:</span>
                                          <ul className="list-disc pl-3 text-[10px] text-stone-500">
                                            {farmsData[farmName].sustainabilityPractices.map((practice, idx) => (
                                              <li key={idx}>{practice}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                      
                                      <div className="bg-stone-50 rounded p-1.5 border border-stone-100 flex flex-col items-center">
                                        <span className="text-[8px] font-black uppercase tracking-widest text-stone-400 mb-1">
                                          {farmsData[farmName].userRating ? 'Your Rating' : 'Rate Quality & Sustainability'}
                                        </span>
                                        <div className="flex gap-1">
                                          {[1, 2, 3, 4, 5].map((star) => (
                                            <button 
                                              key={star}
                                              disabled={submittingRating === farmName || !!farmsData[farmName].userRating}
                                              onClick={() => submitFarmRating(farmName, star)}
                                              className="p-0.5 hover:scale-110 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                                            >
                                              <Star 
                                                size={14} 
                                                className={`transition-colors ${
                                                  (farmsData[farmName].userRating || 0) >= star 
                                                    ? "fill-emerald-500 text-emerald-500" 
                                                    : "text-stone-300"
                                                }`}
                                              />
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                      
                                      <button 
                                        onClick={() => setSelectedFarmProfile(farmsData[farmName])}
                                        className="w-full mt-2 bg-stone-900 text-white py-1.5 rounded text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors"
                                      >
                                        View Full Profile
                                      </button>
                                    </div>
                                  )}

                                  <div className="border-t border-stone-100 pt-2 relative">
                                    <span className="hidden">Produce separator</span>
                                  <div className="space-y-1.5">
                                    {farmProduce.map(prod => (
                                      <div key={prod.id} className="flex justify-between items-center gap-3 text-[10px]">
                                        <span className="font-bold text-stone-600">{prod.name}</span>
                                        <span className={`font-black ${prod.stock > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                          {prod.stock > 0 ? `${prod.stock}${prod.unit}` : 'Out'}
                                        </span>
                                      </div>
                                    ))}
                                    {farmProduce.length === 0 && (
                                      <span className="text-[10px] text-stone-400 italic">No specific stock</span>
                                    )}
                                  </div>
                                  </div>
                                </div>
                              </Popup>
                            </Marker>
                          );
                        })}
                      </MapContainer>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => {
                      addToCart(selectedRecipe, e);
                      setSelectedRecipe(null);
                    }}
                    className="w-full mt-10 bg-emerald-600 text-white py-6 rounded-3xl border-2 border-stone-900 font-black text-lg uppercase tracking-tighter shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all flex items-center justify-center gap-3"
                  >
                    <ShoppingCart size={24} /> Add Meal Kit to Cart
                  </button>
                </div>
              </motion.div>
              </>
              );
            })()
          )}
        </AnimatePresence>

        {/* Farm Profile Modal */}
        <AnimatePresence>
          {selectedFarmProfile && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedFarmProfile(null)}
                className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[80]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[90] p-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="bento-card relative shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] bg-white p-8 overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-100 rounded-bl-full -z-10 opacity-50" />
                  
                  <header className="flex justify-between items-start mb-8 relative">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <div className="bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded inline-flex items-center gap-1">
                          <Leaf size={12} /> Local Farm
                        </div>
                        <div className="flex items-center gap-1 bg-stone-100 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest text-stone-600">
                          <Star size={12} className="fill-emerald-500 text-emerald-500" />
                          {selectedFarmProfile.averageRating > 0 ? selectedFarmProfile.averageRating.toFixed(1) : 'New'} ({selectedFarmProfile.ratingCount})
                        </div>
                      </div>
                      <h3 className="text-3xl font-black tracking-tighter uppercase leading-tight">{selectedFarmProfile.name}</h3>
                    </div>
                    <button onClick={() => setSelectedFarmProfile(null)} className="p-2 border-2 border-stone-900 rounded-xl hover:bg-stone-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"><X size={20} /></button>
                  </header>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                    <div className="space-y-6">
                      <section>
                        <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-3 flex items-center gap-2">
                          <BookOpen size={14} className="text-stone-500" /> Farm History & Overview
                        </h4>
                        <p className="text-stone-600 text-sm font-medium leading-relaxed bg-stone-50 p-4 rounded-2xl border border-stone-100">
                          {selectedFarmProfile.history || selectedFarmProfile.description || "No detailed history available for this farm yet."}
                        </p>
                      </section>

                      {selectedFarmProfile.sustainabilityPractices && selectedFarmProfile.sustainabilityPractices.length > 0 && (
                        <section>
                          <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-3 flex items-center gap-2">
                            <Wind size={14} className="text-emerald-500" /> Sustainability Practices
                          </h4>
                          <div className="flex flex-col gap-2">
                            {selectedFarmProfile.sustainabilityPractices.map((practice, idx) => (
                              <div key={idx} className="flex items-start gap-2 bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-100 text-xs font-bold">
                                <Check size={14} className="mt-0.5 text-emerald-600 flex-shrink-0" />
                                <span>{practice}</span>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                    
                    <div className="space-y-6">
                      <section>
                        <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-3 flex items-center gap-2">
                          <Phone size={14} className="text-stone-500" /> Contact & Reach
                        </h4>
                        <div className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3">
                          {selectedFarmProfile.contactInfo ? (
                            <>
                              {selectedFarmProfile.contactInfo.phone && (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0">
                                    <Phone size={14} className="text-stone-600" />
                                  </div>
                                  <span className="text-sm font-bold text-stone-700">{selectedFarmProfile.contactInfo.phone}</span>
                                </div>
                              )}
                              {selectedFarmProfile.contactInfo.email && (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0">
                                    <Mail size={14} className="text-stone-600" />
                                  </div>
                                  <span className="text-sm font-bold text-stone-700">{selectedFarmProfile.contactInfo.email}</span>
                                </div>
                              )}
                              {selectedFarmProfile.contactInfo.website && (
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-white border border-stone-200 flex items-center justify-center shrink-0">
                                    <Globe size={14} className="text-stone-600" />
                                  </div>
                                  <a href={selectedFarmProfile.contactInfo.website} target="_blank" rel="noreferrer" className="text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline line-clamp-1">
                                    {selectedFarmProfile.contactInfo.website}
                                  </a>
                                </div>
                              )}
                              {!selectedFarmProfile.contactInfo.phone && !selectedFarmProfile.contactInfo.email && !selectedFarmProfile.contactInfo.website && (
                                <p className="text-xs font-bold text-stone-500 italic">No contact information provided.</p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs font-bold text-stone-500 italic">Contact information not available.</p>
                          )}
                        </div>
                      </section>
                      
                      {selectedFarmProfile.photos && selectedFarmProfile.photos.length > 0 && (
                        <section>
                          <h4 className="text-[10px] font-black uppercase text-stone-400 tracking-widest mb-3 flex items-center gap-2">
                            <Camera size={14} className="text-stone-500" /> Farm Photos
                          </h4>
                          <div className="grid grid-cols-2 gap-2">
                            {selectedFarmProfile.photos.map((photo, i) => (
                              <div key={i} className="aspect-square rounded-xl bg-stone-200 border border-stone-300 overflow-hidden relative group">
                                <img src={photo} alt={`${selectedFarmProfile.name} snapshot ${i+1}`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                              </div>
                            ))}
                          </div>
                        </section>
                      )}
                    </div>
                  </div>

                  <div className="border-t-2 border-stone-100 pt-6">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                      <div className="flex gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Current Stock:</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                          {availableProduce.filter(p => p.farmerName === selectedFarmProfile.name).length} items active
                        </span>
                      </div>
                      <button 
                        onClick={() => setSelectedFarmProfile(null)}
                        className="bg-stone-900 text-white px-6 py-3 rounded-xl border-2 border-stone-900 font-black text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-stone-800 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
                      >
                        Close Profile
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Create Recipe Modal */}
        <AnimatePresence>
          {isCreatingRecipe && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCreatingRecipe(false)}
                className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[80]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl z-[90] p-6 max-h-[90vh] overflow-y-auto"
              >
                <div className="bento-card relative shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] bg-white p-8">
                  <header className="flex justify-between items-start mb-6 border-b-2 border-stone-100 pb-4">
                    <h3 className="text-3xl font-black tracking-tighter uppercase leading-tight">Create Recipe</h3>
                    <button onClick={() => setIsCreatingRecipe(false)} className="p-2 border-2 border-stone-900 rounded-xl hover:bg-stone-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"><X size={20} /></button>
                  </header>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-stone-500 mb-1 tracking-widest text-[#000]">Status</label>
                      <input 
                         type="text" 
                         value="Active" 
                         disabled
                         className="w-full bg-stone-100 border border-stone-200 rounded-xl py-2 px-3 text-sm font-bold text-stone-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-stone-500 mb-1 tracking-widest text-[#000]">Title</label>
                      <input 
                        type="text" 
                        value={newRecipe.title} 
                        onChange={(e) => setNewRecipe({...newRecipe, title: e.target.value})} 
                        className="w-full bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl py-3 px-4 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all font-bold" 
                        placeholder="Recipe Name" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase text-stone-500 mb-1 tracking-widest text-[#000]">Description</label>
                      <textarea 
                        value={newRecipe.description} 
                        onChange={(e) => setNewRecipe({...newRecipe, description: e.target.value})} 
                        className="w-full bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl py-3 px-4 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all font-bold resize-none h-24" 
                        placeholder="Briefly describe this dish..."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1 tracking-widest text-[#000]">Category</label>
                        <input 
                          type="text" 
                          value={newRecipe.category} 
                          onChange={(e) => setNewRecipe({...newRecipe, category: e.target.value})} 
                          className="w-full bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl py-2 px-3 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all font-bold text-sm" 
                          placeholder="e.g. Soup, Dessert"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1 tracking-widest text-[#000]">Yields</label>
                        <input 
                          type="text" 
                          value={newRecipe.yields} 
                          onChange={(e) => setNewRecipe({...newRecipe, yields: e.target.value})} 
                          className="w-full bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl py-2 px-3 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all font-bold text-sm" 
                          placeholder="e.g. 4 servings"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black uppercase text-stone-500 mb-1 tracking-widest text-[#000]">Carbon Savings</label>
                        <input 
                          type="text" 
                          value={newRecipe.carbonSavings} 
                          onChange={(e) => setNewRecipe({...newRecipe, carbonSavings: e.target.value})} 
                          className="w-full bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl py-2 px-3 focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] outline-none transition-all font-bold text-sm" 
                          placeholder="e.g. 1.2kg CO2"
                        />
                      </div>
                    </div>
                    
                    <div className="border-t-2 border-stone-100 pt-4">
                      <label className="block text-[10px] font-black uppercase text-stone-500 mb-2 tracking-widest text-[#000]">Ingredients</label>
                      <ul className="space-y-2 mb-3">
                        {newRecipe.ingredients?.map((ing, i) => (
                           <li key={i} className="flex justify-between items-center text-sm font-bold bg-stone-100 p-2 rounded-lg text-[#000]">
                             <span>{ing.amount} {ing.name}</span>
                             <button onClick={() => handleRemoveIngredient(i)} className="text-rose-500 hover:text-rose-700">
                               <X size={14} />
                             </button>
                           </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                         <input 
                           type="text" 
                           placeholder="Amount (e.g. 2 pcs)" 
                           value={newIngredientAmount}
                           onChange={e => setNewIngredientAmount(e.target.value)}
                           className="flex-1 bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl p-2 font-bold text-xs" 
                         />
                         <input 
                           type="text" 
                           placeholder="Ingredient name" 
                           value={newIngredientName}
                           onChange={e => setNewIngredientName(e.target.value)}
                           className="flex-[2] bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl p-2 font-bold text-xs" 
                         />
                         <button onClick={handleAddIngredient} className="bg-emerald-600 text-white font-black px-3 py-2 rounded-xl text-xs whitespace-nowrap">+ Add</button>
                      </div>
                    </div>

                    <div className="border-t-2 border-stone-100 pt-4">
                      <label className="block text-[10px] font-black uppercase text-stone-500 mb-2 tracking-widest text-[#000]">Instructions</label>
                      <ul className="space-y-2 mb-3">
                        {newRecipe.instructions?.map((inst, i) => (
                           <li key={i} className="flex justify-between items-start text-sm font-bold bg-stone-100 p-2 rounded-lg gap-2 text-[#000]">
                             <span>{i+1}. {inst}</span>
                             <button onClick={() => handleRemoveInstruction(i)} className="text-rose-500 hover:text-rose-700 mt-1 shrink-0">
                               <X size={14} />
                             </button>
                           </li>
                        ))}
                      </ul>
                      <div className="flex gap-2">
                         <textarea 
                           placeholder="Step description..." 
                           value={newInstruction}
                           onChange={e => setNewInstruction(e.target.value)}
                           className="flex-1 bg-stone-50 border-2 border-stone-900 text-[#000] rounded-xl p-2 font-bold text-xs resize-none" 
                           rows={2}
                         />
                         <button onClick={handleAddInstruction} className="bg-emerald-600 text-white font-black px-3 py-2 rounded-xl text-xs whitespace-nowrap self-start h-[52px]">+ Add Step</button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8">
                     <button
                       onClick={handleCreateRecipe}
                       disabled={isSavingRecipe}
                       className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none hover:bg-stone-800 transition-all disabled:opacity-50"
                     >
                       {isSavingRecipe ? 'Saving...' : 'Save Recipe'}
                     </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="bento-card-dark h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-emerald-400 tracking-tighter">Meal Kit Cart</h2>
            {cart.length > 0 && (
              <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-1 rounded border border-stone-900">
                {cart.length} Recipes
              </span>
            )}
          </div>
          
          <div className="space-y-4 flex-grow overflow-y-auto pr-2">
            {cart.length === 0 ? (
              <div className="text-center py-20 opacity-20">
                <ShoppingCart size={48} className="mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">Cart is empty</p>
                <p className="font-bold text-[10px] mt-2">Select seasonal recipes to start</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="bg-stone-900 border border-stone-700/50 rounded-2xl p-4 relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 opacity-5">
                     <UtensilsCrossed size={64} />
                  </div>
                  <div className="flex justify-between items-start mb-3 relative z-10">
                    <div>
                      <h4 className="font-black text-emerald-400 uppercase tracking-tight text-sm pr-6 leading-tight mb-1">{item.recipe.title}</h4>
                      <p className="text-[10px] text-stone-400 font-bold flex items-center gap-1">
                        <Leaf size={10} className="text-emerald-600"/> {item.recipe.carbonSavings}
                      </p>
                    </div>
                    <button onClick={() => removeFromCart(item.recipe.title)} className="text-stone-500 hover:text-rose-400 transition-colors">
                      <X size={16} />
                    </button>
                  </div>

                  {(() => {
                    const unavailableIngs = item.recipe.ingredients.filter(ing => !isAvailable(ing.name));
                    if (unavailableIngs.length > 0) {
                      return (
                        <div className="mb-3 p-2 bg-amber-900/40 border border-amber-700/50 rounded-xl relative z-10">
                          <p className="text-[9px] font-black uppercase text-amber-500 mb-1 flex items-center gap-1">
                            <AlertTriangle size={10} /> Needs Substitution
                          </p>
                          <div className="flex flex-col gap-1">
                            {unavailableIngs.map((ing, i) => {
                              const alts = getSubstitutions(ing.name);
                              return (
                                <div key={i} className="text-[10px]">
                                  <span className="text-amber-400 font-bold">{ing.name}</span>
                                  {alts.length > 0 && (
                                    <span className="text-stone-400 ml-1">
                                      → Try: {alts.map(alt => {
                                        const altAvail = isAvailable(alt);
                                        return (
                                          <span key={alt} className={altAvail ? "text-emerald-400 ml-1 font-bold" : "text-stone-500 ml-1"}>
                                            {alt}{altAvail ? '✓' : ''}
                                          </span>
                                        );
                                      })}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <div className="flex items-center justify-between border-t border-stone-700/50 pt-3 relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Servings</span>
                    <div className="flex items-center gap-3 bg-stone-800 rounded-xl p-1 border border-stone-700">
                      <button 
                        onClick={() => updateCartServings(item.recipe.title, item.servings - 1)}
                        className="w-6 h-6 flex items-center justify-center bg-stone-700 text-white rounded hover:bg-stone-600 font-bold"
                      >-</button>
                      <span className="font-black text-sm w-4 text-center">{item.servings}</span>
                      <button 
                        onClick={() => updateCartServings(item.recipe.title, item.servings + 1)}
                        className="w-6 h-6 flex items-center justify-center bg-stone-700 text-white rounded hover:bg-stone-600 font-bold"
                      >+</button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {cart.length > 0 && (
            <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/30 mt-8 shrink-0 flex flex-col gap-4">
               <div className="flex flex-col gap-2 relative">
                 <label htmlFor="delivery-address" className="text-[10px] font-black uppercase text-stone-400 tracking-widest pl-1">Delivery Address</label>
                 <div className="relative">
                   <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <MapPin size={14} className="text-stone-500" />
                   </div>
                   <input
                     id="delivery-address"
                     type="text"
                     placeholder="e.g., 123 Main St, Villasis..."
                     value={deliveryAddress}
                     onChange={(e) => setDeliveryAddress(e.target.value)}
                     className="w-full bg-stone-900 border border-stone-700/50 rounded-xl py-3 pl-9 pr-4 text-sm text-stone-300 placeholder-stone-600 focus:outline-none focus:border-emerald-500 focus:bg-stone-800 transition-colors"
                   />
                 </div>
               </div>
               <div className="flex justify-between items-center px-1">
                 <span className="text-stone-300 font-bold uppercase tracking-widest text-xs">Total</span>
                 <span className="text-emerald-400 font-black text-xl">₱{cart.reduce((acc, curr) => acc + (curr.servings * 150), 0).toFixed(2)}</span>
               </div>
               <button 
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl border border-emerald-500/50 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ShoppingCart size={16} /> {loading ? 'Processing...' : `Checkout ${cart.length} Meal Kit${cart.length > 1 ? 's' : ''}`}
               </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
