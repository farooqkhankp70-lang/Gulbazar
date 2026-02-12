import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, query, orderByChild, equalTo, get } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// ================= FIREBASE CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyAEXhCsNEBmx5et3plv0WHXUtfpKwLuSRw",
    authDomain: "running-7c42c.firebaseapp.com",
    databaseURL: "https://running-7c42c-default-rtdb.firebaseio.com",
    projectId: "running-7c42c",
    storageBucket: "running-7c42c.firebasestorage.app",
    messagingSenderId: "696498252679",
    appId: "1:696498252679:web:0795a315476aac64a24122"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const IMG_BB_API_KEY = "db801e55f83a34710dc37d103f1048a8";

// ================= GLOBAL STATE =================
let state = {
    products: [],
    categories: [],
    heroSlides: [],
    settings: {
        phone: "",
        email: "",
        address: "",
        payment_methods: { cod: true, easypaisa: false, jazzcash: false },
        accounts: {
            easypaisa: { title: "Loading", number: "0000" },
            jazzcash: { title: "Loading", number: "0000" }
        }
    },
    cart: JSON.parse(localStorage.getItem('gulbazar_cart')) || [],
    deviceId: localStorage.getItem('gulbazar_device_id'),
    isLoading: true,
    sortOrder: 'default' 
};

if (!state.deviceId) {
    state.deviceId = 'usr_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('gulbazar_device_id', state.deviceId);
}

const objectToArray = function(data) {
    if (data) {
        if (Array.isArray(data)) {
            return data.filter(i => i);
        } else {
            return Object.keys(data).map(k => ({id: k, ...data[k]}));
        }
    } else {
        return [];
    }
};

window.tempCategoryProducts = []; 
window.directOrderData = null;

const escapeParam = function(str) {
    return str.replace(/'/g, "\\'");
};

// ================= APP INIT =================
function initApp() {
    renderSkeletonHome();

    onValue(ref(db, 'products'), (snapshot) => {
        state.products = objectToArray(snapshot.val());
        if(state.isLoading) {
            state.isLoading = false;
            handleInitialRouting();
        } else {
            refreshCurrentView();
        }
    });

    onValue(ref(db, 'categories'), (snapshot) => {
        let rawCats = objectToArray(snapshot.val());
        const priorityKeywords = ['watch', 'luxury', 'smart', 'men', 'women', 'rolex', 'casio'];
        state.categories = rawCats.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            const aIsPriority = priorityKeywords.some(key => aName.includes(key));
            const bIsPriority = priorityKeywords.some(key => bName.includes(key));
            if (aIsPriority && !bIsPriority) return -1; 
            if (!aIsPriority && bIsPriority) return 1;  
            return 0; 
        });

        renderDynamicNav(); 
        refreshCurrentView();
    });

    onValue(ref(db, 'hero_slides'), (snapshot) => {
        state.heroSlides = objectToArray(snapshot.val());
        refreshCurrentView();
    });

    onValue(ref(db, 'settings'), (snapshot) => {
        if(snapshot.exists()) {
            const val = snapshot.val();
            state.settings = { ...state.settings, ...val };
            if(val.accounts) state.settings.accounts = val.accounts;
            if(val.payment_methods) state.settings.payment_methods = val.payment_methods;
        }
        updateContactInfo();
    });

    updateCartUI();
}

function renderSkeletonHome() {
    const main = document.getElementById('app');
    let cards = '';
    for(let i=0; i<3; i++) {
        cards += `<div class="skeleton" style="width:100%; height:300px; border-radius:12px; margin-bottom:20px;"></div>`;
    }
    main.innerHTML = `
        <div class="skeleton" style="width:100%; aspect-ratio:16/9; max-height:450px; display:block;"></div>
        <div class="container section-padding">
            <div style="display:flex; flex-direction:column; gap:20px;">${cards}</div>
        </div>
    `;
}

function handleInitialRouting() {
    const currentHash = window.location.hash.replace('#', '');
    if(currentHash) {
        const parts = decodeURIComponent(currentHash).split(':');
        window.router(parts[0], parts[1]);
    } else {
        window.router('home');
    }
}

function refreshCurrentView() {
    if(state.isLoading) return;
    const hash = window.location.hash || '#home';
    const parts = decodeURIComponent(hash.replace('#', '')).split(':');
    
    if(parts[0] === 'home') {
        if(parts[1]) {
            renderCategoryGrid(parts[1]); 
        } else {
            renderLandingPage(); 
        }
    }
    else if(parts[0] === 'shop') renderShopAll();
    else if(parts[0] === 'product') renderProduct(parts[1]);
    else if(parts[0] === 'history') renderHistoryPage();
    else if(parts[0] === 'about') renderAbout();
    else if(parts[0] === 'contact') renderContact();
}

window.triggerRouter = function(page, param) {
    window.router(page, param);
    document.getElementById('sidebar').classList.remove('active');
    document.getElementById('overlay').style.display = 'none';
}

