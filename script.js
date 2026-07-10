// script.js - Premium client-side logic for Nearby Finder Pro
import { countries } from './countries.js';

// ==========================================================================
// 1. App State & Constants
// ==========================================================================

const STATE = {
  currentLocation: {
    name: "Washington, D.C.",
    city: "Washington",
    state: "District of Columbia",
    postalCode: "20500",
    country: "United States",
    countryCode: "US",
    lat: 38.8977,
    lon: -77.0365,
    formattedAddress: "White House, 1600, Pennsylvania Avenue Northwest, Washington, District of Columbia, 20500, United States"
  },
  selectedCountry: { name: "United States", code: "US" },
  favorites: [],
  recents: [],
  map: null,
  marker: null,
  theme: "dark"
};

const NOMINATIM_TIMEOUT_MS = 8000;

// ==========================================================================
// 2. DOM Elements Selection
// ==========================================================================

const els = {
  themeToggleBtn: document.getElementById('theme-toggle-btn'),
  utcClock: document.getElementById('utc-clock'),
  
  // Search inputs & dropdown
  searchForm: document.getElementById('location-search-form'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  countryDropdownTrigger: document.getElementById('country-dropdown-trigger'),
  countryDropdownPanel: document.getElementById('country-dropdown-panel'),
  countrySearchInput: document.getElementById('country-search-input'),
  countryList: document.getElementById('country-list'),
  selectedCountryFlag: document.getElementById('selected-country-flag'),
  selectedCountryName: document.getElementById('selected-country-name'),
  exampleChips: document.querySelectorAll('.example-chip'),
  
  // Results panel
  skeletonLoader: document.getElementById('skeleton-loader'),
  locationDetailsContent: document.getElementById('location-details-content'),
  locationBadgePostal: document.getElementById('location-badge-postal'),
  locationNameDisplay: document.getElementById('location-name-display'),
  locationHierarchyDisplay: document.getElementById('location-hierarchy-display'),
  favoriteToggleBtn: document.getElementById('favorite-toggle-btn'),
  
  // Meta values
  valCity: document.getElementById('val-city'),
  valState: document.getElementById('val-state'),
  valPostal: document.getElementById('val-postal'),
  valCountry: document.getElementById('val-country'),
  valLat: document.getElementById('val-lat'),
  valLong: document.getElementById('val-long'),
  
  // Action buttons
  actionBtnGmaps: document.getElementById('action-btn-gmaps'),
  actionBtnOsm: document.getElementById('action-btn-osm'),
  actionBtnCopyAddress: document.getElementById('action-btn-copy-address'),
  actionBtnCopyCoords: document.getElementById('action-btn-copy-coords'),
  actionBtnShare: document.getElementById('action-btn-share'),
  
  // Sidebar lists
  favoritesList: document.getElementById('favorites-list'),
  favoritesCount: document.getElementById('favorites-count'),
  recentsList: document.getElementById('recents-list'),
  clearRecentsBtn: document.getElementById('clear-recents-btn'),
  
  // Custom search
  customSearchForm: document.getElementById('custom-search-form'),
  customSearchInput: document.getElementById('custom-search-input'),
  quickChips: document.querySelectorAll('.quick-chip-btn'),
  
  // Toast notifications
  toastNotification: document.getElementById('toast-notification'),
  toastErrorText: document.getElementById('toast-error-text'),
  closeToastBtn: document.getElementById('close-toast-btn'),
  
  // Map overlays
  mapLoading: document.getElementById('map-loading'),
  
  // Category cards bento grid
  categoriesGrid: document.getElementById('categories-grid-container')
};

// ==========================================================================
// 3. Helper Functions
// ==========================================================================

// Utility flag emoji generator from ISO 2-letter country code
function getFlagEmoji(countryCode) {
  if (!countryCode) return "📍";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt(0));
  try {
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    return "📍";
  }
}

// Format UTC time for the live clock
function updateLiveClock() {
  const now = new Date();
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  if (els.utcClock) {
    els.utcClock.textContent = `UTC ${hours}:${minutes}`;
  }
}

