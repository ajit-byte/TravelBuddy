import { useState, useEffect, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import { useWebSettings } from '../context/WebSettingsContext';

const CONTINENTS = ['All Continents', 'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'];

const TRAVEL_STYLES = [
  'Budget-Backpacker', 'Digital Nomad', 'Luxury Solo', 'Nature Lover', 'Cultural Explorer', 'Adventure', 'Gastronomy',
  'Eco Travel', 'Road Trip', 'Wellness',
];

const CONTINENT_KEYWORDS = {
  Africa: ['africa', 'kenya', 'tanzania', 'egypt', 'morocco', 'nigeria', 'ghana', 'ethiopia', 'south africa', 'senegal', 'uganda', 'rwanda'],
  Antarctica: ['antarctica', 'south pole'],
  Asia: ['asia', 'japan', 'china', 'india', 'thailand', 'vietnam', 'indonesia', 'korea', 'nepal', 'bali', 'tokyo', 'bangkok', 'singapore', 'malaysia', 'philippines', 'sri lanka', 'maldives', 'dubai', 'turkey'],
  Europe: ['europe', 'france', 'italy', 'spain', 'germany', 'uk', 'england', 'paris', 'rome', 'barcelona', 'amsterdam', 'portugal', 'greece', 'switzerland', 'austria', 'norway', 'sweden', 'denmark', 'poland', 'czech', 'hungary', 'croatia', 'iceland'],
  'North America': ['north america', 'usa', 'canada', 'mexico', 'new york', 'los angeles', 'chicago', 'miami', 'toronto', 'vancouver', 'cancun', 'costa rica', 'cuba', 'jamaica'],
  Oceania: ['oceania', 'australia', 'new zealand', 'fiji', 'sydney', 'melbourne', 'auckland', 'papua'],
  'South America': ['south america', 'brazil', 'argentina', 'peru', 'colombia', 'chile', 'ecuador', 'bolivia', 'rio', 'buenos aires', 'machu picchu', 'amazon'],
};

function matchesContinent(itinerary, continent) {
  if (continent === 'All Continents') return true;
  const keywords = CONTINENT_KEYWORDS[continent] || [];
  // Add the continent name itself to the keywords
  const searchTerms = [...keywords, continent.toLowerCase()];
  
  const dest = (itinerary.destinations?.join(' ') || itinerary.destination || '').toLowerCase();
  const title = (itinerary.title || '').toLowerCase();
  const tags = (itinerary.tags?.join(' ') || '').toLowerCase();
  
  const combinedText = `${dest} ${title} ${tags}`;
  
  return searchTerms.some(k => combinedText.includes(k));
}

export default function BrowsePage() {
  const { user, profile } = useContext(AuthContext);
  const { t } = useWebSettings();
  const navigate = useNavigate();

  const [itineraries, setItineraries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [continent, setContinent] = useState('All Continents');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxBudget, setMaxBudget] = useState(10000);
  const [selectedStyles, setSelectedStyles] = useState([]);
  const [applied, setApplied] = useState(false);
  const [showMoreStyles, setShowMoreStyles] = useState(false);

  // Active filters (applied on match me click)
  const [activeFilters, setActiveFilters] = useState({
    continent: 'All Continents', startDate: '', endDate: '', maxBudget: 10000, styles: [],
  });

  useEffect(() => {
    const fetchItineraries = async () => {
      try {
        const token = JSON.parse(localStorage.getItem('authTokens'))?.token;
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/itineraries/public`, {
          headers: { 'x-auth-token': token || '' },
        });
        if (res.ok) setItineraries(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchItineraries();
  }, []);

  const toggleStyle = (style) => {
    setSelectedStyles(prev =>
      prev.includes(style) ? prev.filter(s => s !== style) : [...prev, style]
    );
  };

  const handleApplyFilters = () => {
    setActiveFilters({
      continent,
      startDate,
      endDate,
      maxBudget,
      styles: selectedStyles,
    });
    setApplied(true);
  };

  const handleClearFilters = () => {
    setContinent('All Continents');
    setStartDate('');
    setEndDate('');
    setMaxBudget(10000);
    setSelectedStyles([]);
    setActiveFilters({
      continent: 'All Continents', startDate: '', endDate: '', maxBudget: 10000, styles: [],
    });
    setApplied(false);
  };

  const filtered = useMemo(() => {
    return itineraries.filter(it => {
      if (!matchesContinent(it, activeFilters.continent)) return false;
      
      // Date filtering
      if (activeFilters.startDate || activeFilters.endDate) {
          const itStart = new Date(it.startDate);
          const itEnd = new Date(it.endDate);
          
          if (activeFilters.startDate) {
              const filterStart = new Date(activeFilters.startDate);
              // Itinerary must end after filter start
              if (itEnd < filterStart) return false;
          }
          
          if (activeFilters.endDate) {
              const filterEnd = new Date(activeFilters.endDate);
              // Itinerary must start before filter end
              if (itStart > filterEnd) return false;
          }
      }

      const budget = it.budget || 0;
      if (budget > activeFilters.maxBudget) return false;
      if (activeFilters.styles.length > 0) {
        const acts = (it.activities || []).map(a => a.toLowerCase());
        const match = activeFilters.styles.some(style =>
          acts.some(a => a.includes(style.toLowerCase()))
        );
        if (!match) return false;
      }
      return true;
    });
  }, [itineraries, activeFilters]);

  const displayList = applied ? filtered : itineraries;

  return (
    <div className="bg-surface font-body text-on-surface selection:bg-secondary-fixed min-h-screen">
      <Navbar />

      <main className="pt-24 pb-32 px-6 max-w-screen-2xl mx-auto">
        {/* Hero & Filters Section */}
        <header className="mb-12">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
            <div className="max-w-2xl">
              <h1 className="font-headline text-display-lg text-5xl font-extrabold tracking-tight text-primary mb-4">
                {t('Discover Your')} <span className="text-secondary">{t('Perfect Match')}</span>
              </h1>
              <p className="text-on-surface-variant text-lg leading-relaxed">
                {t('Explore community-verified itineraries tailored to your unique travel soul. Safe, solo, and smart.')}
              </p>
            </div>
            <button onClick={handleApplyFilters} className="bg-gradient-to-br from-tertiary-fixed to-on-tertiary-container text-on-tertiary-fixed font-bold py-4 px-8 rounded-full shadow-lg shadow-tertiary-container/10 flex items-center gap-3 hover:scale-105 transition-transform active:scale-95 group">
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
              {t('Match Me')}
            </button>
          </div>

          {/* Advanced Filters */}
          <div className="bg-surface-container-low p-8 rounded-3xl">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
              
              {/* Budget Slider */}
              <div className="space-y-4">
                <label className="font-headline text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">payments</span> {t('BUDGET MAX')}
                </label>
                <input 
                  className="w-full h-1.5 bg-outline-variant rounded-lg appearance-none cursor-pointer accent-primary" 
                  type="range"
                  min={500} 
                  max={20000} 
                  step={500} 
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(Number(e.target.value))}
                />
                <div className="flex justify-between text-xs font-bold text-outline uppercase tracking-wider">
                  <span>Up to ${maxBudget.toLocaleString()}</span>
                </div>
              </div>

              {/* Continent Selector */}
              <div className="space-y-4">
                <label className="font-headline text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">public</span> {t('CONTINENT')}
                </label>
                <div className="relative">
                  <select 
                    value={continent}
                    onChange={(e) => setContinent(e.target.value)}
                    className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-4 text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/30 cursor-pointer appearance-none outline-none"
                  >
                    {CONTINENTS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-2.5 text-outline pointer-events-none">expand_more</span>
                </div>
              </div>

              {/* Travel Style Chips */}
              <div className="space-y-4 lg:col-span-2">
                <label className="font-headline text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">explore</span> {t('TRAVEL STYLE')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {TRAVEL_STYLES.slice(0, 3).map(style => (
                    <span 
                      key={style}
                      onClick={() => toggleStyle(style)}
                      className={`px-4 py-2 rounded-full text-sm font-medium cursor-pointer transition-all ${selectedStyles.includes(style) ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container'}`}
                    >
                      {style}
                    </span>
                  ))}
                  
                  {/* View More Dropdown Box */}
                  <div className="relative">
                    <button 
                      onClick={() => setShowMoreStyles(!showMoreStyles)}
                      className={`border px-4 py-2 rounded-full text-sm font-bold flex items-center gap-1 transition-all outline-none ${showMoreStyles ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-surface-container-lowest text-primary border-primary/20 hover:bg-primary/5'}`}
                    >
                        {t('More')} <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${showMoreStyles ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>
                    {showMoreStyles && (
                      <div className="absolute left-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/20 z-20 overflow-hidden">
                        <div className="py-1">
                           {TRAVEL_STYLES.slice(3).map(style => (
                              <div 
                                key={style} 
                                onClick={() => {
                                  toggleStyle(style);
                                  setShowMoreStyles(false);
                                }}
                                className={`block px-4 py-2 text-sm cursor-pointer transition-colors ${selectedStyles.includes(style) ? 'bg-primary/10 text-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                              >
                                {style}
                              </div>
                           ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates Selection */}
              <div className="space-y-4">
                <label className="font-headline text-sm font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">calendar_month</span> {t('DATES')}
                </label>
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input 
                            type="date" 
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-3 text-[10px] font-bold text-on-surface focus:ring-2 focus:ring-primary/30 cursor-pointer outline-none appearance-none"
                        />
                    </div>
                    <span className="text-outline text-[10px] font-black shrink-0">TO</span>
                    <div className="relative flex-1">
                        <input 
                            type="date" 
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full bg-surface-container-lowest border-none rounded-xl py-3 px-3 text-[10px] font-bold text-on-surface focus:ring-2 focus:ring-primary/30 cursor-pointer outline-none appearance-none"
                        />
                    </div>
                </div>
              </div>
            </div>

            {/* Clear Filter Button */}
            <div className="mt-8 flex justify-center">
              <button 
                onClick={handleClearFilters}
                className="text-sm font-bold text-on-surface/40 hover:text-primary transition-colors flex items-center gap-2 group outline-none"
              >
                <span className="material-symbols-outlined text-sm group-hover:rotate-180 transition-transform duration-500">backspace</span>
                Clear All Filters
              </button>
            </div>
          </div>
        </header>

        {/* Results Grid */}
        {loading ? (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
               {[1,2,3,4,5,6].map(i => <div key={i} className="bg-surface-container-lowest rounded-3xl h-80 animate-pulse"></div>)}
             </div>
        ) : displayList.length === 0 ? (
             <div className="text-center py-20 text-on-surface/40 bg-surface-container-lowest rounded-3xl shadow-sm border border-outline-variant/10">
               <p className="text-xl font-medium font-['Manrope'] mb-2">No perfect matches right now</p>
               <p className="text-sm">Try tweaking your filters or expanding your budget range.</p>
             </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {displayList.map(itinerary => <TripCard key={itinerary._id} itinerary={itinerary} />)}
          </section>
        )}

        {/* Pagination / Load More */}
        {displayList.length >= 6 && (
          <div className="mt-16 flex justify-center">
            <button className="bg-surface-container-low text-primary font-bold py-3 px-10 rounded-full border border-outline-variant/30 hover:bg-surface-container-high transition-colors outline-none">
              Discover More Itineraries
            </button>
          </div>
        )}
      </main>

    </div>
  );
}

function TripCard({ itinerary }) {
  const navigate = useNavigate();

  const creatorName = itinerary.user?.nickname || itinerary.user?.username || 'Traveler';
  const creatorInitial = creatorName.charAt(0).toUpperCase();
  const creatorAvatar = itinerary.user?.profileIconUrl || null;
  const dest = itinerary.destinations?.join(', ') || itinerary.destination || 'Global Location';
  const imgUrl = itinerary.image ? (itinerary.image.startsWith('http') ? itinerary.image : `${import.meta.env.VITE_API_URL}${itinerary.image}`) : 'https://lh3.googleusercontent.com/aida-public/AB6AXuBwmd5fbhriMNq7r9cI1VTj43-648CNP58P_cQ0V8jfOK6YDe78mFp8akT2dtWLqGDmLjX1y2Ft8aqPguvUVBluSAXX1lj3yBOLq7zW4AJV3MZMQ9hjamtTS0UCms1mIFsku67vcE2yX66uK6P0GSse_gessOO1QUL1WbfQVcctoSMYJ1uaRmhPE9E2CT3JktM65BDfxGdgOs7ALQZPn7FQL9rMqSlRsH2Qf6L4LfsWxPgEK-tRt_K15tL0y7M7QzZA-lSg8vEm0EFM';

  let daysCount = '';
  if (itinerary.startDate && itinerary.endDate) {
      const s = new Date(itinerary.startDate);
      const e = new Date(itinerary.endDate);
      const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
      daysCount = `${diff} DAYS`;
  }

  return (
    <div className="group relative bg-surface-container-lowest rounded-3xl overflow-hidden transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 cursor-pointer flex flex-col h-full" onClick={() => navigate('/trip/' + itinerary._id, { state: { itinerary } })}>
      <div className="relative h-64 overflow-hidden shrink-0">
        <img className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={itinerary.title} src={imgUrl} loading="lazy" />
        <div className="absolute top-4 left-4 flex gap-2">
          {daysCount && <span className="bg-white/90 backdrop-blur-md text-primary px-3 py-1 rounded-full text-xs font-bold shadow-sm">{daysCount}</span>}
        </div>
        {itinerary.user?.isVerified && (
          <div className="absolute top-4 right-4 bg-blue-50/90 backdrop-blur-sm text-blue-600 px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1 border border-blue-100 shadow-sm animate-in fade-in zoom-in duration-500">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span> Verified Host
          </div>
        )}
      </div>

      <div className="p-6 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className="min-w-0 pr-4">
            <h3 className="font-headline text-xl font-bold text-primary mb-1 truncate">{itinerary.title}</h3>
            <p className="text-sm text-on-surface-variant flex items-center gap-1 truncate">
              <span className="material-symbols-outlined text-sm shrink-0">location_on</span> {dest}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs font-bold text-outline uppercase tracking-tighter">BUDGET</p>
            <p className="text-lg font-bold text-secondary">${itinerary.budget ? itinerary.budget.toLocaleString() : 'N/A'}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {itinerary.tags?.slice(0, 6).map((tag, i) => (
             <span key={i} className={`text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider ${i % 2 === 0 ? 'text-primary bg-primary-fixed' : 'text-secondary bg-secondary-fixed'}`}>
               {tag}
             </span>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between pt-6 border-t border-surface-container-low">
          <div
            className="relative flex items-center gap-2 min-w-0 group/owner cursor-pointer"
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${itinerary.user?._id}`); }}
            title="View owner's profile"
          >
            <div className="w-8 h-8 rounded-full bg-secondary text-secondary-text flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
               {creatorAvatar ? <img src={creatorAvatar} alt={creatorName} className="w-full h-full object-cover" /> : creatorInitial}
            </div>
            <span className="text-sm font-semibold text-on-surface truncate group-hover/owner:text-primary transition-colors">{creatorName}</span>
            {/* Tooltip */}
            <span className="absolute -top-8 left-0 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover/owner:opacity-100 transition-opacity pointer-events-none z-10">
              View owner's profile
            </span>
          </div>
          <button className="text-primary font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all shrink-0">
            View Details <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