window.router = function(page, param = null) {
    // Reset sort order when changing main routes
    if(page !== 'shop' && page !== 'home') state.sortOrder = 'default';
    
    const newHash = page + (param ? ':' + param : '');
    if(decodeURIComponent(window.location.hash.replace('#','')) !== newHash) {
        window.location.hash = newHash;
    }
    window.scrollTo(0, 0);
    
    if(page === 'home') {
        if(param) {
            renderCategoryGrid(param);
        } else {
            renderLandingPage();
        }
    }
    else if(page === 'shop') renderShopAll();
    else if(page === 'product') renderProduct(param);
    else if(page === 'history') renderHistoryPage();
    else if(page === 'about') renderAbout();
    else if(page === 'contact') renderContact();
    
    document.getElementById('search-bar').classList.remove('active');
}

window.onpopstate = function() {
    refreshCurrentView();
};

window.goBackToHome = function() { window.router('home'); }

function renderDynamicNav() {
    const sb = document.getElementById('dynamic-cats-sidebar');
    if(state.categories.length === 0) return;
    let sbHtml = ``;
    state.categories.forEach(c => {
        sbHtml += `<a onclick="triggerRouter('home', '${escapeParam(c.name)}')" class="sidebar-link"><i class="fas fa-angle-right" style="width:25px;"></i> ${c.name}</a>`;
    });
    sb.innerHTML = sbHtml;
}

function updateContactInfo() {
    if(state.settings.phone) {
        document.getElementById('wa-float').href = `https://wa.me/${state.settings.phone}`;
        document.getElementById('footer-contact').innerHTML = `
            <li><i class="fas fa-phone"></i> +${state.settings.phone}</li>
            <li><i class="fas fa-envelope"></i> ${state.settings.email}</li>
            <li><i class="fas fa-map-marker-alt"></i> ${state.settings.address}</li>
        `;
    }
}

function autoScrollCategories() {
    setTimeout(() => {
        const container = document.querySelector('.cat-scroll-container');
        const activeItem = document.querySelector('.cat-item.active');
        if (container && activeItem) {
            const scrollLeft = activeItem.offsetLeft - (container.clientWidth / 2) + (activeItem.clientWidth / 2);
            container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
        }
    }, 100);
}

window.toggleSearchBar = function() {
    const bar = document.getElementById('search-bar');
    bar.classList.toggle('active');
    if(bar.classList.contains('active')) document.getElementById('global-search-input').focus();
}

window.handleSearch = function(term) {
    renderGridWithFilter(term);
}

function renderGridWithFilter(term) {
    const lower = term.toLowerCase();
    const filtered = state.products.filter(p => p.name.toLowerCase().includes(lower) || (p.cat && p.cat.toLowerCase().includes(lower)));
    const html = filtered.length ? filtered.map(productCard).join('') : '<div class="text-center" style="grid-column:1/-1;">No items match your search.</div>';
    
    const grid = document.querySelector('.grid-products');
    if(grid) {
        grid.innerHTML = html;
    } else {
        document.getElementById('app').innerHTML = `<div class="container section-padding"><h3>Search Results</h3><div class="grid-products">${html}</div></div>`;
    }
}

// ================= SORTING HELPER FUNCTIONS =================
function getPrice(p) {
    const variants = p.variants ? (Array.isArray(p.variants) ? p.variants : Object.values(p.variants)) : [];
    if(variants.length > 0) return parseInt(variants[0].price);
    return parseInt(p.price || 0);
}

function getSortedProducts(products) {
    let sorted = [...products];
    if(state.sortOrder === 'low') {
        sorted.sort((a, b) => getPrice(a) - getPrice(b));
    } else if(state.sortOrder === 'high') {
        sorted.sort((a, b) => getPrice(b) - getPrice(a));
    }
    return sorted;
}

window.updateSort = function(val, viewType, param) {
    state.sortOrder = val;
    if(viewType === 'shop') renderShopAll();
    else if(viewType === 'category') renderCategoryGrid(param);
};