// Standard copy to clipboard utility with UI status feedback
async function copyToClipboard(text, buttonEl, successText = "Copied!") {
  const originalHTML = buttonEl.innerHTML;
  try {
    await navigator.clipboard.writeText(text);
    buttonEl.innerHTML = `<i data-lucide="check" class="action-icon"></i> <span>${successText}</span>`;
    lucide.createIcons();
    buttonEl.classList.add('text-primary');
    setTimeout(() => {
      buttonEl.innerHTML = originalHTML;
      buttonEl.classList.remove('text-primary');
      lucide.createIcons();
    }, 2000);
  } catch (err) {
    console.error("Clipboard copy failed: ", err);
  }
}

// Trigger error message toast notification
function showToast(message) {
  if (!els.toastNotification) return;
  els.toastErrorText.textContent = message;
  els.toastNotification.classList.remove('hidden');
  
  // Auto-dismiss after 6 seconds
  if (window.toastTimeout) clearTimeout(window.toastTimeout);
  window.toastTimeout = setTimeout(() => {
    hideToast();
  }, 6000);
}

function hideToast() {
  if (els.toastNotification) {
    els.toastNotification.classList.add('hidden');
  }
}

// Generate URL encoding helper for nearby search query
function getGoogleMapsSearchUrl(query) {
  const loc = STATE.currentLocation;
  // Generate a beautiful searchable query combining user category/place with address components
  const nearText = `${loc.city ? loc.city + ', ' : ''}${loc.state ? loc.state + ' ' : ''}${loc.postalCode ? loc.postalCode + ' ' : ''}${loc.country}`;
  const fullSearchString = `${query} near ${nearText.trim()}`;
  return `https://www.google.com/maps/search/${encodeURIComponent(fullSearchString)}/@${loc.lat},${loc.lon},14z`;
}

// ==========================================================================
// 4. Custom Country Dropdown Engine
// ==========================================================================

function initCountryDropdown() {
  // Populate country list
  renderCountryDropdownList(countries);

  // Toggle dropdown open
  els.countryDropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = els.countryDropdownTrigger.parentElement.classList.contains('open');
    closeAllDropdowns();
    if (!isOpen) {
      els.countryDropdownTrigger.parentElement.classList.add('open');
      els.countrySearchInput.focus();
    }
  });

  // Filter countries on input
  els.countrySearchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = countries.filter(c => c.name.toLowerCase().includes(term));
    renderCountryDropdownList(filtered);
  });

  // Close dropdown on click outside
  document.addEventListener('click', () => {
    closeAllDropdowns();
  });

  // Prevent dropdown panel closing when clicking search input
  els.countryDropdownPanel.addEventListener('click', (e) => {
    e.stopPropagation();
  });
}

function renderCountryDropdownList(countryArray) {
  els.countryList.innerHTML = '';
  if (countryArray.length === 0) {
    els.countryList.innerHTML = '<li class="dropdown-item text-muted">No countries found</li>';
    return;
  }

  countryArray.forEach(country => {
    const li = document.createElement('li');
    li.className = 'dropdown-item';
    if (STATE.selectedCountry.code === country.code) {
      li.classList.add('selected');
    }
    const flag = getFlagEmoji(country.code);
    li.innerHTML = `<span>${flag}</span> <span class="country-name-text">${country.name}</span>`;
    
    li.addEventListener('click', () => {
      selectCountry(country);
      closeAllDropdowns();
    });
    els.countryList.appendChild(li);
  });
}

function selectCountry(country) {
  STATE.selectedCountry = country;
  els.selectedCountryFlag.textContent = getFlagEmoji(country.code);
  els.selectedCountryName.textContent = country.name;
  
  // Update selection in list elements
  const items = els.countryList.querySelectorAll('.dropdown-item');
  items.forEach(item => {
    const nameText = item.querySelector('.country-name-text');
    if (nameText && nameText.textContent === country.name) {
      item.classList.add('selected');
    } else {
      item.classList.remove('selected');
    }
  });
}

function closeAllDropdowns() {
  const dropdowns = document.querySelectorAll('.custom-dropdown');
  dropdowns.forEach(d => d.classList.remove('open'));
}

// ==========================================================================
// 5. Leaflet Map Initialization & Management
// ==========================================================================

