import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UtensilsCrossed, Sparkles, ShoppingCart, Leaf, Wind, Filter, Check, MapPin, AlertTriangle, X, Heart } from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getRecipeSuggestions, SuggestedRecipe, FarmIngredient } from '../../services/aiService';

interface EnhancedIngredient extends FarmIngredient {
  isOrganic?: boolean;
  isSeasonal?: boolean;
}

export default function Kitchen({ user }: { user: User }) {
  const [recipes, setRecipes] = useState<SuggestedRecipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [favoriteRecipes, setFavoriteRecipes] = useState<string[]>([]);
  const [favoritesSyncing, setFavoritesSyncing] = useState(false);
  const [sortBy, setSortBy] = useState<'carbon' | 'availability' | 'title' | 'yields'>('carbon');
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);

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

  // Mock available local produce with extra metadata
  const mockProduce: EnhancedIngredient[] = [
    { id: '1', name: 'Native Calamansi', price: 80, farmerName: 'Binalonan Organic', stock: 50, unit: 'kg', isOrganic: true, isSeasonal: true },
    { id: '2', name: 'Organic Dinorado Rice', price: 65, farmerName: 'Asingan Grains', stock: 200, unit: 'kg', isOrganic: true, isSeasonal: false },
    { id: '3', name: 'Lowland Eggplant', price: 45, farmerName: 'Villasis Valley', stock: 30, unit: 'kg', isOrganic: false, isSeasonal: true },
    { id: '4', name: 'Urdaneta Sweet Corn', price: 15, farmerName: 'Central Farms', stock: 100, unit: 'ears', isOrganic: false, isSeasonal: true },
    { id: '5', name: 'Native Ginger', price: 120, farmerName: 'Pozorrubio Gold', stock: 20, unit: 'kg', isOrganic: true, isSeasonal: true }
  ];

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => 
      prev.includes(filter) ? prev.filter(f => f !== filter) : [...prev, filter]
    );
  };

  const filteredProduce = mockProduce.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.farmerName.toLowerCase().includes(search.toLowerCase());
    
    const matchesOrganic = activeFilters.includes('organic') ? p.isOrganic : true;
    const matchesSeasonal = activeFilters.includes('seasonal') ? p.isSeasonal : true;
    
    // Check if any active filter matches farm name (case insensitive)
    const activeFarmFilters = activeFilters.filter(f => f !== 'organic' && f !== 'seasonal');
    const matchesFarm = activeFarmFilters.length > 0 
      ? activeFarmFilters.some(f => p.farmerName.toLowerCase().includes(f.toLowerCase()))
      : true;

    return matchesSearch && matchesOrganic && matchesSeasonal && matchesFarm;
  });

  const [selectedRecipe, setSelectedRecipe] = useState<SuggestedRecipe | null>(null);

  // Substitution map for localized Pangasinan produce
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

  const FARM_LOCATIONS: Record<string, { x: number, y: number }> = {
    'Binalonan Organic': { x: 45, y: 25 },
    'Asingan Grains': { x: 80, y: 45 },
    'Villasis Valley': { x: 45, y: 75 },
    'Central Farms': { x: 50, y: 50 },
    'Pozorrubio Gold': { x: 30, y: 15 }
  };

  const getSubstitutions = (ingName: string) => {
    const key = Object.keys(SUBSTITUTIONS).find(k => 
      ingName.toLowerCase().includes(k.toLowerCase()) || 
      k.toLowerCase().includes(ingName.toLowerCase())
    );
    return key ? SUBSTITUTIONS[key] : [];
  };

  const isAvailable = (ingName: string) => {
    const found = mockProduce.find(p => p.name.toLowerCase().includes(ingName.toLowerCase()));
    return found ? (found.stock > 0 && found.isSeasonal !== false) : false;
  };

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      // AI generates recipes based on the currently selected/filtered list of ingredients
      const ingredientsToUse = selectedIngredients.length > 0
        ? mockProduce.filter(p => selectedIngredients.includes(p.id))
        : filteredProduce;
      const suggestions = await getRecipeSuggestions(ingredientsToUse);
      setRecipes(suggestions);
    } catch (error) {
      console.error("Failed to fetch recipes", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, [activeFilters, selectedIngredients]); // Refresh recipes when filters or selections change

  const filterOptions = [
    { id: 'organic', label: 'Organic', icon: Leaf },
    { id: 'seasonal', label: 'Seasonal', icon: Wind },
    { id: 'binalonan', label: 'Binalonan Farms', icon: Filter },
    { id: 'central', label: 'Central Farms', icon: Filter },
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
          <h2 className="text-4xl font-black tracking-tighter">Kitchen terminal</h2>
          <p className="text-stone-500 font-bold text-xs uppercase tracking-[0.2em]">Ready for seasonal sourcing</p>
        </header>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-900 z-10" size={24} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ingredients..." 
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
            <div className="ml-auto flex flex-wrap items-center border-2 border-stone-900 rounded-xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <button 
                onClick={() => setSortBy('carbon')}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'carbon' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-stone-50 text-stone-600'}`}
              >
                Carbon
              </button>
              <div className="w-[2px] h-full bg-stone-900" />
              <button 
                onClick={() => setSortBy('availability')}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'availability' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-stone-50 text-stone-600'}`}
              >
                Availability
              </button>
              <div className="w-[2px] h-full bg-stone-900" />
              <button 
                onClick={() => setSortBy('title')}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'title' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-stone-50 text-stone-600'}`}
              >
                Title
              </button>
              <div className="w-[2px] h-full bg-stone-900" />
              <button 
                onClick={() => setSortBy('yields')}
                className={`px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'yields' ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-stone-50 text-stone-600'}`}
              >
                Yield
              </button>
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

                const getMissingIngredientsCount = (recipe: SuggestedRecipe) => {
                  return recipe.ingredients.filter(ing => !isAvailable(ing.name)).length;
                };

                const sortedRecipes = [...recipes].sort((a, b) => {
                  if (sortBy === 'availability') {
                    const aMissing = getMissingIngredientsCount(a);
                    const bMissing = getMissingIngredientsCount(b);
                    if (aMissing !== bMissing) {
                      return aMissing - bMissing; // fewer missing is better (ascending)
                    }
                  } else if (sortBy === 'title') {
                    return a.title.localeCompare(b.title);
                  } else if (sortBy === 'yields') {
                    const parseYield = (val: string) => {
                      const match = val?.match(/[\d.]+/);
                      return match ? parseFloat(match[0]) : 0;
                    };
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

                return sortedRecipes.map((recipe, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="bento-card group flex flex-col justify-between cursor-pointer hover:border-emerald-500 transition-all"
                    onClick={() => setSelectedRecipe(recipe)}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-12 h-12 border-2 border-stone-900 rounded-xl flex items-center justify-center font-bold text-xl relative">
                          🥗
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="bento-tag bg-stone-100 border-stone-900 text-stone-900">
                            {recipe.yields || "Yield: Varies"}
                          </div>
                          <div className="bento-tag-emerald">{recipe.carbonSavings} Saved</div>
                          <button 
                            onClick={(e) => toggleFavorite(recipe.title, e)} 
                            disabled={favoritesSyncing}
                            className="p-2 border-2 border-stone-900 rounded-xl bg-white hover:bg-stone-100 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                          >
                            <Heart 
                              size={16} 
                              className={favoriteRecipes.includes(recipe.title) ? "fill-rose-500 text-rose-500" : "text-stone-400"} 
                            />
                          </button>
                        </div>
                      </div>
                      <h4 className="text-lg font-black leading-tight mb-2 uppercase">{recipe.title}</h4>
                      <p className="text-stone-500 text-xs font-bold leading-relaxed line-clamp-2">{recipe.description}</p>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2 text-stone-400">
                      {recipe.ingredients.slice(0, 2).map((ing, j) => {
                        const available = isAvailable(ing.name);
                        return (
                          <span key={j} className={`bento-tag ${!available ? 'border-amber-500 text-amber-600' : ''}`}>
                            {ing.name} {!available && '⚠️'}
                          </span>
                        );
                      })}
                    </div>
                    <button className="w-full mt-6 bg-emerald-600 text-white py-3 rounded-xl border-2 border-stone-900 font-black text-xs uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:bg-emerald-700 transition-all">
                      Detail View
                    </button>
                  </motion.div>
                ));
              })()
            )}
          </AnimatePresence>
        </section>

        {/* Recipe Detail Modal */}
        <AnimatePresence>
          {selectedRecipe && (
            (() => {
              const requiredFarms = selectedRecipe.ingredients.map(ing => {
                const matchedIngredient = mockProduce.find(p => p.name.toLowerCase().includes(ing.name.toLowerCase()));
                return ing.farmerName || matchedIngredient?.farmerName;
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
                        <p className="text-stone-500 text-sm font-bold leading-relaxed">{selectedRecipe.description}</p>
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
                          const available = isAvailable(ing.name);
                          const alts = getSubstitutions(ing.name);
                          const matchedIngredient = mockProduce.find(p => p.name.toLowerCase().includes(ing.name.toLowerCase()));
                          const farm = ing.farmerName || matchedIngredient?.farmerName;
                          const price = matchedIngredient ? `₱${matchedIngredient.price}/${matchedIngredient.unit}` : null;
                          const stock = matchedIngredient ? `${matchedIngredient.stock}${matchedIngredient.unit} limit` : null;

                          return (
                            <div key={j} className={`p-4 border-2 rounded-2xl ${available ? 'border-stone-900 bg-white' : 'border-amber-900/20 bg-amber-50'}`}>
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
                                    <p className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase text-right">{farm}</p>
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
                                    <p className="text-[10px] font-bold text-stone-700">{stock} in stock</p>
                                  ) : (
                                    <p className="text-[10px] font-bold text-amber-600 italic">Unavailable / Request needed</p>
                                  )}
                                </div>
                              </div>

                              {!available && (
                                <div className="mt-4 pt-4 border-t-2 border-stone-100">
                                   <div className="flex items-center gap-2 mb-3 text-amber-600 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200">
                                      <AlertTriangle size={14} className="flex-shrink-0" />
                                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Low Stock or Out of Season</p>
                                   </div>
                                   <div className="bg-emerald-50 rounded-xl border-2 border-emerald-100 p-4 relative overflow-hidden">
                                     <div className="absolute -right-4 -top-4 opacity-10">
                                       <Leaf size={64} className="text-emerald-500" />
                                     </div>
                                     <p className="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-3 flex items-center gap-2">
                                       <Sparkles size={12} /> Local Substitutes Available!
                                     </p>
                                     <div className="flex flex-wrap gap-2 relative z-10">
                                       {alts.length > 0 ? (
                                         alts.map(alt => (
                                           <span key={alt} className="bg-white border-2 border-emerald-600 px-3 py-1.5 rounded-lg text-xs font-black uppercase text-emerald-700 shadow-[2px_2px_0px_0px_rgba(5,150,105,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-default">
                                             {alt}
                                           </span>
                                         ))
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
                    <div className="relative w-full h-48 bg-emerald-50 rounded-2xl border-2 border-stone-900 overflow-hidden shadow-[inset_0px_0px_20px_rgba(16,185,129,0.1)]">
                      {/* Basic grid lines for "map" effect */}
                      <div className="absolute inset-0 opacity-20 bg-[linear-gradient(rgba(16,185,129,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.5)_1px,transparent_1px)] bg-[size:20px_20px]" />
                      
                      {/* Urdaneta label (Center Point) */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                        <div className="w-3 h-3 bg-stone-900 rounded-full border-2 border-emerald-50 animate-pulse drop-shadow-md" />
                        <p className="mt-1 text-[8px] font-black uppercase text-stone-900 tracking-widest whitespace-nowrap bg-emerald-50/80 px-1 rounded">Hub (Urdaneta)</p>
                      </div>

                      {Object.entries(FARM_LOCATIONS).map(([farmName, coords]) => {
                        const isActive = requiredFarms.includes(farmName);
                        if (!isActive) return null;
                        return (
                          <motion.div 
                            key={farmName}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="absolute flex flex-col items-center justify-center group z-10"
                            style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                          >
                            <MapPin size={24} className="text-emerald-600 drop-shadow-[0px_4px_4px_rgba(0,0,0,0.25)] -mt-6" />
                            <div className="absolute top-2 bg-white border-2 border-emerald-600 px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest whitespace-nowrap z-20 shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]">
                              {farmName}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>

                  <button className="w-full mt-10 bg-emerald-600 text-white py-6 rounded-3xl border-2 border-stone-900 font-black text-lg uppercase tracking-tighter shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all">
                    Confirm Batch Order
                  </button>
                </div>
              </motion.div>
              </>
              );
            })()
          )}
        </AnimatePresence>
      </div>

      <div className="col-span-12 lg:col-span-4 space-y-6">
        <div className="bento-card-dark h-full flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-emerald-400 tracking-tighter">Inventory Pulse</h2>
            {activeFilters.length > 0 && (
              <span className="text-[10px] font-black text-white bg-emerald-600 px-2 py-1 rounded border border-stone-900">
                {filteredProduce.length} Hits
              </span>
            )}
          </div>
          <div className="space-y-4 flex-grow">
            {filteredProduce.map((p, i) => {
              const isSelected = selectedIngredients.includes(p.id);
              return (
              <div 
                key={i} 
                onClick={() => {
                  setSelectedIngredients(prev => 
                    prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                  )
                }}
                className={`flex justify-between items-center border-b pb-4 cursor-pointer p-3 rounded-2xl transition-all ${isSelected ? 'bg-emerald-500/20 border-emerald-500/50 shadow-[inset_0px_0px_10px_rgba(16,185,129,0.2)]' : 'border-white/10 hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-stone-500'}`}>
                    {isSelected && <Check size={14} className="text-white" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm uppercase leading-tight">{p.name}</p>
                      {p.isOrganic && <Leaf size={10} className="text-emerald-500" />}
                    </div>
                    <p className="text-[10px] text-stone-500 font-bold">{p.farmerName}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-black text-sm ${isSelected ? 'text-emerald-400' : 'text-emerald-500'}`}>{p.stock}{p.unit}</p>
                  <p className="text-[10px] font-bold text-stone-500 uppercase">Available</p>
                </div>
              </div>
            )})}
            {filteredProduce.length === 0 && (
              <div className="text-center py-20 opacity-20">
                <Search size={48} className="mx-auto mb-4" />
                <p className="font-black uppercase tracking-widest text-xs">No local matches</p>
              </div>
            )}
          </div>
          <div className="bg-emerald-500/10 p-4 rounded-2xl border border-emerald-500/30 mt-8">
            <p className="text-xs text-emerald-200 font-bold">
              {selectedIngredients.length > 0 
                ? `Using ${selectedIngredients.length} selected ingredient${selectedIngredients.length > 1 ? 's' : ''} for recipe suggestions.`
                : `The sourcing algorithm has ${filteredProduce.length} filtered results synced.`}
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