// ================= VIEW: LANDING PAGE =================
function renderLandingPage() {
    if(state.isLoading) return;

    let slidesHtml = '';
    if(state.heroSlides.length > 0) {
        slidesHtml = state.heroSlides.map(s => `
            <div class="hero-slide">
                <img src="${s.img || 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?q=80&w=2080&auto=format&fit=crop'}">
                <div class="hero-text"><h2>${s.title || ''}</h2></div>
            </div>`).join('');
        if(slidesHtml) slidesHtml = `<section class="hero-section"><div class="hero-container"><div class="hero-track">${slidesHtml}</div></div></section>`;
    } else {
        slidesHtml = `<section class="hero-section"><div class="hero-container"><div class="hero-track"><div class="hero-slide"><img src="https://images.unsplash.com/photo-1495856458515-0637185db551?q=80&w=1740&auto=format&fit=crop"><div class="hero-text"><h2>Welcome to Gul Bazar</h2></div></div></div></div></section>`;
    }

    const navIcons = `
        <div class="cat-scroll-container">
            <div class="cat-item active" onclick="router('home')">
                <div class="cat-img-box"><img src="https://i.ibb.co/zHrc23WS/casio-watches-mens-category-banner-650.jpg"></div>
                <div class="cat-name">All Items</div>
            </div>
            ${state.categories.map(c => `
                <div class="cat-item" onclick="router('home', '${escapeParam(c.name)}')">
                    <div class="cat-img-box"><img src="${c.img}"></div>
                    <div class="cat-name">${c.name}</div>
                </div>
            `).join('')}
        </div>
    `;

    let cardsHtml = '';
    if (state.categories.length === 0) {
        cardsHtml = `<div class="text-center padding-50">No Categories Found.</div>`;
    } else {
        cardsHtml = state.categories.map(c => {
            const hasProducts = state.products.some(p => p.cat == c.name);
            if (!hasProducts) return ''; 

            return `
            <div class="cat-landing-card">
                <div class="cat-landing-img-wrap">
                    <img src="${c.img}" alt="${c.name}">
                </div>
                <div class="cat-landing-content">
                    <div class="cat-landing-header">
                        <h3 class="cat-landing-title">${c.name}</h3>
                        <div class="rating-stars"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
                    </div>
                    <div class="cat-badges">
                        <span class="badge badge-authentic"><i class="fas fa-certificate"></i> Authentic</span>
                        <span class="badge badge-premium"><i class="fas fa-crown"></i> Luxury</span>
                    </div>
                    <p class="cat-landing-desc">Discover the finest selection of ${c.name}. Timeless elegance and precision.</p>
                    <div class="cat-landing-actions">
                        <button class="cat-btn cat-btn-view" onclick="router('home', '${escapeParam(c.name)}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="cat-btn cat-btn-buy" onclick="buyNowCategory('${escapeParam(c.name)}')">
                            <i class="fas fa-shopping-bag"></i> Buy Now
                        </button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    document.getElementById('app').innerHTML = `
        ${slidesHtml}
        <div class="container">
            ${navIcons}
            <div class="section-padding" style="padding-top:10px;">
                <h3 style="margin-bottom:20px; border-left:4px solid var(--primary); padding-left:10px;">Watch Collections</h3>
                <div class="cat-landing-grid">${cardsHtml || '<p>No products available yet.</p>'}</div>
            </div>
        </div>`;
    
    autoScrollCategories();
    if(state.heroSlides.length > 1) startHeroAnimation();
}

function renderShopAll() {
    // Sort Products
    const sortedProducts = getSortedProducts(state.products);
    const productsHtml = sortedProducts.map(productCard).join('');

    // Sorting Dropdown HTML
    const sortDropdown = `
        <select onchange="updateSort(this.value, 'shop')" class="filter-select">
            <option value="default" ${state.sortOrder === 'default' ? 'selected' : ''}>Default</option>
            <option value="low" ${state.sortOrder === 'low' ? 'selected' : ''}>Price: Low to High</option>
            <option value="high" ${state.sortOrder === 'high' ? 'selected' : ''}>Price: High to Low</option>
        </select>
    `;

    document.getElementById('app').innerHTML = `
        <div class="container section-padding">
            <div class="flex-between" style="margin-bottom:20px;">
                <h3 style="border-left:4px solid var(--primary); padding-left:10px;">All Watches</h3>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${sortDropdown}
                </div>
            </div>
            <div class="grid-products">${productsHtml}</div>
        </div>`;
}

function renderAbout() {
    document.getElementById('app').innerHTML = `
        <div class="container section-padding">
            <div class="cat-landing-card" style="padding: 30px;">
                <h2 style="color:var(--primary); margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">About Gul Bazar</h2>
                <p style="line-height:1.8; color:#555; margin-bottom:20px;">Welcome to <strong>Gul Bazar</strong>, your premium destination for luxury and smart watches in Pakistan. We are dedicated to providing you with the finest timepieces, focusing on authenticity, style, and durability.</p>
                <p style="line-height:1.8; color:#555;">Founded in 2025, Gul Bazar has quickly become a trusted name for watch enthusiasts. Whether you are looking for a classic analog watch or a modern smartwatch, we have something for everyone.</p>
                <br>
                <p style="font-weight:bold; color:var(--primary);">Sincerely,<br>The Gul Bazar Team</p>
            </div>
        </div>`;
}

function renderContact() {
    document.getElementById('app').innerHTML = `
        <div class="container section-padding">
            <div class="cat-landing-card" style="padding: 30px;">
                <h2 style="color:var(--primary); margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">Contact Us</h2>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:30px; margin-top:20px;">
                    <div>
                        <h4 style="margin-bottom:10px;">Get in Touch</h4>
                        <div style="display:flex; align-items:center; gap:15px; margin-bottom:15px;">
                            <div style="width:40px; height:40px; background:var(--primary); color:white; border-radius:50%; display:flex; align-items:center; justify-content:center;"><i class="fas fa-phone"></i></div>
                            <div><strong>Phone:</strong><br>${state.settings.phone || 'Loading...'}</div>
                        </div>
                    </div>
                    <div style="background:#f9f9f9; padding:20px; border-radius:10px;">
                        <h4 style="margin-bottom:15px;">Message Us on WhatsApp</h4>
                        <a href="https://wa.me/${state.settings.phone}" target="_blank" class="btn" style="display:inline-block; background:#25D366; color:white; padding:12px 25px; border-radius:5px; font-weight:bold; text-decoration:none;">
                            <i class="fab fa-whatsapp"></i> Chat on WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
}

function renderCategoryGrid(catName) {
    const cat = state.categories.find(c => c.name === catName);
    const displayTitle = cat ? cat.name : 'Collection';
    const items = state.products.filter(p => p.cat == catName);
    
    // Sort items
    const sortedItems = getSortedProducts(items);

    const productsHtml = sortedItems.length 
        ? sortedItems.map(productCard).join('') 
        : `<div style="grid-column:1/-1; text-align:center; padding:50px; color:#999;"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:10px;"></i><p>No products found in this category.</p></div>`;

    // Sorting Dropdown HTML with param
    const sortDropdown = `
        <select onchange="updateSort(this.value, 'category', '${escapeParam(catName)}')" class="filter-select">
            <option value="default" ${state.sortOrder === 'default' ? 'selected' : ''}>Default</option>
            <option value="low" ${state.sortOrder === 'low' ? 'selected' : ''}>Price: Low to High</option>
            <option value="high" ${state.sortOrder === 'high' ? 'selected' : ''}>Price: High to Low</option>
        </select>
    `;

    document.getElementById('app').innerHTML = `
        <div class="container section-padding">
            <div class="cat-scroll-container">
                <div class="cat-item" onclick="router('home')">
                    <div class="cat-img-box"><img src="https://i.ibb.co/zHrc23WS/casio-watches-mens-category-banner-650.jpg"></div>
                    <div class="cat-name">All</div>
                </div>
                ${state.categories.map(c => `
                    <div class="cat-item ${catName === c.name ? 'active' : ''}" onclick="router('home', '${escapeParam(c.name)}')">
                        <div class="cat-img-box"><img src="${c.img}"></div>
                        <div class="cat-name">${c.name}</div>
                    </div>
                `).join('')}
            </div>
            <div class="flex-between" style="margin-bottom:20px; margin-top:20px;">
                <h3 style="border-left:4px solid var(--primary); padding-left:10px;">${displayTitle}</h3>
                <div style="display:flex; align-items:center; gap:10px;">
                    ${sortDropdown}
                </div>
            </div>
            <div class="grid-products">${productsHtml}</div>
        </div>`;
    
    autoScrollCategories();
}

function renderProduct(id) {
    const p = state.products.find(x => x.id == id);
    if(!p) return document.getElementById('app').innerHTML = `<div class="container section-padding text-center"><h2>Product Not Found</h2><button onclick="router('home')" class="btn" style="margin-top:20px; border:1px solid #333; padding:10px;">Home</button></div>`;

    const catObj = state.categories.find(c => c.name === p.cat);
    const catLabel = catObj ? catObj.id : 'Item';

    const images = p.img ? (Array.isArray(p.img) ? p.img : [p.img]) : ['https://via.placeholder.com/800?text=No+Image'];
    const slides = images.map(src => `<div class="hero-slide"><img src="${src}"></div>`).join('');
    const variants = p.variants ? (Array.isArray(p.variants) ? p.variants : Object.values(p.variants)) : [];
    let variantOpts = variants.length ? variants.map((v, i) => `<option value="${i}">${v.label} - PKR ${v.price}</option>`).join('') : '';
    let priceDisplay = variants.length ? `PKR ${variants[0].price}` : `PKR ${p.price || 0}`;

    document.getElementById('app').innerHTML = `
        <div class="container section-padding">
            <button onclick="window.history.back()" style="display:inline-block; margin-bottom:20px; font-weight:600; cursor:pointer; font-size:1.1rem; color:var(--text);"><i class="fas fa-arrow-left"></i> Back</button>
            <div class="pd-layout">
                <div class="slider-wrapper">
                    <div class="hero-track" id="pTrack">${slides}</div>
                    ${images.length > 1 ? '<div style="position:absolute; top:50%; width:100%; display:flex; justify-content:space-between; padding:0 10px; transform:translateY(-50%); z-index:10;"><i class="fas fa-chevron-circle-left" onclick="movePSlide(-1)" style="color:white; font-size:2rem; cursor:pointer;"></i><i class="fas fa-chevron-circle-right" onclick="movePSlide(1)" style="color:white; font-size:2rem; cursor:pointer;"></i></div>' : ''}
                </div>
                <div>
                    <small class="p-cat">${catLabel}</small>
                    <h1 style="margin:5px 0 10px;">${p.name}</h1>
                    <button class="btn-share" onclick="shareProduct('${p.id}')">
                        <i class="fas fa-share-alt"></i> Share
                    </button>
                    <div class="rating-stars" style="margin-top:10px;"><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i><i class="fas fa-star"></i></div>
                    <h2 style="color:var(--primary);" id="disp-price">${priceDisplay}</h2>
                    <p style="margin:20px 0; line-height:1.6; color:#555;">${p.desc || 'No description available.'}</p>
                    ${variants.length ? `<label style="font-weight:700;">Select Option:</label><select id="varSelect" class="variant-select" onchange="updateDetailPrice('${p.id}')">${variantOpts}</select>` : ''}
                    <div style="margin-bottom:25px;">
                        <label style="font-weight:700; display:block; margin-bottom:5px;">Quantity:</label>
                        <div class="qty-control"><button class="qty-btn" onclick="updateQty(-1)">-</button><div class="qty-val" id="qtyDisplay">1</div><button class="qty-btn" onclick="updateQty(1)">+</button></div>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        <button onclick="addToCartDetail('${p.id}')" class="btn" style="background:white; color:var(--primary); border:2px solid var(--primary); padding:15px; border-radius:5px; font-weight:bold;">ADD TO CART</button>
                        <button onclick="buyNowDetail('${p.id}')" class="btn" style="background:var(--primary); color:white; padding:15px; border-radius:5px; font-weight:bold;">BUY NOW</button>
                    </div>
                </div>
            </div>
        </div>`;
    window.productSlideIndex = 0;
}

window.shareProduct = function(id) {
    const url = window.location.origin + '/#product:' + id;
    if (navigator.share) {
        navigator.share({ title: 'Gul Bazar Watch', url: url }).catch(console.error);
    } else {
        navigator.clipboard.writeText(url).then(() => { showToast("Link Copied to Clipboard!"); });
    }
}

window.productCard = function(p) {
    const variants = p.variants ? (Array.isArray(p.variants) ? p.variants : Object.values(p.variants)) : [];
    const price = variants.length > 0 ? variants[0].price : (p.price || 0);
    const img = (p.img && p.img.length > 0) ? (Array.isArray(p.img) ? p.img[0] : p.img) : 'https://via.placeholder.com/300?text=Item';
    const catObj = state.categories.find(c => c.name === p.cat);
    const label = catObj ? catObj.id : (p.cat || 'Item');

    return `
        <div class="product-card" onclick="router('product', '${p.id}')">
            <div class="p-img-box"><img src="${img}"></div>
            <div class="p-details">
                <div class="p-cat">${label}</div>
                <div class="p-title">${p.name}</div>
                <div class="p-price">PKR ${price}</div>
                <div class="btn-row">
                    <button class="btn-card btn-cart" onclick="event.stopPropagation(); addToCart('${p.id}', 0, 1)"><i class="fas fa-shopping-cart"></i> ADD</button>
                    <button class="btn-card btn-buy" onclick="event.stopPropagation(); buyNowQuick('${p.id}')">BUY NOW</button>
                </div>
            </div>
        </div>`;
}

window.addToCart = function(id, variantIdx, qty) {
    const p = state.products.find(x => x.id == id);
    if(!p) return;
    const variants = p.variants ? (Array.isArray(p.variants) ? p.variants : Object.values(p.variants)) : [];
    let variant = { label: 'Standard', price: p.price || 0 };
    if(variants.length > 0 && variants[variantIdx]) variant = variants[variantIdx];
    const pImg = (p.img && p.img.length > 0) ? (Array.isArray(p.img) ? p.img[0] : p.img) : 'https://via.placeholder.com/300';

    const existing = state.cart.find(item => item.id == id && item.variantIdx == variantIdx);
    if(existing) existing.qty += qty;
    else state.cart.push({ id: p.id, name: p.name, img: pImg, variantIdx, variantName: variant.label, price: variant.price, qty });
    
    saveCart();
    showToast("Added to Cart");
}

window.addToCartDetail = function(id) {
    const el = document.getElementById('varSelect');
    addToCart(id, el ? parseInt(el.value) : 0, parseInt(document.getElementById('qtyDisplay').innerText));
}

window.updateCartQty = function(index, delta) {
    state.cart[index].qty += delta;
    if(state.cart[index].qty < 1) state.cart.splice(index, 1);
    saveCart();
    openCartModal();
}

function saveCart() { 
    localStorage.setItem('gulbazar_cart', JSON.stringify(state.cart)); 
    updateCartUI(); 
}

function updateCartUI() {
    const count = state.cart.reduce((acc, item) => acc + item.qty, 0);
    document.getElementById('cart-count').innerText = count;
    document.getElementById('cart-count').style.display = count === 0 ? 'none' : 'flex';
}

window.openCartModal = function() {
    if(state.cart.length === 0) return showToast("Cart is empty");
    document.getElementById('modal-product-select-container').innerHTML = '';
    let total = 0, html = '';
    state.cart.forEach((item, index) => {
        total += item.price * item.qty;
        html += `
            <div class="cart-item-row">
                <img src="${item.img}" class="cart-img">
                <div class="cart-info">
                    <h4>${item.name} <small>(${item.variantName})</small></h4>
                    <div class="cart-actions">
                        <div>PKR ${item.price} x ${item.qty}</div>
                        <div class="qty-control" style="transform:scale(0.8); transform-origin:left;">
                            <button class="qty-btn" onclick="updateCartQty(${index}, -1)">-</button><div class="qty-val">${item.qty}</div><button class="qty-btn" onclick="updateCartQty(${index}, 1)">+</button>
                        </div>
                    </div>
                </div>
            </div>`;
    });
    document.getElementById('modal-summary').innerHTML = html;
    document.getElementById('modal-total').innerText = `Total: PKR ${total}`;
    window.isDirectBuy = false;
    renderPaymentMethods();
    document.getElementById('orderModal').classList.add('open');
}

window.buyNowQuick = function(id) { 
    document.getElementById('modal-product-select-container').innerHTML = '';
    prepareDirectOrder(state.products.find(x => x.id == id), 0, 1); 
}

window.buyNowDetail = function(id) { 
    document.getElementById('modal-product-select-container').innerHTML = '';
    const p = state.products.find(x => x.id == id);
    const el = document.getElementById('varSelect');
    prepareDirectOrder(p, el ? el.value : 0, parseInt(document.getElementById('qtyDisplay').innerText));
}

window.buyNowCategory = function(catName) {
    const products = state.products.filter(p => p.cat == catName);
    if(products.length === 0) return showToast("No items available.");
    window.tempCategoryProducts = products;
    let options = products.map(p => {
        const v = p.variants ? (Array.isArray(p.variants) ? p.variants : Object.values(p.variants)) : [];
        const price = v.length > 0 ? v[0].price : (p.price || 0);
        return `<option value="${p.id}">${p.name} - PKR ${price}</option>`;
    }).join('');
    const selectHTML = `<label style="font-size:0.8rem; font-weight:700; color:#555;">Select Watch:</label><select id="modal-cat-product-select" class="variant-select" style="margin-top:5px;" onchange="updateModalFromDropdown(this.value)">${options}</select>`;
    document.getElementById('modal-product-select-container').innerHTML = selectHTML;
    prepareDirectOrder(products[0], 0, 1);
}

window.updateModalFromDropdown = function(pId) {
    const p = window.tempCategoryProducts.find(x => x.id == pId);
    if(p) prepareDirectOrder(p, 0, 1);
}

function prepareDirectOrder(p, vIdx, qty) {
    const variants = p.variants ? (Array.isArray(p.variants) ? p.variants : Object.values(p.variants)) : [];
    let variant = { label: 'Standard', price: p.price || 0 };
    if(variants.length > 0) variant = variants[vIdx];
    const pImg = (p.img && p.img.length > 0) ? (Array.isArray(p.img) ? p.img[0] : p.img) : 'https://via.placeholder.com/300';

    window.directOrderData = { id: p.id, name: p.name, img: pImg, variantName: variant.label, price: variant.price, qty, total: variant.price * qty };
    document.getElementById('modal-summary').innerHTML = `
        <div class="flex-between" style="padding:10px 0; border-bottom:1px solid #eee;">
            <div style="display:flex; gap:10px; align-items:center;">
                 <img src="${pImg}" style="width:40px; height:40px; border-radius:4px;">
                 <div><span style="font-weight:600;">${p.name}</span><br><small>${variant.label}</small></div>
            </div>
            <div style="text-align:right;">
                <div class="qty-control" style="transform:scale(0.9);">
                    <button class="qty-btn" type="button" onclick="updateDirectOrderQty(-1)">-</button>
                    <div class="qty-val" id="modal-direct-qty">${qty}</div>
                    <button class="qty-btn" type="button" onclick="updateDirectOrderQty(1)">+</button>
                </div>
            </div>
        </div>
        <div style="text-align:right; font-size:0.8rem; color:#666; margin-top:5px;">Price Unit: PKR ${variant.price}</div>
        `;
    document.getElementById('modal-total').innerText = `Total: PKR ${window.directOrderData.total}`;
    window.isDirectBuy = true;
    renderPaymentMethods();
    document.getElementById('orderModal').classList.add('open');
}

window.updateDirectOrderQty = function(delta) {
    let qtyElem = document.getElementById('modal-direct-qty');
    if(!qtyElem) return;
    let currentQty = parseInt(qtyElem.innerText);
    let newQty = currentQty + delta;
    if(newQty < 1) return;
    qtyElem.innerText = newQty;
    if(window.directOrderData) {
        window.directOrderData.qty = newQty;
        window.directOrderData.total = window.directOrderData.price * newQty;
        document.getElementById('modal-total').innerText = `Total: PKR ${window.directOrderData.total}`;
    }
}

function renderPaymentMethods() {
    const container = document.getElementById('payment-methods-container');
    container.innerHTML = '';
    const methods = state.settings.payment_methods || {};
    let hasChecked = false;
    const addRadio = function(id, label, icon) {
        const checked = !hasChecked ? 'checked' : '';
        if(!hasChecked) hasChecked = true;
        container.innerHTML += `<input type="radio" name="paymethod" id="pay_${id}" value="${id}" class="payment-radio" ${checked} onchange="togglePaymentInfo()"><label for="pay_${id}" class="payment-label"><i class="${icon}" style="font-size:1.2rem;"></i><span>${label}</span></label>`;
    };
    if(methods.cod) addRadio('cod', 'COD', 'fas fa-truck');
    if(methods.easypaisa) addRadio('easypaisa', 'EasyPaisa', 'fas fa-mobile-alt');
    if(methods.jazzcash) addRadio('jazzcash', 'JazzCash', 'fas fa-money-bill-wave');
    if(container.innerHTML === '') container.innerHTML = '<small>No payment methods active.</small>';
    else togglePaymentInfo();

    document.getElementById('cust-name').value = '';
    document.getElementById('cust-phone').value = '';
    document.getElementById('cust-phone-2').value = '';
    document.getElementById('cust-city').value = ''; 
    document.getElementById('cust-address').value = '';
    document.getElementById('cust-landmark').value = '';
    document.getElementById('pay-trx').value = '';
    document.getElementById('pay-screenshot').value = '';
}

window.togglePaymentInfo = function() {
    const selected = document.querySelector('input[name="paymethod"]:checked');
    if(!selected) return;
    const method = selected.value;
    const detailBox = document.getElementById('payment-details-display');
    const trxArea = document.getElementById('trx-input-area');
    const trxInput = document.getElementById('pay-trx');
    detailBox.classList.add('hidden');
    trxArea.classList.add('hidden');
    trxInput.removeAttribute('required');

    if (method === 'easypaisa' || method === 'jazzcash') {
        const acc = state.settings.accounts ? state.settings.accounts[method] : { title: 'Not Set', number: '0000' };
        detailBox.innerHTML = `<div style="font-weight:bold; color:var(--${method}); text-transform:uppercase; margin-bottom:5px;">${method} Details</div><div style="font-size:0.9rem;">Account Title: <b>${acc.title}</b></div><div style="font-size:1.1rem; font-weight:bold; margin:5px 0; display:flex; justify-content:center; align-items:center;">${acc.number} <button type="button" class="copy-btn" onclick="copyToClipboard('${acc.number}')"><i class="fas fa-copy"></i> Copy</button></div><small style="color:#666;">Send amount and attach screenshot below.</small>`;
        detailBox.classList.remove('hidden');
        trxArea.classList.remove('hidden');
        trxInput.setAttribute('required', 'true');
    }
}

window.copyToClipboard = function(text) { 
    navigator.clipboard.writeText(text).then(() => { 
        showToast("Account Number Copied!"); 
    }); 
}

window.submitOrder = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-order');
    const originalBtnText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
    btn.disabled = true;

    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value;
    const phone2 = document.getElementById('cust-phone-2').value || "N/A";
    const city = document.getElementById('cust-city').value; 
    const address = document.getElementById('cust-address').value;
    const landmark = document.getElementById('cust-landmark').value;
    const payMethodElem = document.querySelector('input[name="paymethod"]:checked');
    
    if(!payMethodElem) { 
        alert("Select Payment Method"); 
        btn.disabled=false; 
        btn.innerHTML=originalBtnText; 
        return; 
    }
    const payMethod = payMethodElem.value;
    const fileInput = document.getElementById('pay-screenshot');
    let imgUrl = "";

    if ((payMethod === 'easypaisa' || payMethod === 'jazzcash') && fileInput.files.length > 0) {
        try {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMG_BB_API_KEY}`, { method: 'POST', body: formData });
            const data = await res.json();
            if(data.success) imgUrl = data.data.url;
        } catch(err) { console.error("Img Upload Err", err); }
    }

    let orderItems = window.isDirectBuy ? [window.directOrderData] : state.cart;
    let grandTotal = window.isDirectBuy ? window.directOrderData.total : state.cart.reduce((acc, i) => acc + (i.price * i.qty), 0);
    const orderId = Date.now();

    const orderData = {
        orderId, 
        deviceId: state.deviceId,
        customer: { name, phone, phone2, city, address, landmark },
        payment: { method: payMethod, trxId: document.getElementById('pay-trx').value || '', screenshot: imgUrl },
        items: orderItems, 
        total: grandTotal, 
        date: new Date().toISOString(), 
        status: 'pending'
    };

    set(ref(db, 'orders/' + orderId), orderData)
    .then(() => {
        let localOrders = JSON.parse(localStorage.getItem('gulbazar_local_orders')) || [];
        localOrders.unshift(orderData);
        localStorage.setItem('gulbazar_local_orders', JSON.stringify(localOrders));
        if(!window.isDirectBuy) { state.cart = []; saveCart(); }

        let itemsList = orderItems.map(i => `• ${i.name} (${i.variantName}) x${i.qty} - ${i.price*i.qty}`).join('%0A');
        let msg = `*NEW GUL BAZAR ORDER (${orderId})*%0A------------------%0A${itemsList}%0A------------------%0A*Total: PKR ${grandTotal}*%0A*Payment:* ${payMethod.toUpperCase()}`;
        if(orderData.payment.trxId) msg += `%0A*Trx ID:* ${orderData.payment.trxId}`;
        if(imgUrl) msg += `%0A*Screenshot:* ${imgUrl}`;
        msg += `%0A%0A*Customer:*%0AName: ${name}%0APhone: ${phone}`;
        if(phone2 !== "N/A") msg += `%0AAlt Phone: ${phone2}`;
        msg += `%0ACity: ${city}%0AAddress: ${address}%0ALandmark: ${landmark}`;

        window.open(`https://wa.me/${state.settings.phone}?text=${msg}`, '_blank');
        closeOrderModal();
        showToast("Order Placed Successfully!");
    })
    .catch((err) => { 
        alert("Error placing order."); 
        console.error(err); 
    })
    .finally(() => { 
        btn.innerHTML = originalBtnText; 
        btn.disabled = false; 
    });
}

function renderHistoryPage() {
    document.getElementById('app').innerHTML = `<div class="container section-padding"><div class="flex-between" style="margin-bottom:20px;"><h3 style="border-left:4px solid var(--primary); padding-left:10px;">My Orders</h3><button onclick="router('home')" style="font-size:0.9rem; font-weight:bold; color:var(--primary);"><i class="fas fa-arrow-left"></i> Home</button></div><div id="history-page-content"><p class="text-center" style="padding:40px;">Loading your order history...</p></div></div>`;
    const content = document.getElementById('history-page-content');
    const localOrders = JSON.parse(localStorage.getItem('gulbazar_local_orders')) || [];
    if(localOrders.length > 0) content.innerHTML = generateHistoryHTML(localOrders);
    const ordersRef = query(ref(db, 'orders'), orderByChild('deviceId'), equalTo(state.deviceId));
    get(ordersRef).then((snapshot) => {
        let orders = [];
        if(snapshot.exists()) snapshot.forEach(c => orders.unshift(c.val()));
        if(orders.length > 0) { content.innerHTML = generateHistoryHTML(orders); } 
        else if (localOrders.length === 0) { content.innerHTML = `<div class="text-center" style="padding:50px; color:#999;"><i class="fas fa-receipt" style="font-size:3rem; margin-bottom:15px;"></i><p>No orders found.</p><button onclick="router('shop')" class="btn" style="margin-top:10px; background:var(--primary); color:white; padding:10px 20px; border-radius:5px;">Start Shopping</button></div>`; }
    });
}

function generateHistoryHTML(orders) {
    return orders.map(o => `
        <div class="history-card">
            <div class="history-header"><div><strong>Order #${o.orderId.toString().slice(-6)}</strong><div style="font-size:0.85rem; color:#777; margin-top:2px;">${new Date(o.date).toLocaleDateString()} &bull; ${new Date(o.date).toLocaleTimeString()}</div></div><span style="font-size:0.8rem; background:${o.status==='pending'?'#fff3cd':'#d1e7dd'}; color:${o.status==='pending'?'#856404':'#0f5132'}; padding:5px 10px; border-radius:15px; text-transform:uppercase; font-weight:bold;">${o.status}</span></div>
            ${o.items.map(i => `<div class="history-item"><img src="${i.img || 'https://via.placeholder.com/50'}" class="history-item-img"><div style="flex:1;"><div style="font-size:0.95rem; font-weight:600;">${i.name}</div><div style="font-size:0.85rem; color:#666;">Variant: ${i.variantName} <span style="margin:0 5px;">|</span> Qty: ${i.qty}</div></div><div style="font-weight:600;">PKR ${i.price * i.qty}</div></div>`).join('')}
            <div class="flex-between" style="margin-top:15px; border-top:1px solid #f0f0f0; padding-top:15px;"><span style="font-size:0.9rem; color:#666;">Payment: <b>${o.payment.method.toUpperCase()}</b></span><span style="font-weight:bold; color:var(--primary); font-size:1.1rem;">Total: PKR ${o.total}</span></div>
        </div>`).join('');
}

window.toggleMenu = function() { document.getElementById('sidebar').classList.toggle('active'); document.getElementById('overlay').style.display = document.getElementById('sidebar').classList.contains('active') ? 'block' : 'none'; }
window.closeOrderModal = function() { document.getElementById('orderModal').classList.remove('open'); }
window.showToast = function(msg) { const t = document.getElementById("toast"); t.innerText = msg; t.className = "show"; setTimeout(() => t.className = "", 3000); }
window.movePSlide = function(dir) { const track = document.getElementById('pTrack'); window.productSlideIndex = (window.productSlideIndex + dir + track.children.length) % track.children.length; track.style.transform = `translateX(-${window.productSlideIndex * 100}%)`; }
window.updateDetailPrice = function(id) { const p = state.products.find(x => x.id == id); const idx = document.getElementById('varSelect').value; const v = p.variants.length ? (Array.isArray(p.variants)?p.variants:Object.values(p.variants)) : []; if(v[idx]) document.getElementById('disp-price').innerText = `PKR ${v[idx].price}`; }
window.updateQty = function(n) { const el = document.getElementById('qtyDisplay'); let val = parseInt(el.innerText) + n; if(val > 0) el.innerText = val; }

let heroInterval, heroIndex = 0;
function startHeroAnimation() {
    if(heroInterval) clearInterval(heroInterval);
    const track = document.querySelector('.hero-track');
    if(!track) return;
    heroIndex = 0;
    heroInterval = setInterval(() => {
        const slides = document.querySelectorAll('.hero-slide');
        if(!slides.length) return;
        heroIndex = (heroIndex + 1) % slides.length;
        track.style.transform = `translateX(-${heroIndex * 100}%)`;
    }, 4000);
}

initApp();