function initLeafletMap() {
  const loc = STATE.currentLocation;
  
  // Create map instance
  STATE.map = L.map('leaflet-map', {
    zoomControl: true,
    scrollWheelZoom: true
  }).setView([loc.lat, loc.lon], 13);

  // Load OpenStreetMap tiles
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(STATE.map);

  // Add marker
  const popupContent = `
    <div class="leaflet-popup-text-bold">${loc.city || loc.name}</div>
    <div class="leaflet-popup-text-coords">${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</div>
  `;
  
  STATE.marker = L.marker([loc.lat, loc.lon]).addTo(STATE.map)
    .bindPopup(popupContent)
    .openPopup();
}

function updateLeafletMapView() {
  const loc = STATE.currentLocation;
  if (!STATE.map) {
    initLeafletMap();
    return;
  }

  els.mapLoading.classList.remove('hidden');
  
  // Pan and Zoom
  STATE.map.setView([loc.lat, loc.lon], 14, {
    animate: true,
    duration: 1.0
  });

  // Update marker & popup
  STATE.marker.setLatLng([loc.lat, loc.lon]);
  
  const popupContent = `
    <div class="leaflet-popup-text-bold">${loc.city || loc.name}</div>
    <div class="leaflet-popup-text-coords">${loc.lat.toFixed(4)}, ${loc.lon.toFixed(4)}</div>
    <div class="leaflet-popup-text-coords">${loc.country}</div>
  `;
  STATE.marker.getPopup().setContent(popupContent);
  STATE.marker.openPopup();

  setTimeout(() => {
    els.mapLoading.classList.add('hidden');
    // Ensure Leaflet recalculates bounds properly
    STATE.map.invalidateSize();
  }, 400);
}

// ==========================================================================
// 6. Nominatim Geo-Lookup Engine
// ==========================================================================

// Smart Location Parser helper function
function parseNominatimLocation(item, queryString) {
  const addr = item.address || {};
  
  // 1. Extract the most meaningful locality using priority list
  const localityFields = [
    'city',
    'town',
    'municipality',
    'suburb',
    'city_district',
    'borough',
    'village',
    'hamlet',
    'locality'
  ];
  
  let locality = null;
  for (const field of localityFields) {
    if (addr[field] && String(addr[field]).trim() !== "") {
      locality = String(addr[field]).trim();
      break;
    }
  }
  
  // 2. Extract district from county or district
  let district = null;
  if (addr.district && String(addr.district).trim() !== "") {
    district = String(addr.district).trim();
  } else if (addr.county && String(addr.county).trim() !== "") {
    district = String(addr.county).trim();
  }
  
  // 3. Extract state from state or state_district or region or province
  let state = null;
  if (addr.state && String(addr.state).trim() !== "") {
    state = String(addr.state).trim();
  } else if (addr.state_district && String(addr.state_district).trim() !== "") {
    state = String(addr.state_district).trim();
  } else if (addr.region && String(addr.region).trim() !== "") {
    state = String(addr.region).trim();
  } else if (addr.province && String(addr.province).trim() !== "") {
    state = String(addr.province).trim();
  }
  
  // 4. If city (locality) is still unavailable, parse the display_name string and extract the first meaningful populated place.
  if (!locality && item.display_name) {
    const parts = item.display_name.split(',').map(p => p.trim());
    const countryName = addr.country || parts[parts.length - 1];
    
    for (const part of parts) {
      const cleanPart = part.trim();
      if (!cleanPart) continue;
      
      // Skip pure numbers (e.g. street numbers/house numbers)
      if (/^\d+$/.test(cleanPart)) continue;
      
      // Skip postcodes (e.g. "90210", "SW1A 1AA")
      if (/^\d{3,10}$/.test(cleanPart)) continue;
      if (/^[A-Z0-9]{3,5}\s?[A-Z0-9]{3,5}$/i.test(cleanPart)) continue;
      
      // Skip country name
      if (countryName && cleanPart.toLowerCase() === countryName.toLowerCase()) continue;
      
      // Skip state/region names
      if (state && cleanPart.toLowerCase() === state.toLowerCase()) continue;
      
      // Skip district/county names
      if (district && cleanPart.toLowerCase() === district.toLowerCase()) continue;
      
      // Skip parts containing street indicators
      const streetRegex = /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|way|court|ct|highway|hwy|square|sq|place|pl|terrace|ter|parkway|pkwy|building|bldg|floor|fl|suite|ste|room|rm|apartment|apt|no|nr|route|rt)\b/i;
      if (streetRegex.test(cleanPart)) continue;
      
      // Skip parts that are just number ranges or contain coordinates
      if (/^[\d-\s/]+$/.test(cleanPart)) continue;
      
      // If we made it past these filters, this is our best populated place candidate!
      locality = cleanPart;
      break;
    }
    
    // As an ultimate fallback if everything got filtered out, take the first segment
    if (!locality && parts.length > 0) {
      locality = parts[0];
    }
  }
  
  return {
    locality: locality || "N/A",
    district: district || "N/A",
    state: state || "N/A"
  };
}

async function performLocationLookup(queryString, countryCode) {
  // Set UI to loading state
  setLoadingState(true);
  hideToast();

  // Create clean query adding country filter if present
  let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryString)}&format=json&addressdetails=1&limit=1`;
  if (countryCode) {
    url += `&countrycodes=${countryCode.toLowerCase()}`;
  }

  // Set up fetch abort controller for handling custom timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'NearbyFinderPro/1.0 (m.jrnayeem@gmail.com)'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP network error: status ${response.status}`);
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      // If no result with country code, retry once globally as fallback
      if (countryCode) {
        return await performLocationLookup(queryString, "");
      }
      throw new Error("No coordinate data found. Try verifying spelling or ZIP code.");
    }

    const item = data[0];
    const addr = item.address || {};
    
    // Extract postal code safely
    const postal = addr.postcode || queryString.match(/\b\d{5}\b/)?.[0] || "N/A";
    
    // Apply our smart location parser
    const parsedLoc = parseNominatimLocation(item, queryString);
    
    // Parse location values
    const locationObj = {
      name: item.display_name,
      city: parsedLoc.locality,
      state: parsedLoc.state,
      district: parsedLoc.district,
      postalCode: postal,
      country: addr.country || "N/A",
      countryCode: addr.country_code ? addr.country_code.toUpperCase() : "US",
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      formattedAddress: item.display_name
    };

    // Update global state
    STATE.currentLocation = locationObj;

    // Display values to UI
    renderLocationDetails();
    
    // Update map marker
    updateLeafletMapView();

    // Add search to recent lists
    addSearchToRecents(locationObj);

  } catch (error) {
    console.error("Nominatim lookup failed: ", error);
    let errorMsg = "Unable to find location. Please check your spelling or try another ZIP.";
    if (error.name === 'AbortError') {
      errorMsg = "Request timed out. Please check your internet connection and try again.";
    } else if (error.message) {
      errorMsg = error.message;
    }
    showToast(errorMsg);
  } finally {
    setLoadingState(false);
  }
}

function setLoadingState(isLoading) {
  if (isLoading) {
    els.skeletonLoader.classList.remove('hidden');
    els.locationDetailsContent.classList.add('hidden');
    els.searchBtn.disabled = true;
    els.searchBtn.querySelector('.btn-text').textContent = "Searching...";
  } else {
    els.skeletonLoader.classList.add('hidden');
    els.locationDetailsContent.classList.remove('hidden');
    els.searchBtn.disabled = false;
    els.searchBtn.querySelector('.btn-text').textContent = "Find Location";
  }
}

function renderLocationDetails() {
  const loc = STATE.currentLocation;

  // Header Title
  els.locationNameDisplay.textContent = loc.city !== "N/A" ? `${loc.city}, ${loc.country}` : loc.name.split(',')[0];
  els.locationHierarchyDisplay.textContent = loc.formattedAddress;
  
  // Badge
  els.locationBadgePostal.textContent = loc.postalCode !== "N/A" ? `Postal Code: ${loc.postalCode}` : "Detected Coordinate";

  // Table Details
  els.valCity.textContent = loc.city;
  els.valState.textContent = loc.district && loc.district !== "N/A" ? `${loc.district}, ${loc.state}` : loc.state;
  els.valPostal.textContent = loc.postalCode;
  els.valCountry.textContent = loc.country;
  els.valLat.textContent = loc.lat.toFixed(5);
  els.valLong.textContent = loc.lon.toFixed(5);

  // Setup Dynamic Action URLs
  // Google Maps Search link
  els.actionBtnGmaps.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.formattedAddress)}`;
  
  // OpenStreetMap link
  els.actionBtnOsm.href = `https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lon}#map=16/${loc.lat}/${loc.lon}`;

  // Toggle favorite icon state
  updateFavoriteIconState();

  // Highlight result with smooth entry animation
  els.locationDetailsContent.classList.remove('fade-in');
  void els.locationDetailsContent.offsetWidth; // Trigger reflow
  els.locationDetailsContent.classList.add('fade-in');
}

// ==========================================================================
// 7. Favorites & Recent Searches LocalStorage Managers
// ==========================================================================

function loadUserDataFromStorage() {
  // Favorites
  try {
    const savedFavs = localStorage.getItem('np_favorites');
    STATE.favorites = savedFavs ? JSON.parse(savedFavs) : [];
  } catch (e) {
    STATE.favorites = [];
  }
  
  // Recents
  try {
    const savedRecents = localStorage.getItem('np_recents');
    STATE.recents = savedRecents ? JSON.parse(savedRecents) : [];
  } catch (e) {
    STATE.recents = [];
  }

  renderFavoritesList();
  renderRecentsList();
}

// Save favorites helper
function saveFavoritesToStorage() {
  localStorage.setItem('np_favorites', JSON.stringify(STATE.favorites));
  renderFavoritesList();
  updateFavoriteIconState();
}

// Save recents helper
function saveRecentsToStorage() {
  localStorage.setItem('np_recents', JSON.stringify(STATE.recents));
  renderRecentsList();
}

// Add current location to favorites list
function toggleFavoriteCurrentLocation() {
  const loc = STATE.currentLocation;
  const index = STATE.favorites.findIndex(f => f.lat === loc.lat && f.lon === loc.lon);

  if (index >= 0) {
    // Already favorite, remove
    STATE.favorites.splice(index, 1);
  } else {
    // Add to favorites
    STATE.favorites.unshift({ ...loc, savedAt: new Date().toISOString() });
  }

  saveFavoritesToStorage();
}

function updateFavoriteIconState() {
  const loc = STATE.currentLocation;
  const isFav = STATE.favorites.some(f => f.lat === loc.lat && f.lon === loc.lon);
  if (isFav) {
    els.favoriteToggleBtn.classList.add('active');
    els.favoriteToggleBtn.title = "Saved in Favorites";
  } else {
    els.favoriteToggleBtn.classList.remove('active');
    els.favoriteToggleBtn.title = "Save to Favorites";
  }
}

// Render Favorites list in Sidebar
function renderFavoritesList() {
  els.favoritesCount.textContent = STATE.favorites.length;
  els.favoritesList.innerHTML = '';

  if (STATE.favorites.length === 0) {
    els.favoritesList.innerHTML = '<p class="empty-state-text">No saved locations yet. Click the star on detected locations to save.</p>';
    return;
  }

  STATE.favorites.forEach(fav => {
    const card = document.createElement('div');
    card.className = 'saved-item-card fade-in';
    
    const info = document.createElement('div');
    info.className = 'saved-item-info';
    const flag = getFlagEmoji(fav.countryCode);
    const shortTitle = fav.city !== "N/A" ? `${fav.city}, ${fav.countryCode}` : fav.name.split(',')[0];
    const subTitle = fav.postalCode !== "N/A" ? `Postal Code: ${fav.postalCode}` : fav.state;
    
    info.innerHTML = `
      <div class="saved-item-name">${flag} ${shortTitle}</div>
      <div class="saved-item-meta">${subTitle}</div>
    `;
    
    info.addEventListener('click', () => {
      STATE.currentLocation = fav;
      renderLocationDetails();
      updateLeafletMapView();
    });

    const actions = document.createElement('div');
    actions.className = 'saved-item-actions';

    const btnNav = document.createElement('button');
    btnNav.className = 'btn-saved-icon nav';
    btnNav.title = "Focus Location";
    btnNav.innerHTML = '<i data-lucide="eye" style="width:14px;height:14px;"></i>';
    btnNav.addEventListener('click', () => {
      STATE.currentLocation = fav;
      renderLocationDetails();
      updateLeafletMapView();
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-saved-icon delete';
    btnDelete.title = "Delete Favorite";
    btnDelete.innerHTML = '<i data-lucide="trash-2" style="width:14px;height:14px;"></i>';
    btnDelete.addEventListener('click', (e) => {
      e.stopPropagation();
      STATE.favorites = STATE.favorites.filter(f => !(f.lat === fav.lat && f.lon === fav.lon));
      saveFavoritesToStorage();
    });

    actions.appendChild(btnNav);
    actions.appendChild(btnDelete);
    card.appendChild(info);
    card.appendChild(actions);
    
    els.favoritesList.appendChild(card);
  });
  
  lucide.createIcons();
}

// Add lookup to recent history array
function addSearchToRecents(loc) {
  // Prevent duplicate consecutive entries
  if (STATE.recents.length > 0) {
    const first = STATE.recents[0];
    if (first.lat === loc.lat && first.lon === loc.lon) return;
  }

  // Remove matching coordinates to move to top
  STATE.recents = STATE.recents.filter(r => !(r.lat === loc.lat && r.lon === loc.lon));
  
  // Prepend
  STATE.recents.unshift({ ...loc, searchedAt: new Date().toISOString() });
  
  // Cap at 10 items
  if (STATE.recents.length > 10) {
    STATE.recents.pop();
  }

  saveRecentsToStorage();
}

// Render Recent Searches list
function renderRecentsList() {
  els.recentsList.innerHTML = '';

  if (STATE.recents.length === 0) {
    els.recentsList.innerHTML = '<p class="empty-state-text">Your recent searches will appear here.</p>';
    return;
  }

  STATE.recents.forEach(rec => {
    const card = document.createElement('div');
    card.className = 'saved-item-card fade-in';
    
    const info = document.createElement('div');
    info.className = 'saved-item-info';
    const flag = getFlagEmoji(rec.countryCode);
    const shortTitle = rec.city !== "N/A" ? `${rec.city}, ${rec.countryCode}` : rec.name.split(',')[0];
    const subTitle = rec.postalCode !== "N/A" ? `Postal Code: ${rec.postalCode}` : rec.state;
    
    info.innerHTML = `
      <div class="saved-item-name">${flag} ${shortTitle}</div>
      <div class="saved-item-meta">${subTitle}</div>
    `;
    
    info.addEventListener('click', () => {
      STATE.currentLocation = rec;
      renderLocationDetails();
      updateLeafletMapView();
    });

    const actions = document.createElement('div');
    actions.className = 'saved-item-actions';

    const btnNav = document.createElement('button');
    btnNav.className = 'btn-saved-icon nav';
    btnNav.title = "View Location";
    btnNav.innerHTML = '<i data-lucide="chevron-right" style="width:14px;height:14px;"></i>';
    btnNav.addEventListener('click', () => {
      STATE.currentLocation = rec;
      renderLocationDetails();
      updateLeafletMapView();
    });

    actions.appendChild(btnNav);
    card.appendChild(info);
    card.appendChild(actions);
    
    els.recentsList.appendChild(card);
  });

  lucide.createIcons();
}

// ==========================================================================
// 8. Visual theme Control Manager
// ==========================================================================

function initThemeToggler() {
  // Load saved theme preference
  const savedTheme = localStorage.getItem('np_theme') || 'dark';
  applyTheme(savedTheme);

  els.themeToggleBtn.addEventListener('click', () => {
    const newTheme = STATE.theme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });
}

function applyTheme(themeName) {
  STATE.theme = themeName;
  document.documentElement.setAttribute('data-theme', themeName);
  localStorage.setItem('np_theme', themeName);
  
  // Re-render map tiles configuration if Leaflet is active
  if (STATE.map) {
    // Redraw tile layers
    STATE.map.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        layer.redraw();
      }
    });
  }
}

// ==========================================================================
// 9. Event Listeners & Bootstrapping
// ==========================================================================

function setupEventListeners() {
  // Main Search Lookup
  els.searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = els.searchInput.value.trim();
    if (query) {
      performLocationLookup(query, STATE.selectedCountry.code);
    }
  });

  // Category Cards clicks & premium interactions
  const categoryCards = document.querySelectorAll('.category-card');
  categoryCards.forEach(card => {
    card.addEventListener('click', () => {
      const category = card.getAttribute('data-category');
      const googleSearchUrl = getGoogleMapsSearchUrl(category);
      window.open(googleSearchUrl, '_blank');
    });

    // Dynamic mouse move cursor tracker & luxurious 3D perspective tilt
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const tiltX = ((y - centerY) / centerY) * 4; // Max 4 degrees tilt
      const tiltY = ((centerX - x) / centerX) * 4;
      card.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-3px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });

  // Global premium keyboard shortcuts (Press '/' or 'Cmd+K' to focus lookup)
  document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement.tagName.toLowerCase();
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement.isContentEditable) {
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      els.searchInput.focus();
      els.searchInput.select();
    }
  });

  // Custom Place/Business Search
  els.customSearchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = els.customSearchInput.value.trim();
    if (query) {
      const googleSearchUrl = getGoogleMapsSearchUrl(query);
      window.open(googleSearchUrl, '_blank');
    }
  });

  // Quick chips clicks
  els.quickChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-query');
      const googleSearchUrl = getGoogleMapsSearchUrl(query);
      window.open(googleSearchUrl, '_blank');
    });
  });

  // Example lookup chips inside Search Card
  els.exampleChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const query = chip.getAttribute('data-search');
      const countryCode = chip.getAttribute('data-country');
      els.searchInput.value = query;
      
      // Update country dropdown trigger selection
      const countryMatch = countries.find(c => c.code === countryCode);
      if (countryMatch) {
        selectCountry(countryMatch);
      }
      
      performLocationLookup(query, countryCode);
    });
  });

  // Location details operations
  els.favoriteToggleBtn.addEventListener('click', () => {
    toggleFavoriteCurrentLocation();
  });

  // Copy full location address to clipboard
  els.actionBtnCopyAddress.addEventListener('click', () => {
    const loc = STATE.currentLocation;
    copyToClipboard(loc.formattedAddress, els.actionBtnCopyAddress, "Address Copied!");
  });

  // Copy lat/long coordinates to clipboard
  els.actionBtnCopyCoords.addEventListener('click', () => {
    const loc = STATE.currentLocation;
    const coordString = `${loc.lat.toFixed(6)}, ${loc.lon.toFixed(6)}`;
    copyToClipboard(coordString, els.actionBtnCopyCoords, "Coords Copied!");
  });

  // Share Location trigger
  els.actionBtnShare.addEventListener('click', async () => {
    const loc = STATE.currentLocation;
    const shareTitle = `Explore ${loc.city || 'Location'} - Nearby Finder Pro`;
    const shareText = `Check out nearby spots around ${loc.formattedAddress}. Powered by Nearby Finder Pro.`;
    const shareUrl = `${window.location.origin}${window.location.pathname}?search=${encodeURIComponent(loc.postalCode !== "N/A" ? loc.postalCode : (loc.city !== "N/A" ? loc.city : loc.name))}&country=${loc.countryCode}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
      } catch (err) {
        // Fallback to clipboard if sharing is dismissed or blocked
        console.log("Navigator sharing failed or cancelled, using copy fallback.");
        copyToClipboard(shareUrl, els.actionBtnShare, "Share Link Copied!");
      }
    } else {
      // Fallback
      copyToClipboard(shareUrl, els.actionBtnShare, "Share Link Copied!");
    }
  });

  // Clear recents
  els.clearRecentsBtn.addEventListener('click', () => {
    STATE.recents = [];
    saveRecentsToStorage();
  });

  // Close toast notification
  els.closeToastBtn.addEventListener('click', () => {
    hideToast();
  });
}

// Parse initial URL query parameters to allow sharing links
function parseUrlQueryParams() {
  const params = new URLSearchParams(window.location.search);
  const searchVal = params.get('search');
  const countryVal = params.get('country');

  if (searchVal) {
    els.searchInput.value = decodeURIComponent(searchVal);
    if (countryVal) {
      const match = countries.find(c => c.code.toLowerCase() === countryVal.toLowerCase());
      if (match) {
        selectCountry(match);
      }
    }
    performLocationLookup(searchVal, countryVal || "");
  } else {
    // Render default location (Washington D.C.) on initial loading
    renderLocationDetails();
    initLeafletMap();
  }
}

// ==========================================================================
// 10. Initialization Bootstrapper
// ==========================================================================

function init() {
  // Initialize UI features
  initThemeToggler();
  initCountryDropdown();
  loadUserDataFromStorage();
  setupEventListeners();

  // Parse any share queries, or fallback to standard boot
  parseUrlQueryParams();

  // Run live UTC clock
  updateLiveClock();
  setInterval(updateLiveClock, 60000);

  // Initialize Lucide Vector Icons
  lucide.createIcons();
}

// Run init once DOM loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
