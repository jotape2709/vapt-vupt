// ═══════════════════════════════
// Vapt Vupt — app.js
// Modular JavaScript with bug fixes and security improvements
// ═══════════════════════════════

'use strict';

// ═══════════════════════════════
// SECURITY: HTML sanitizer
// ═══════════════════════════════
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, function(m) { return map[m]; });
}

// ═══════════════════════════════
// DATA STORE
// ═══════════════════════════════
const appState = {
  currentUser: null,
  userType: 'estabelecimento',
  onboardingData: {},
  cart: [],
  obStep: 1
};

// ═══════════════════════════════
// CATALOG DATA
// ═══════════════════════════════
const catalog = [
  // Farmácia
  {id:1,name:'Dipirona 500mg cx30',cat:'farmacia',icon:'💊',unit:'cx',brand:'Genérico'},
  {id:2,name:'Paracetamol 750mg cx20',cat:'farmacia',icon:'💊',unit:'cx',brand:'EMS'},
  {id:3,name:'Omeprazol 20mg cx30',cat:'farmacia',icon:'💊',unit:'cx',brand:'Genérico'},
  {id:4,name:'Ibuprofeno 600mg cx20',cat:'farmacia',icon:'💊',unit:'cx',brand:'Prati'},
  {id:5,name:'Shampoo anticaspa 400ml',cat:'farmacia',icon:'🧴',unit:'un',brand:'Head&Shoulders'},
  {id:6,name:'Protetor solar FPS 50 200ml',cat:'farmacia',icon:'🌞',unit:'un',brand:'Nivea'},
  {id:7,name:'Álcool gel 70% 500ml',cat:'farmacia',icon:'💧',unit:'un',brand:'Vitalitá'},
  {id:8,name:'Curativo band-aid cx100',cat:'farmacia',icon:'🩹',unit:'cx',brand:'Band-Aid'},
  {id:9,name:'Termômetro digital',cat:'farmacia',icon:'🌡️',unit:'un',brand:'G-Tech'},
  {id:10,name:'Vitamina C 1g eferv cx10',cat:'farmacia',icon:'💊',unit:'cx',brand:'Vitamino'},
  // Bebidas
  {id:11,name:'Cerveja Heineken long neck 330ml',cat:'bebidas',icon:'🍺',unit:'cx24',brand:'Heineken'},
  {id:12,name:'Cerveja Brahma lata 350ml',cat:'bebidas',icon:'🍺',unit:'cx12',brand:'Brahma'},
  {id:13,name:'Cerveja Budweiser long neck 330ml',cat:'bebidas',icon:'🍺',unit:'cx24',brand:'Budweiser'},
  {id:14,name:'Vodka Absolut 1L',cat:'bebidas',icon:'🍸',unit:'un',brand:'Absolut'},
  {id:15,name:'Whisky Jack Daniel\'s 1L',cat:'bebidas',icon:'🥃',unit:'un',brand:'Jack Daniel\'s'},
  {id:16,name:'Vinho tinto seco Miolo 750ml',cat:'bebidas',icon:'🍷',unit:'un',brand:'Miolo'},
  {id:17,name:'Energético Red Bull 250ml',cat:'bebidas',icon:'⚡',unit:'cx24',brand:'Red Bull'},
  {id:18,name:'Refrigerante Coca-Cola 2L',cat:'bebidas',icon:'🥤',unit:'cx6',brand:'Coca-Cola'},
  {id:19,name:'Água mineral s/ gás 500ml',cat:'bebidas',icon:'💧',unit:'cx24',brand:'Crystal'},
  {id:20,name:'Suco de laranja 1L',cat:'bebidas',icon:'🍊',unit:'cx12',brand:'Del Valle'},
  // Alimentos
  {id:21,name:'Arroz branco 5kg',cat:'alimentos',icon:'🍚',unit:'sc',brand:'Tio João'},
  {id:22,name:'Feijão preto 1kg',cat:'alimentos',icon:'🫘',unit:'kg',brand:'Camil'},
  {id:23,name:'Macarrão espaguete 500g',cat:'alimentos',icon:'🍝',unit:'pct',brand:'Barilla'},
  {id:24,name:'Azeite extra virgem 500ml',cat:'alimentos',icon:'🫙',unit:'un',brand:'Gallo'},
  {id:25,name:'Sal refinado 1kg',cat:'alimentos',icon:'🧂',unit:'kg',brand:'Cisne'},
  {id:26,name:'Açúcar cristal 5kg',cat:'alimentos',icon:'🍬',unit:'sc',brand:'União'},
  {id:27,name:'Farinha de trigo 5kg',cat:'alimentos',icon:'🌾',unit:'sc',brand:'Dona Benta'},
  {id:28,name:'Óleo de soja 900ml',cat:'alimentos',icon:'🫙',unit:'cx12',brand:'Liza'},
  // Limpeza
  {id:29,name:'Detergente líquido 500ml',cat:'limpeza',icon:'🧽',unit:'cx24',brand:'Ypê'},
  {id:30,name:'Desinfetante 1L',cat:'limpeza',icon:'🧴',unit:'cx12',brand:'Pinho Sol'},
  {id:31,name:'Água sanitária 1L',cat:'limpeza',icon:'💧',unit:'cx12',brand:'Qboa'},
  {id:32,name:'Sabão em pó 1kg',cat:'limpeza',icon:'📦',unit:'un',brand:'Omo'},
  {id:33,name:'Esponja de limpeza cx10',cat:'limpeza',icon:'🧽',unit:'cx',brand:'Scotch-Brite'},
  {id:34,name:'Multiuso spray 500ml',cat:'limpeza',icon:'🧴',unit:'un',brand:'Mr Músculo'},
  // Descartáveis
  {id:35,name:'Copo descartável 200ml cx50',cat:'descartaveis',icon:'🥤',unit:'cx',brand:'Copobrás'},
  {id:36,name:'Prato descartável cx10',cat:'descartaveis',icon:'🍽',unit:'cx',brand:'Descartex'},
  {id:37,name:'Talheres descartáveis kit50',cat:'descartaveis',icon:'🍴',unit:'kit',brand:'Descartex'},
  {id:38,name:'Embalagem para marmita G cx50',cat:'descartaveis',icon:'📦',unit:'cx',brand:'Nita'},
  {id:39,name:'Luva descartável cx100',cat:'descartaveis',icon:'🧤',unit:'cx',brand:'Supermax'},
  {id:40,name:'Sacola plástica 40x50 cx500',cat:'descartaveis',icon:'🛍',unit:'cx',brand:'Vitória'},
];

// Critical items for dashboard
const criticalItems = [
  {name:'Cerveja Heineken cx24',cat:'bebidas',icon:'🍺',estoque:2,minimo:10,unit:'cx',urgencia:'urgent'},
  {name:'Dipirona 500mg cx30',cat:'farmacia',icon:'💊',estoque:3,minimo:15,unit:'cx',urgencia:'urgent'},
  {name:'Detergente Ypê cx24',cat:'limpeza',icon:'🧽',estoque:1,minimo:8,unit:'cx',urgencia:'urgent'},
  {name:'Água sanitária Qboa',cat:'limpeza',icon:'💧',estoque:4,minimo:12,unit:'cx',urgencia:'urgent'},
  {name:'Energético Red Bull',cat:'bebidas',icon:'⚡',estoque:5,minimo:12,unit:'cx',urgencia:'urgent'},
  {name:'Refrigerante Coca-Cola 2L',cat:'bebidas',icon:'🥤',estoque:6,minimo:18,unit:'cx',urgencia:'warning'},
  {name:'Álcool gel 70%',cat:'farmacia',icon:'💧',estoque:8,minimo:20,unit:'un',urgencia:'warning'},
];

const atencaoItems = [
  {name:'Vodka Absolut 1L',cat:'bebidas',icon:'🍸',estoque:4,minimo:8,unit:'un',urgencia:'warning'},
  {name:'Macarrão espaguete',cat:'alimentos',icon:'🍝',estoque:6,minimo:10,unit:'pct',urgencia:'warning'},
  {name:'Sabão em pó Omo 1kg',cat:'limpeza',icon:'📦',estoque:3,minimo:6,unit:'un',urgencia:'warning'},
  {name:'Copo descartável 200ml',cat:'descartaveis',icon:'🥤',estoque:8,minimo:15,unit:'cx',urgencia:'warning'},
];

// Promotions
const promotions = [
  {id:1,name:'Cerveja Heineken cx24',supplier:'Distribuidora Norte SP',oldPrice:89.9,newPrice:72.5,discount:19,category:'bebidas',tag:'critico',timer:7200,recommended:true},
  {id:2,name:'Kit Limpeza Ypê (deterg+desinf+agua sant)',supplier:'Atacado Pronto',oldPrice:45.0,newPrice:34.9,discount:22,category:'limpeza',tag:'flash',timer:3600,recommended:false},
  {id:3,name:'Álcool Gel 70% 500ml cx12',supplier:'Distribuidora Saúde Total',oldPrice:96.0,newPrice:79.0,discount:18,category:'farmacia',tag:'critico',timer:14400,recommended:true},
  {id:4,name:'Red Bull 250ml cx24',supplier:'Bebidas Leste Ltda',oldPrice:165.0,newPrice:139.0,discount:16,category:'bebidas',tag:'flash',timer:5400,recommended:false},
  {id:5,name:'Dipirona Genérica cx30 — lot50',supplier:'Farma Atacado Central',oldPrice:180.0,newPrice:142.0,discount:21,category:'farmacia',tag:'critico',timer:21600,recommended:true},
];

// Quotes — start empty; populated when user creates quotes
var userQuotes = { ativas: [], recebidas: [], finalizadas: [] };
var quoteCounter = 2860;

// Supplier pool — available suppliers for matching
var supplierPool = [
  {name:'Distribuidora Norte SP', cats:['bebidas','limpeza','alimentos'], rating:'4.7 ★', available:true},
  {name:'Atacado Pronto', cats:['limpeza','alimentos','descartaveis'], rating:'4.5 ★', available:true},
  {name:'Distribuidora Saúde Total', cats:['farmacia','limpeza'], rating:'4.6 ★', available:true},
  {name:'Bebidas Leste Ltda', cats:['bebidas'], rating:'4.8 ★', available:true},
  {name:'Farma Atacado Central', cats:['farmacia'], rating:'4.8 ★', available:true},
  {name:'Descartáveis Plus', cats:['descartaveis','alimentos'], rating:'4.3 ★', available:true},
  {name:'MedBem Atacado SP', cats:['farmacia','limpeza'], rating:'4.9 ★', available:false},
];

function getMatchedSuppliers(items) {
  var cats = [];
  items.forEach(function(item) {
    var cat = item.cat || item.category || 'outros';
    if (cats.indexOf(cat) === -1) cats.push(cat);
  });
  var matched = [];
  supplierPool.forEach(function(s) {
    if (s.cats.some(function(c) { return cats.indexOf(c) !== -1; })) matched.push(s);
  });
  return matched.slice(0, 5);
}

// ═══════════════════════════════
// NAVIGATION
// ═══════════════════════════════
function showPage(id) {
  document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
  var el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

// FIX: Renamed from scrollTo to scrollToSection to avoid conflict with window.scrollTo
function scrollToSection(id) {
  var el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showDashPanel(panelId, clickedItem) {
  document.querySelectorAll('.dash-panel').forEach(function(p) { p.classList.remove('active'); });
  var panel = document.getElementById('panel-' + panelId);
  if (panel) panel.classList.add('active');
  if (clickedItem) {
    document.querySelectorAll('.sidebar-item').forEach(function(i) { i.classList.remove('active'); });
    clickedItem.classList.add('active');
  }
  var mainContent = document.querySelector('.main-content');
  if (mainContent) mainContent.scrollTo(0, 0);
}

function goToDashboard() {
  showPage('page-dashboard');
  initDashboard();
}

async function hashPassword(password) {
  var encoder = new TextEncoder();
  var data = encoder.encode(password);
  var hashBuffer = await crypto.subtle.digest('SHA-256', data);
  var hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
}

async function doLogin() {
  var email = document.getElementById('login-email').value.trim();
  var pass = document.getElementById('login-pass').value;
  if (!email || !pass) { showToast('Preencha e-mail e senha', 'error'); return; }
  if (!isValidEmail(email)) { showToast('Formato de e-mail inválido', 'error'); return; }
  var stored = localStorage.getItem('vv_user');
  if (!stored) { showToast('Nenhuma conta encontrada. Cadastre-se primeiro.', 'error'); return; }
  var user = JSON.parse(stored);
  if (user.email !== email) { showToast('E-mail não encontrado', 'error'); return; }
  var hashed = await hashPassword(pass);
  if (user.password !== hashed) { showToast('Senha incorreta', 'error'); return; }
  appState.currentUser = { name: user.name, email: user.email, biz: user.biz || '' };
  localStorage.setItem('vv_session', JSON.stringify(appState.currentUser));
  var firstName = user.name.split(' ')[0];
  showToast('Bem-vindo de volta, ' + escapeHtml(firstName) + '!', 'success');
  showPage('page-dashboard');
  initDashboard();
}

async function doRegister() {
  var name = document.getElementById('reg-name').value.trim();
  var email = document.getElementById('reg-email').value.trim();
  var pass = document.getElementById('reg-pass').value;
  if (!name || !email || !pass) { showToast('Preencha todos os campos obrigatórios', 'error'); return; }
  if (!isValidEmail(email)) { showToast('Formato de e-mail inválido', 'error'); return; }
  if (pass.length < 8) { showToast('A senha deve ter pelo menos 8 caracteres', 'error'); return; }
  if (!/(?=.*[a-zA-Z])(?=.*[0-9])/.test(pass)) { showToast('A senha deve conter letras e números', 'error'); return; }
  var existing = localStorage.getItem('vv_user');
  if (existing) { showToast('Já existe uma conta cadastrada neste navegador. Faça login ou exclua a conta existente.', 'error'); return; }
  var hashed = await hashPassword(pass);
  var user = { name: name, email: email, password: hashed, biz: '' };
  localStorage.setItem('vv_user', JSON.stringify(user));
  appState.currentUser = { name: name, email: email, biz: '' };
  localStorage.setItem('vv_session', JSON.stringify(appState.currentUser));
  if (appState.userType === 'fornecedor') { showPage('page-fornecedor'); return; }
  showPage('page-onboarding');
  var alertEmail = document.getElementById('ob-alert-email');
  if (alertEmail) alertEmail.value = email;
}

function doLogout() {
  appState.currentUser = null;
  localStorage.removeItem('vv_session');
  showToast('Você saiu da sua conta', 'info');
  showPage('page-landing');
}

function deleteAccount() {
  if (!confirm('Tem certeza que deseja excluir sua conta? Todos os dados serão apagados permanentemente.')) return;
  localStorage.removeItem('vv_user');
  localStorage.removeItem('vv_session');
  localStorage.removeItem('vv_inventory');
  appState.currentUser = null;
  showToast('Conta excluída com sucesso.', 'info');
  showPage('page-landing');
}

function selectType(type, el) {
  appState.userType = type;
  document.querySelectorAll('.auth-type-btn').forEach(function(b) { b.classList.remove('selected'); });
  el.classList.add('selected');
}

// ═══════════════════════════════
// EMAIL VALIDATION
// ═══════════════════════════════
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ═══════════════════════════════
// ONBOARDING
// ═══════════════════════════════
var progressPct = [0, 14, 28, 42, 57, 71, 85, 100];

function obNext(to) {
  var prev = document.getElementById('ob-step-' + (to - 1));
  var next = document.getElementById('ob-step-' + to);
  var progress = document.getElementById('ob-progress');
  if (prev) prev.classList.add('hidden');
  if (next) next.classList.remove('hidden');
  if (progress) progress.style.width = progressPct[to] + '%';
  document.querySelectorAll('[id^="psl-"]').forEach(function(el, i) {
    el.classList.toggle('active', i + 1 === to);
  });
  var container = document.querySelector('.onboarding-container');
  if (container) container.scrollIntoView({ behavior: 'smooth' });
}

function obBack(to) {
  var next = document.getElementById('ob-step-' + (to + 1));
  var prev = document.getElementById('ob-step-' + to);
  var progress = document.getElementById('ob-progress');
  if (next) next.classList.add('hidden');
  if (prev) prev.classList.remove('hidden');
  if (progress) progress.style.width = progressPct[to] + '%';
}

function selectOption(el, groupId) {
  var group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.option-card').forEach(function(c) { c.classList.remove('selected'); });
  el.classList.add('selected');
}

// ═══════════════════════════════
// DASHBOARD INIT
// ═══════════════════════════════
function initDashboard() {
  var bizNameEl = document.getElementById('ob-biz-name');
  var storedUser = localStorage.getItem('vv_user');
  var bizName = '';
  if (bizNameEl && bizNameEl.value) {
    bizName = bizNameEl.value;
  } else if (storedUser) {
    var u = JSON.parse(storedUser);
    bizName = u.biz || '';
  }
  if (!bizName) bizName = 'Meu Estabelecimento';
  var userName = (appState.currentUser && appState.currentUser.name) ? appState.currentUser.name : 'Usuário';
  var firstName = userName.split(' ')[0];

  var dashName = document.getElementById('dash-name');
  var sidebarUserName = document.getElementById('sidebar-user-name');
  var sidebarUserBiz = document.getElementById('sidebar-user-biz');
  var sidebarAvatar = document.getElementById('sidebar-avatar-text');

  if (dashName) dashName.textContent = firstName;
  if (sidebarUserName) sidebarUserName.textContent = userName;
  if (sidebarUserBiz) sidebarUserBiz.textContent = bizName;
  if (sidebarAvatar) sidebarAvatar.textContent = userName.split(' ').map(function(n) { return n[0]; }).join('').slice(0, 2).toUpperCase();

  var hasInventory = localStorage.getItem('vv_inventory');
  if (hasInventory) {
    renderCriticalItems();
    renderCatalog();
    renderPromos();
    renderQuotes();
  } else {
    renderEmptyDashboard();
    renderCatalog();
    renderPromos();
    renderQuotes();
  }
}

function renderEmptyDashboard() {
  var list = document.getElementById('critical-items-list');
  if (list) {
    list.innerHTML =
      '<div class="empty-state" style="padding:3rem 1rem;text-align:center">' +
        '<span class="empty-state-icon" style="font-size:3rem;display:block;margin-bottom:1rem">📦</span>' +
        '<div class="empty-state-title" style="font-size:1.125rem;font-weight:600;color:var(--gray-900);margin-bottom:.5rem">Nenhum estoque cadastrado ainda</div>' +
        '<div class="empty-state-desc" style="font-size:.9375rem;color:var(--gray-400);margin-bottom:1.5rem;max-width:400px;margin-left:auto;margin-right:auto">' +
          'Para começar, suba sua planilha de estoque ou use nosso modelo de exemplo. O sistema vai identificar automaticamente os itens que precisam de reposição.' +
        '</div>' +
        '<div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap">' +
          '<button class="btn btn-primary btn-sm" onclick="showDashPanel(\'cotar-planilha\',null)">📊 Subir planilha de estoque</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="downloadTemplate()">📥 Baixar modelo de exemplo</button>' +
        '</div>' +
      '</div>';
  }
  // Also set KPIs to zero
  var kpiCards = document.querySelectorAll('.kpi-value');
  if (kpiCards.length >= 4) {
    kpiCards[0].textContent = '0';
    kpiCards[1].textContent = '0';
    kpiCards[2].textContent = '0';
    kpiCards[3].textContent = 'R$0';
  }
  var kpiChanges = document.querySelectorAll('.kpi-change');
  kpiChanges.forEach(function(el) { el.textContent = 'Sem dados'; el.className = 'kpi-change'; el.style.color = 'var(--gray-400)'; });

  // Update health bar
  var healthFill = document.querySelector('.health-bar-fill');
  if (healthFill) healthFill.style.width = '0%';
  var healthLabel = document.querySelector('.section-header .chip');
  if (healthLabel) { healthLabel.textContent = '📦 Sem dados'; healthLabel.className = 'chip chip-gray'; }
}

function renderCriticalItems() {
  var list = document.getElementById('critical-items-list');
  if (!list) return;
  list.innerHTML = criticalItems.map(function(item) {
    return '<div class="critical-item ' + escapeHtml(item.urgencia) + '">' +
      '<span style="font-size:1.25rem">' + item.icon + '</span>' +
      '<div style="flex:1">' +
        '<div class="critical-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div class="critical-item-info">' + escapeHtml(item.cat) + ' · ' + escapeHtml(item.unit) + '</div>' +
      '</div>' +
      '<div class="critical-item-stock">' +
        '<span class="chip ' + (item.urgencia === 'urgent' ? 'chip-red' : 'chip-orange') + '" style="font-size:.75rem">' +
          item.estoque + ' ' + escapeHtml(item.unit) + ' restando' +
        '</span>' +
        '<span style="font-size:.75rem;color:var(--gray-400)">mín: ' + item.minimo + '</span>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" style="padding:.375rem .75rem;font-size:.8125rem" onclick="addSingleItemToQuote(\'' + escapeHtml(item.name).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\')">+ Cotar</button>' +
    '</div>';
  }).join('');

  // Upload critical list
  var ul = document.getElementById('upload-critical-list');
  if (ul) ul.innerHTML = list.innerHTML;
  var al = document.getElementById('upload-atencao-list');
  if (al) al.innerHTML = atencaoItems.map(function(item) {
    return '<div class="critical-item ' + escapeHtml(item.urgencia) + '">' +
      '<span style="font-size:1.25rem">' + item.icon + '</span>' +
      '<div style="flex:1">' +
        '<div class="critical-item-name">' + escapeHtml(item.name) + '</div>' +
        '<div class="critical-item-info">' + escapeHtml(item.cat) + ' · ' + escapeHtml(item.unit) + '</div>' +
      '</div>' +
      '<div class="critical-item-stock">' +
        '<span class="chip chip-orange" style="font-size:.75rem">' + item.estoque + ' ' + escapeHtml(item.unit) + ' restando</span>' +
        '<span style="font-size:.75rem;color:var(--gray-400)">mín: ' + item.minimo + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ═══════════════════════════════
// CATALOG & CART
// ═══════════════════════════════
var activeCat = 'todos';
var searchQuery = '';

function renderCatalog() {
  var grid = document.getElementById('catalog-grid');
  if (!grid) return;
  var filtered = catalog.filter(function(p) {
    var matchCat = activeCat === 'todos' || p.cat === activeCat;
    var matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.brand.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });
  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><span class="empty-state-icon">🔍</span><div class="empty-state-title">Nenhum produto encontrado</div><div class="empty-state-desc">Tente outros termos ou mude a categoria</div></div>';
    return;
  }
  grid.innerHTML = filtered.map(function(p) {
    return '<div class="catalog-item">' +
      '<div class="catalog-item-icon">' + p.icon + '</div>' +
      '<div style="flex:1">' +
        '<div class="catalog-item-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="catalog-item-meta">' + escapeHtml(p.brand) + ' · ' + escapeHtml(p.unit) + '</div>' +
      '</div>' +
      '<button class="catalog-add-btn" onclick="addToCart(' + p.id + ')" title="Adicionar ao carrinho">+</button>' +
    '</div>';
  }).join('');
}

function filterCatalog(q) {
  searchQuery = q;
  renderCatalog();
}

function filterByCategory(cat, el) {
  activeCat = cat;
  document.querySelectorAll('#cat-filters .cat-filter').forEach(function(f) { f.classList.remove('active'); });
  el.classList.add('active');
  renderCatalog();
}

function addToCart(productId) {
  var p = catalog.find(function(x) { return x.id === productId; });
  if (!p) return;
  var existing = appState.cart.find(function(x) { return x.id === productId; });
  if (existing) { existing.qty++; showToast(escapeHtml(p.name.slice(0, 30)) + '... (+1)', 'info'); }
  else { appState.cart.push(Object.assign({}, p, { qty: 1 })); showToast(escapeHtml(p.name.slice(0, 30)) + '... adicionado', 'success'); }
  renderCart();
}

function changeQty(id, delta) {
  var item = appState.cart.find(function(x) { return x.id === id; });
  if (!item) return;
  item.qty = Math.max(1, item.qty + delta);
  renderCart();
}

function removeFromCart(id) {
  appState.cart = appState.cart.filter(function(x) { return x.id !== id; });
  renderCart();
}

function clearCart() {
  appState.cart = [];
  renderCart();
}

function renderCart() {
  var el = document.getElementById('cart-items');
  var footer = document.getElementById('cart-footer');
  var countEl = document.getElementById('cart-count');
  if (!el) return;
  if (countEl) countEl.textContent = appState.cart.length + ' ' + (appState.cart.length === 1 ? 'item' : 'itens');
  if (appState.cart.length === 0) {
    el.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><span class="empty-state-icon" style="font-size:2rem">🛒</span><div class="empty-state-title">Carrinho vazio</div><div class="empty-state-desc" style="font-size:.875rem">Busque e adicione produtos ao lado</div></div>';
    if (footer) footer.classList.add('hidden');
    return;
  }
  el.innerHTML = appState.cart.map(function(item) {
    return '<div class="cart-item">' +
      '<div style="flex:1">' +
        '<div class="catalog-item-name" style="font-size:.875rem">' + escapeHtml(item.name) + '</div>' +
        '<div class="catalog-item-meta">' + escapeHtml(item.unit) + '</div>' +
      '</div>' +
      '<div class="qty-control">' +
        '<button class="qty-btn" onclick="changeQty(' + item.id + ',-1)">−</button>' +
        '<span class="qty-num">' + item.qty + '</span>' +
        '<button class="qty-btn" onclick="changeQty(' + item.id + ',1)">+</button>' +
      '</div>' +
      '<button class="cart-remove" onclick="removeFromCart(' + item.id + ')">✕</button>' +
    '</div>';
  }).join('');
  if (footer) footer.classList.remove('hidden');
}

function gerarCotacaoManual() {
  if (appState.cart.length === 0) { showToast('Adicione itens ao carrinho primeiro', 'error'); return; }
  var quoteId = '#VV-' + (quoteCounter++);
  var matched = getMatchedSuppliers(appState.cart);
  var availableCount = matched.filter(function(s) { return s.available; }).length;
  var newQuote = {
    id: quoteId,
    date: 'Agora',
    items: appState.cart.length,
    status: 'Aguardando respostas',
    statusClass: 'chip-orange',
    detail: appState.cart.map(function(item) { return {name: item.name, qty: item.qty, unit: item.unit}; }),
    suppliers: matched
  };
  userQuotes.ativas.unshift(newQuote);
  updateQuoteTabs();
  appState.cart = [];
  renderCart();
  showToast('✅ Cotação ' + quoteId + ' gerada! ' + availableCount + ' fornecedor(es) notificado(s).', 'success');
  setTimeout(function() {
    renderQuotes();
    showDashPanel('cotacoes', document.querySelector('[onclick*="cotacoes"]'));
  }, 1500);
}

function gerarCotacaoPlanilha() {
  var quoteId = '#VV-' + (quoteCounter++);
  var items = criticalItems.map(function(i) { return {name: i.name, qty: i.minimo - i.estoque, unit: i.unit, cat: i.cat}; });
  var matched = getMatchedSuppliers(criticalItems);
  var availableCount = matched.filter(function(s) { return s.available; }).length;
  var newQuote = {
    id: quoteId,
    date: 'Agora',
    items: items.length,
    status: 'Aguardando respostas',
    statusClass: 'chip-orange',
    detail: items,
    suppliers: matched
  };
  userQuotes.ativas.unshift(newQuote);
  updateQuoteTabs();
  showToast('✅ Cotação ' + quoteId + ' gerada para ' + items.length + ' itens! ' + availableCount + ' fornecedor(es) notificado(s).', 'success');
  setTimeout(function() {
    renderQuotes();
    showDashPanel('cotacoes', null);
  }, 1500);
}

function generateAutoQuote() {
  showToast('⚡ Gerando cotação automática para os itens críticos...', 'info');
  setTimeout(function() {
    var quoteId = '#VV-' + (quoteCounter++);
    var items = criticalItems.map(function(i) { return {name: i.name, qty: i.minimo - i.estoque, unit: i.unit, cat: i.cat}; });
    var matched = getMatchedSuppliers(criticalItems);
    var availableCount = matched.filter(function(s) { return s.available; }).length;
    var newQuote = {
      id: quoteId,
      date: 'Agora',
      items: items.length,
      status: 'Aguardando respostas',
      statusClass: 'chip-orange',
      detail: items,
      suppliers: matched
    };
    userQuotes.ativas.unshift(newQuote);
    updateQuoteTabs();
    showToast('✅ Cotação ' + quoteId + ' enviada para ' + availableCount + ' fornecedores!', 'success');
    renderQuotes();
    showDashPanel('cotacoes', null);
  }, 2000);
}

function addSingleItemToQuote(name) {
  showDashPanel('cotar-manual', document.querySelectorAll('.sidebar-item')[2]);
  setTimeout(function() {
    var searchInput = document.getElementById('catalog-search');
    if (searchInput) {
      searchInput.value = name.split(' ').slice(0, 2).join(' ');
      filterCatalog(name.split(' ').slice(0, 2).join(' '));
    }
  }, 200);
}

// ═══════════════════════════════
// PROMOTIONS
// ═══════════════════════════════
var promoFilter = 'todos';
var promoTimers = {};

function filterPromos(cat, el) {
  promoFilter = cat;
  // Only update promo filter buttons inside the promos panel
  var panel = document.getElementById('panel-promocoes');
  if (panel) {
    panel.querySelectorAll('.cat-filter').forEach(function(f) { f.classList.remove('active'); });
  }
  el.classList.add('active');
  renderPromos();
}

function renderPromos() {
  var grid = document.getElementById('promo-grid');
  if (!grid) return;
  var filtered = promotions.filter(function(p) {
    if (promoFilter === 'todos') return true;
    if (promoFilter === 'urgente') return p.tag === 'flash';
    if (promoFilter === 'critico') return p.tag === 'critico';
    return p.category === promoFilter;
  });
  grid.innerHTML = filtered.map(function(p) {
    return '<div class="promo-card">' +
      '<div class="promo-header">' +
        '<div class="promo-tag">' +
          '<span class="chip ' + (p.tag === 'critico' ? 'chip-red' : 'chip-orange') + '" style="font-size:.75rem">' + (p.tag === 'critico' ? '🚨 Item crítico' : '⚡ Relâmpago') + '</span>' +
          (p.recommended ? '<span class="chip chip-blue" style="font-size:.75rem">✦ Para você</span>' : '') +
        '</div>' +
        '<div class="promo-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="promo-supplier">' + escapeHtml(p.supplier) + '</div>' +
      '</div>' +
      '<div class="promo-body">' +
        '<div class="promo-price-row">' +
          '<span class="promo-price-old">R$ ' + p.oldPrice.toFixed(2) + '</span>' +
          '<span class="promo-price-new">R$ ' + p.newPrice.toFixed(2) + '</span>' +
          '<span class="promo-discount">−' + p.discount + '%</span>' +
        '</div>' +
        '<div style="font-size:.8125rem;color:var(--gray-400)">Economia de R$ ' + (p.oldPrice - p.newPrice).toFixed(2) + ' por unidade</div>' +
      '</div>' +
      '<div class="promo-footer">' +
        '<div class="promo-timer" id="timer-' + p.id + '">⏱ Carregando...</div>' +
        '<button class="btn btn-primary btn-sm" onclick="acceptPromo(' + p.id + ')">Aproveitar</button>' +
      '</div>' +
    '</div>';
  }).join('');
  // Start timers
  filtered.forEach(function(p) { startTimer(p.id, p.timer); });
}

function startTimer(id, seconds) {
  if (promoTimers[id]) clearInterval(promoTimers[id]);
  var remaining = seconds;
  var update = function() {
    var el = document.getElementById('timer-' + id);
    if (!el) return;
    var h = Math.floor(remaining / 3600);
    var m = Math.floor((remaining % 3600) / 60);
    var s = remaining % 60;
    el.textContent = '⏱ ' + (h > 0 ? h + 'h ' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    if (remaining <= 0) { clearInterval(promoTimers[id]); el.textContent = '⏱ Expirada'; }
    remaining--;
  };
  update();
  promoTimers[id] = setInterval(update, 1000);
}

function acceptPromo(id) {
  var p = promotions.find(function(x) { return x.id === id; });
  if (p) showToast('✅ ' + escapeHtml(p.name) + ' adicionado ao carrinho de cotação!', 'success');
}

// ═══════════════════════════════
// QUOTES
// ═══════════════════════════════
function renderQuotes() {
  renderQuoteGroup('quotes-list-ativas', userQuotes.ativas);
  renderQuoteGroup('quotes-list-recebidas', userQuotes.recebidas);
  renderQuoteGroup('quotes-list-finalizadas', userQuotes.finalizadas);
  updateQuoteTabs();
}

function renderQuoteGroup(elId, list) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (list.length === 0) {
    var targetId = elId.replace('quotes-list-', '');
    var messages = {
      'ativas': 'Nenhuma cotação em andamento. Use o botão abaixo para criar uma.',
      'recebidas': 'Nenhuma oferta recebida ainda. Aguarde as respostas dos fornecedores.',
      'finalizadas': 'Nenhuma cotação finalizada ainda.'
    };
    el.innerHTML =
      '<div class="empty-state" style="padding:2.5rem 1rem">' +
        '<span class="empty-state-icon" style="font-size:2.5rem;display:block;margin-bottom:.75rem">📋</span>' +
        '<div class="empty-state-title">Sem cotações</div>' +
        '<div class="empty-state-desc">' + (messages[targetId] || 'Nenhuma cotação encontrada.') + '</div>' +
        (targetId === 'ativas' ?
          '<div style="display:flex;gap:.75rem;justify-content:center;flex-wrap:wrap;margin-top:1rem">' +
            '<button class="btn btn-primary btn-sm" onclick="showDashPanel(\'cotar-manual\',null)">+ Cotação manual</button>' +
            '<button class="btn btn-secondary btn-sm" onclick="showDashPanel(\'cotar-planilha\',null)">📊 Cotação por planilha</button>' +
          '</div>' : '') +
      '</div>';
    return;
  }
  el.innerHTML = list.map(function(q) {
    var qId = q.id.replace('#', '');
    var suppliersHtml = '';
    if ((q.status === 'Em andamento' || q.status === 'Aguardando respostas') && q.suppliers && q.suppliers.length > 0) {
      suppliersHtml =
        '<div style="margin-top:1rem;padding-top:1rem;border-top:1px solid var(--gray-100)">' +
          '<h4 style="font-size:.8125rem;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.625rem">Fornecedores notificados</h4>' +
          '<div style="display:flex;flex-wrap:wrap;gap:.5rem">' +
          q.suppliers.map(function(s) {
            return '<div style="display:flex;align-items:center;gap:.375rem;background:' + (s.available ? 'var(--blue-light)' : 'var(--gray-100)') + ';padding:.3125rem .75rem;border-radius:100px;font-size:.8125rem">' +
              '<span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:' + (s.available ? 'var(--success)' : 'var(--warning)') + ';display:inline-block"></span>' +
              '<span style="color:' + (s.available ? 'var(--gray-900)' : 'var(--gray-500)') + '">' + escapeHtml(s.name) + '</span>' +
              '<span style="color:var(--gray-400);font-size:.75rem">' + escapeHtml(s.rating) + '</span>' +
            '</div>';
          }).join('') +
          '</div>' +
        '</div>';
    }
    return '<div class="quote-card" id="qcard-' + escapeHtml(qId) + '">' +
      '<div class="quote-header" onclick="toggleQuote(\'' + escapeHtml(qId) + '\')">' +
        '<div>' +
          '<div class="quote-id">Cotação ' + escapeHtml(q.id) + '</div>' +
          '<div class="quote-meta">' + escapeHtml(q.date) + ' · ' + q.items + ' itens</div>' +
        '</div>' +
        '<div class="quote-status">' +
          '<span class="chip ' + escapeHtml(q.statusClass) + '" style="font-size:.8125rem">' + escapeHtml(q.status) + '</span>' +
          '<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="quote-body">' +
        '<h4 style="font-size:.875rem;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.75rem">Itens da cotação</h4>' +
        '<table class="quote-items-table">' +
          '<thead><tr><th>Produto</th><th>Qtd</th><th>Unidade</th></tr></thead>' +
          '<tbody>' +
            (q.detail || []).map(function(d) { return '<tr><td>' + escapeHtml(d.name) + '</td><td>' + d.qty + '</td><td>' + escapeHtml(d.unit) + '</td></tr>'; }).join('') +
          '</tbody>' +
        '</table>' +
        suppliersHtml +
        (q.hasOffers ? renderOffers(q.offers) : '') +
        (q.status === 'Finalizada' ? '<div style="color:var(--gray-400);font-size:.875rem;margin-top:1rem;text-align:center">Cotação encerrada — pedido realizado com sucesso.</div>' : '') +
        (q.status === 'Em andamento' || q.status === 'Aguardando respostas' ? '<div style="color:var(--gray-400);font-size:.875rem;margin-top:1rem;display:flex;align-items:center;gap:.5rem"><div class="loading-spinner"></div> Aguardando respostas dos fornecedores...</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

function renderOffers(offers) {
  return '<h4 style="font-size:.875rem;font-weight:600;color:var(--gray-600);text-transform:uppercase;letter-spacing:.04em;margin-top:1.5rem;margin-bottom:.75rem">Ofertas recebidas</h4>' +
    '<table class="offers-table">' +
      '<thead><tr><th>Fornecedor</th><th>Valor total</th><th>Prazo</th><th>Pagamento</th><th>Reputação</th><th></th></tr></thead>' +
      '<tbody>' +
        offers.map(function(o) {
          return '<tr ' + (o.best ? 'class="best-offer"' : '') + '>' +
            '<td style="font-weight:500">' + escapeHtml(o.supplier) + (o.best ? ' <span class="best-badge">★ Melhor oferta</span>' : '') + '</td>' +
            '<td style="font-weight:600;color:var(--blue)">' + escapeHtml(o.price) + '</td>' +
            '<td>' + escapeHtml(o.prazo) + '</td>' +
            '<td>' + escapeHtml(o.cond) + '</td>' +
            '<td>' + escapeHtml(o.rep) + '</td>' +
            '<td><button class="btn btn-' + (o.best ? 'success' : 'ghost') + ' btn-sm" onclick="chooseOffer(\'' + escapeHtml(o.supplier).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\')">' + (o.best ? 'Escolher' : 'Selecionar') + '</button></td>' +
          '</tr>';
        }).join('') +
      '</tbody>' +
    '</table>';
}

function toggleQuote(id) {
  var card = document.getElementById('qcard-' + id);
  if (card) card.classList.toggle('open');
}

function chooseOffer(supplier) {
  showToast('✅ Oferta da ' + escapeHtml(supplier) + ' confirmada! Pedido sendo processado.', 'success');
}

function updateQuoteTabs() {
  var ativasCount = userQuotes.ativas.length;
  var recebidasCount = userQuotes.recebidas.length;
  var finalizadasCount = userQuotes.finalizadas.length;
  var tabBar = document.querySelector('#panel-cotacoes .tab-bar');
  if (tabBar) {
    var tabs = tabBar.querySelectorAll('.tab');
    if (tabs[0]) tabs[0].textContent = 'Em andamento (' + ativasCount + ')';
    if (tabs[1]) tabs[1].textContent = 'Ofertas recebidas (' + recebidasCount + ')';
    if (tabs[2]) tabs[2].textContent = 'Finalizadas (' + finalizadasCount + ')';
  }
  var badge = document.querySelector('[onclick*="\'cotacoes\'"] .badge');
  if (badge) {
    var total = ativasCount + recebidasCount;
    badge.textContent = total;
    badge.style.display = total > 0 ? '' : 'none';
  }
}

// ═══════════════════════════════
// CEP AUTO-FILL (ViaCEP)
// ═══════════════════════════════
function autoFillCep(inputEl) {
  var cep = inputEl.value.replace(/\D/g, '');
  if (cep.length !== 8) return;
  var prefix = inputEl.id.replace(/-cep$/, '');
  fetch('https://viacep.com.br/ws/' + cep + '/json/')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.erro) { showToast('CEP não encontrado. Verifique e tente novamente.', 'error'); return; }
      var fieldMap = {endereco: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf};
      Object.keys(fieldMap).forEach(function(key) {
        var el = document.getElementById(prefix + '-' + key);
        if (el && fieldMap[key]) el.value = fieldMap[key];
      });
      showToast('✅ Endereço preenchido automaticamente!', 'success');
    })
    .catch(function() {
      showToast('Não foi possível buscar o CEP. Preencha manualmente.', 'error');
    });
}

// ═══════════════════════════════
// SUPPLIER REGISTRATION
// ═══════════════════════════════
function submitSupplierRegistration() {
  var razaoSocial = document.getElementById('sup-razao-social');
  var cnpj = document.getElementById('sup-cnpj');
  if (!razaoSocial || !razaoSocial.value.trim()) { showToast('Preencha a Razão Social', 'error'); return; }
  if (!cnpj || !cnpj.value.trim()) { showToast('Preencha o CNPJ', 'error'); return; }
  var form = document.getElementById('supplier-form');
  var pending = document.getElementById('supplier-pending');
  if (form) form.style.display = 'none';
  if (pending) pending.style.display = 'block';
  showToast('✅ Solicitação enviada com sucesso!', 'success');
}

// ═══════════════════════════════
// FILE UPLOAD
// ═══════════════════════════════
function handleDragOver(e) {
  e.preventDefault();
  var zone = document.getElementById('upload-zone');
  if (zone) zone.classList.add('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  var zone = document.getElementById('upload-zone');
  if (zone) zone.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files[0]) processUpload(e.dataTransfer.files[0]);
}

function handleFileUpload(input) {
  if (input.files && input.files[0]) processUpload(input.files[0]);
}

function processUpload(file) {
  if (!file) return;
  var validExt = ['.xlsx', '.csv'];
  var ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!validExt.includes(ext)) { showToast('Formato inválido. Use .xlsx ou .csv', 'error'); return; }
  if (file.size > 10 * 1024 * 1024) { showToast('Arquivo muito grande. Máximo 10MB.', 'error'); return; }
  var zone = document.getElementById('upload-zone');
  // FIX: Use textContent for file name to prevent XSS
  if (zone) {
    zone.innerHTML = '<div class="loading-spinner" style="margin:0 auto 1rem"></div><div style="font-size:.9375rem;font-weight:500;color:var(--gray-900)">Processando...</div>';
    var processingText = zone.querySelector('div:last-child');
    if (processingText) processingText.textContent = 'Processando "' + file.name + '"...';
  }
  setTimeout(function() {
    if (zone) {
      zone.innerHTML = '<span class="upload-icon">✅</span><div class="upload-title"></div><div style="font-size:.875rem;color:var(--success)">Arquivo carregado com sucesso</div>';
      var titleEl = zone.querySelector('.upload-title');
      if (titleEl) titleEl.textContent = file.name;
    }
    var result = document.getElementById('upload-result');
    if (result) result.classList.remove('hidden');
    var summary = document.getElementById('upload-summary');
    if (summary) summary.textContent = '103 itens lidos · 7 em baixo estoque · 12 em atenção';
    showToast('Planilha processada! 7 itens críticos identificados.', 'success');
    localStorage.setItem('vv_inventory', 'true');
  }, 1800);
}

// ═══════════════════════════════
// TEMPLATE DOWNLOAD
// ═══════════════════════════════
function downloadTemplate() {
  var csv = 'SKU,Produto,Categoria,Marca,Unidade,Quantidade em Estoque,Estoque Mínimo,Consumo Médio,Observações\n' +
    '001,Cerveja Heineken long neck 330ml,Bebidas,Heineken,cx24,5,10,8,Reposição urgente\n' +
    '002,Dipirona 500mg cx30,Farmácia,Genérico,cx,3,15,12,Item crítico\n' +
    '003,Detergente Ypê 500ml,Limpeza,Ypê,cx24,2,8,6,\n' +
    '004,Água Mineral 500ml,Bebidas,Crystal,cx24,8,20,16,\n' +
    '005,Álcool Gel 70% 500ml,Farmácia,Vitalitá,un,10,25,20,\n' +
    '006,[PREENCHA AQUI],,,,,,,';
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'vapt-vupt-modelo-estoque.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('📥 Modelo baixado! Preencha e suba de volta.', 'success');
}

// ═══════════════════════════════
// CONFIG SAVE
// ═══════════════════════════════
function saveConfig() {
  showToast('✅ Configurações salvas com sucesso!', 'success');
}

// ═══════════════════════════════
// FAQ
// ═══════════════════════════════
function toggleFaq(el) {
  if (el && el.parentElement) el.parentElement.classList.toggle('open');
}

// ═══════════════════════════════
// TABS
// ═══════════════════════════════
function switchTab(el, targetId) {
  var bar = el.closest('.tab-bar');
  if (bar) {
    bar.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    el.classList.add('active');
  }
  var target = document.getElementById(targetId);
  if (!target) return;
  var siblings = target.parentElement.children;
  Array.from(siblings).forEach(function(s) {
    if (s.id && s.id !== targetId && !s.classList.contains('tab-bar')) s.classList.add('hidden');
  });
  target.classList.remove('hidden');
}

// ═══════════════════════════════
// TOAST (secure)
// ═══════════════════════════════
function showToast(msg, type) {
  type = type || 'info';
  var tc = document.getElementById('toastContainer');
  if (!tc) return;
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  var span = document.createElement('span');
  span.textContent = msg; // FIX: Use textContent instead of innerHTML
  t.appendChild(span);
  var closeBtn = document.createElement('button');
  closeBtn.style.cssText = 'background:none;border:none;color:inherit;margin-left:.5rem;opacity:.6;cursor:pointer;font-size:1rem';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', function() { t.remove(); });
  t.appendChild(closeBtn);
  tc.appendChild(t);
  setTimeout(function() { t.style.animation = 'fadeOut .3s ease forwards'; }, 3500);
  setTimeout(function() { t.remove(); }, 3800);
}

// ═══════════════════════════════
// SEGMENT EXAMPLES
// ═══════════════════════════════
var segmentExamples = {
  'Farmácias': {
    icon: '💊', color: '#E8F5E9',
    items: [
      {name: 'Dipirona 500mg cx30', stock: 3, min: 15, status: 'Crítico'},
      {name: 'Paracetamol 750mg cx20', stock: 8, min: 12, status: 'Atenção'},
      {name: 'Omeprazol 20mg cx30', stock: 22, min: 10, status: 'OK'},
      {name: 'Álcool gel 70% 500ml', stock: 5, min: 20, status: 'Crítico'},
      {name: 'Protetor solar FPS 50', stock: 18, min: 8, status: 'OK'},
    ]
  },
  'Adegas': {
    icon: '🍷', color: '#F3E5F5',
    items: [
      {name: 'Vinho tinto Miolo 750ml', stock: 4, min: 12, status: 'Crítico'},
      {name: 'Cerveja Heineken cx24', stock: 2, min: 10, status: 'Crítico'},
      {name: 'Whisky Jack Daniel\'s 1L', stock: 6, min: 4, status: 'OK'},
      {name: 'Vodka Absolut 1L', stock: 3, min: 6, status: 'Atenção'},
      {name: 'Espumante Chandon 750ml', stock: 8, min: 5, status: 'OK'},
    ]
  },
  'Bares': {
    icon: '🍺', color: '#FFF3E0',
    items: [
      {name: 'Cerveja Brahma lata 350ml', stock: 5, min: 24, status: 'Crítico'},
      {name: 'Energético Red Bull 250ml', stock: 3, min: 12, status: 'Crítico'},
      {name: 'Gelo 5kg', stock: 10, min: 20, status: 'Atenção'},
      {name: 'Limão tahiti (kg)', stock: 2, min: 8, status: 'Crítico'},
      {name: 'Refrigerante Coca-Cola 2L', stock: 12, min: 18, status: 'Atenção'},
    ]
  },
  'Restaurantes': {
    icon: '🍽️', color: '#E3F2FD',
    items: [
      {name: 'Arroz branco 5kg', stock: 3, min: 10, status: 'Crítico'},
      {name: 'Feijão preto 1kg', stock: 8, min: 15, status: 'Atenção'},
      {name: 'Azeite extra virgem 500ml', stock: 2, min: 6, status: 'Crítico'},
      {name: 'Macarrão espaguete 500g', stock: 20, min: 10, status: 'OK'},
      {name: 'Óleo de soja 900ml', stock: 4, min: 8, status: 'Atenção'},
    ]
  },
  'Mercados': {
    icon: '🛒', color: '#E8EAF6',
    items: [
      {name: 'Açúcar cristal 5kg', stock: 6, min: 20, status: 'Crítico'},
      {name: 'Farinha de trigo 5kg', stock: 4, min: 15, status: 'Crítico'},
      {name: 'Sal refinado 1kg', stock: 30, min: 10, status: 'OK'},
      {name: 'Leite UHT 1L', stock: 12, min: 30, status: 'Atenção'},
      {name: 'Café torrado 500g', stock: 8, min: 12, status: 'Atenção'},
    ]
  },
  'Cafeterias': {
    icon: '☕', color: '#EFEBE9',
    items: [
      {name: 'Café especial grão 1kg', stock: 2, min: 8, status: 'Crítico'},
      {name: 'Leite integral 1L', stock: 5, min: 20, status: 'Crítico'},
      {name: 'Açúcar demerara 1kg', stock: 10, min: 6, status: 'OK'},
      {name: 'Copo descartável 200ml', stock: 50, min: 100, status: 'Atenção'},
      {name: 'Croissant congelado cx20', stock: 3, min: 10, status: 'Crítico'},
    ]
  },
  'Pet Shops': {
    icon: '🐾', color: '#FFF8E1',
    items: [
      {name: 'Ração Golden cães 15kg', stock: 3, min: 10, status: 'Crítico'},
      {name: 'Ração Whiskas gatos 3kg', stock: 5, min: 8, status: 'Atenção'},
      {name: 'Shampoo pet neutro 500ml', stock: 12, min: 6, status: 'OK'},
      {name: 'Antipulgas Frontline', stock: 2, min: 8, status: 'Crítico'},
      {name: 'Osso brinquedo cx12', stock: 8, min: 5, status: 'OK'},
    ]
  },
  'Conveniências': {
    icon: '🏪', color: '#E0F7FA',
    items: [
      {name: 'Cerveja lata 350ml cx12', stock: 4, min: 15, status: 'Crítico'},
      {name: 'Salgadinho Doritos 96g', stock: 8, min: 20, status: 'Atenção'},
      {name: 'Chocolate Snickers cx20', stock: 6, min: 10, status: 'Atenção'},
      {name: 'Energético Monster 473ml', stock: 3, min: 12, status: 'Crítico'},
      {name: 'Cigarro (diversas marcas)', stock: 15, min: 30, status: 'Atenção'},
    ]
  }
};

function showSegmentExample(segmentName) {
  var data = segmentExamples[segmentName];
  if (!data) return;

  var criticalCount = data.items.filter(function(i) { return i.status === 'Crítico'; }).length;
  var warningCount = data.items.filter(function(i) { return i.status === 'Atenção'; }).length;
  var okCount = data.items.filter(function(i) { return i.status === 'OK'; }).length;

  var overlay = document.createElement('div');
  overlay.className = 'demo-overlay';
  overlay.id = 'segment-modal';
  overlay.onclick = function(e) { if (e.target === overlay) closeSegmentModal(); };

  overlay.innerHTML =
    '<div class="demo-container" style="max-width:680px">' +
      '<div class="demo-header">' +
        '<div class="demo-header-title">' + data.icon + ' Exemplo — ' + escapeHtml(segmentName) + '</div>' +
        '<button class="demo-close" onclick="closeSegmentModal()" title="Fechar">✕</button>' +
      '</div>' +
      '<div style="padding:1.5rem">' +
        '<p style="color:var(--gray-400);margin-bottom:1.25rem;font-size:.9375rem">Veja como o painel do Vapt Vupt funciona para <strong>' + escapeHtml(segmentName) + '</strong>. Este é um exemplo de estoque com itens típicos do segmento.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1.25rem">' +
          '<div style="text-align:center;padding:.75rem;background:rgba(255,59,48,.06);border-radius:var(--radius-md);border:1px solid rgba(255,59,48,.15)"><div style="font-size:1.25rem;font-weight:700;color:var(--danger)">' + criticalCount + '</div><div style="font-size:.75rem;color:var(--gray-400)">Críticos</div></div>' +
          '<div style="text-align:center;padding:.75rem;background:rgba(255,149,0,.06);border-radius:var(--radius-md);border:1px solid rgba(255,149,0,.15)"><div style="font-size:1.25rem;font-weight:700;color:var(--warning)">' + warningCount + '</div><div style="font-size:.75rem;color:var(--gray-400)">Atenção</div></div>' +
          '<div style="text-align:center;padding:.75rem;background:rgba(0,185,125,.06);border-radius:var(--radius-md);border:1px solid rgba(0,185,125,.15)"><div style="font-size:1.25rem;font-weight:700;color:var(--success)">' + okCount + '</div><div style="font-size:.75rem;color:var(--gray-400)">OK</div></div>' +
        '</div>' +
        '<div style="background:var(--gray-50);border:1.5px solid var(--gray-100);border-radius:var(--radius-lg);overflow:hidden">' +
          '<table style="width:100%;border-collapse:collapse;font-size:.875rem">' +
            '<thead><tr style="background:var(--gray-100)">' +
              '<th style="text-align:left;padding:.75rem 1rem;font-weight:600;color:var(--gray-600)">Produto</th>' +
              '<th style="text-align:center;padding:.75rem .5rem;font-weight:600;color:var(--gray-600)">Estoque</th>' +
              '<th style="text-align:center;padding:.75rem .5rem;font-weight:600;color:var(--gray-600)">Mínimo</th>' +
              '<th style="text-align:center;padding:.75rem 1rem;font-weight:600;color:var(--gray-600)">Status</th>' +
            '</tr></thead>' +
            '<tbody>' +
              data.items.map(function(item) {
                var chipClass = item.status === 'Crítico' ? 'chip-red' : (item.status === 'Atenção' ? 'chip-orange' : 'chip-green');
                return '<tr style="border-top:1px solid var(--gray-100)">' +
                  '<td style="padding:.75rem 1rem;font-weight:500">' + escapeHtml(item.name) + '</td>' +
                  '<td style="text-align:center;padding:.75rem .5rem">' + item.stock + '</td>' +
                  '<td style="text-align:center;padding:.75rem .5rem">' + item.min + '</td>' +
                  '<td style="text-align:center;padding:.75rem 1rem"><span class="chip ' + chipClass + '" style="font-size:.75rem">' + escapeHtml(item.status) + '</span></td>' +
                '</tr>';
              }).join('') +
            '</tbody>' +
          '</table>' +
        '</div>' +
        '<div style="margin-top:1.25rem;padding:1rem;background:var(--blue-light);border-radius:var(--radius-md);border:1px solid rgba(0,87,255,.15);display:flex;align-items:center;gap:.75rem">' +
          '<span style="font-size:1.25rem">💡</span>' +
          '<div style="font-size:.875rem;color:var(--gray-600)">Com o Vapt Vupt, esses itens críticos seriam automaticamente cotados com os melhores fornecedores da sua região.</div>' +
        '</div>' +
        '<div style="margin-top:1.25rem;text-align:center">' +
          '<button class="btn btn-primary" onclick="closeSegmentModal();showPage(\'page-cadastro\')">Criar conta grátis</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
}

function closeSegmentModal() {
  var modal = document.getElementById('segment-modal');
  if (modal) modal.remove();
}

// ═══════════════════════════════
// DEMO SIMULATION (interactive walkthrough)
// ═══════════════════════════════
var demoStep = 0;
var demoStepCount = 5;

function openDemoModal() {
  demoStep = 0;
  var overlay = document.createElement('div');
  overlay.className = 'demo-overlay';
  overlay.id = 'demo-simulation';
  overlay.innerHTML =
    '<div class="demo-container">' +
      '<div class="demo-header">' +
        '<div class="demo-header-title">🎬 Demonstração Interativa — Vapt Vupt</div>' +
        '<button class="demo-close" onclick="closeDemoSimulation()" title="Fechar">✕</button>' +
      '</div>' +
      '<div class="demo-steps" id="demo-step-indicators"></div>' +
      '<div class="demo-step-content" id="demo-step-content"></div>' +
      '<div class="demo-footer">' +
        '<div class="demo-progress" id="demo-progress-dots"></div>' +
        '<div style="display:flex;gap:.5rem">' +
          '<button class="btn btn-ghost btn-sm" id="demo-prev-btn" onclick="demoPrev()">← Anterior</button>' +
          '<button class="btn btn-primary btn-sm" id="demo-next-btn" onclick="demoNext()">Próximo →</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  renderDemoStep();
}

function closeDemoSimulation() {
  var overlay = document.getElementById('demo-simulation');
  if (overlay) overlay.remove();
}

function demoNext() {
  if (demoStep < demoStepCount - 1) { demoStep++; renderDemoStep(); }
  else { closeDemoSimulation(); showToast('🎉 Demo completa! Crie sua conta para começar.', 'success'); }
}

function demoPrev() {
  if (demoStep > 0) { demoStep--; renderDemoStep(); }
}

function renderDemoStep() {
  var steps = [
    { title: '📊 Subir Planilha', icon: '1' },
    { title: '🔔 Alertas de Estoque', icon: '2' },
    { title: '⚡ Cotação Automática', icon: '3' },
    { title: '💰 Comparar Ofertas', icon: '4' },
    { title: '✅ Confirmar Pedido', icon: '5' }
  ];

  // Step indicators
  var indicators = document.getElementById('demo-step-indicators');
  if (indicators) {
    indicators.innerHTML = steps.map(function(s, i) {
      var cls = i < demoStep ? 'completed' : (i === demoStep ? 'active' : '');
      return '<div class="demo-step-indicator ' + cls + '">' +
        (i < demoStep ? '✓' : s.icon) + ' ' + escapeHtml(s.title) +
      '</div>';
    }).join('');
  }

  // Progress dots
  var dots = document.getElementById('demo-progress-dots');
  if (dots) {
    dots.innerHTML = steps.map(function(_, i) {
      var cls = i < demoStep ? 'done' : (i === demoStep ? 'active' : '');
      return '<div class="demo-progress-dot ' + cls + '"></div>';
    }).join('');
  }

  // Buttons
  var prevBtn = document.getElementById('demo-prev-btn');
  var nextBtn = document.getElementById('demo-next-btn');
  if (prevBtn) prevBtn.style.visibility = demoStep === 0 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.textContent = demoStep === demoStepCount - 1 ? 'Finalizar ✓' : 'Próximo →';

  // Step content
  var content = document.getElementById('demo-step-content');
  if (!content) return;

  var stepContents = [
    // Step 1: Upload spreadsheet
    '<div style="max-width:600px;margin:0 auto">' +
      '<h3 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin-bottom:.5rem">📊 Envie seu estoque</h3>' +
      '<p style="color:var(--gray-400);margin-bottom:1.25rem">Suba sua planilha de estoque ou use o modelo pronto. O sistema identifica automaticamente o que está em baixa.</p>' +
      '<div class="demo-mockup">' +
        '<div class="demo-mockup-header">' +
          '<span style="font-size:1.25rem">📂</span>' +
          '<div>' +
            '<div style="font-weight:600;font-size:.9375rem">estoque-marco-2025.xlsx</div>' +
            '<div style="font-size:.8125rem;color:var(--gray-400)">103 itens lidos · 24 KB</div>' +
          '</div>' +
          '<span class="chip chip-green" style="margin-left:auto">✓ Processado</span>' +
        '</div>' +
        '<div class="demo-product-row"><span>🍺</span><div style="flex:1"><div style="font-weight:500">Cerveja Heineken cx24</div><div style="font-size:.8125rem;color:var(--gray-400)">Estoque: 2 cx · Mínimo: 10 cx</div></div><span class="chip chip-red" style="font-size:.75rem">Crítico</span></div>' +
        '<div class="demo-product-row"><span>💊</span><div style="flex:1"><div style="font-weight:500">Dipirona 500mg cx30</div><div style="font-size:.8125rem;color:var(--gray-400)">Estoque: 3 cx · Mínimo: 15 cx</div></div><span class="chip chip-red" style="font-size:.75rem">Crítico</span></div>' +
        '<div class="demo-product-row"><span>🧽</span><div style="flex:1"><div style="font-weight:500">Detergente Ypê cx24</div><div style="font-size:.8125rem;color:var(--gray-400)">Estoque: 1 cx · Mínimo: 8 cx</div></div><span class="chip chip-red" style="font-size:.75rem">Crítico</span></div>' +
        '<div style="text-align:center;padding:.75rem;font-size:.875rem;color:var(--gray-400)">+ 4 itens críticos identificados</div>' +
      '</div>' +
    '</div>',

    // Step 2: Stock alerts
    '<div style="max-width:600px;margin:0 auto">' +
      '<h3 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin-bottom:.5rem">🔔 Alertas inteligentes</h3>' +
      '<p style="color:var(--gray-400);margin-bottom:1.25rem">O sistema avisa antes do produto acabar — por e-mail ou (em breve) WhatsApp.</p>' +
      '<div class="demo-mockup">' +
        '<div class="demo-alert-card">' +
          '<span style="font-size:1.5rem">🚨</span>' +
          '<div>' +
            '<div style="font-weight:600;color:var(--danger)">Estoque crítico — Cerveja Heineken</div>' +
            '<div style="font-size:.875rem;color:var(--gray-600)">Restam apenas <strong>2 caixas</strong>. Consumo médio: 8 cx/semana. Previsão de ruptura: <strong>2 dias</strong>.</div>' +
            '<div style="font-size:.8125rem;color:var(--gray-400);margin-top:.375rem">📧 Alerta enviado para marcos@farmacia.com · Hoje, 07:15</div>' +
          '</div>' +
        '</div>' +
        '<div class="demo-alert-card">' +
          '<span style="font-size:1.5rem">⚠️</span>' +
          '<div>' +
            '<div style="font-weight:600;color:var(--warning)">Atenção — Álcool Gel 70%</div>' +
            '<div style="font-size:.875rem;color:var(--gray-600)">Restam <strong>8 unidades</strong>. Mínimo configurado: 20 un. Sugestão de reposição automática ativada.</div>' +
            '<div style="font-size:.8125rem;color:var(--gray-400);margin-top:.375rem">📧 Alerta enviado · Hoje, 07:15</div>' +
          '</div>' +
        '</div>' +
        '<div class="demo-alert-card">' +
          '<span style="font-size:1.5rem">💡</span>' +
          '<div>' +
            '<div style="font-weight:600;color:var(--blue)">Promoção disponível — Dipirona cx30</div>' +
            '<div style="font-size:.875rem;color:var(--gray-600)">Farma Atacado Central está com <strong>21% de desconto</strong> no item que está em falta no seu estoque.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>',

    // Step 3: Auto quotation
    '<div style="max-width:600px;margin:0 auto">' +
      '<h3 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin-bottom:.5rem">⚡ Cotação em minutos</h3>' +
      '<p style="color:var(--gray-400);margin-bottom:1.25rem">Com um clique, o sistema envia a cotação dos itens críticos para fornecedores qualificados da sua região.</p>' +
      '<div class="demo-mockup">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem">' +
          '<div><div style="font-weight:600">Cotação #VV-2851</div><div style="font-size:.8125rem;color:var(--gray-400)">7 itens · Gerada agora</div></div>' +
          '<span class="chip chip-orange">Em andamento</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.75rem;margin-bottom:1rem">' +
          '<div style="text-align:center;padding:.75rem;background:var(--blue-light);border-radius:var(--radius-md)"><div style="font-size:1.25rem;font-weight:700;color:var(--blue)">4</div><div style="font-size:.75rem;color:var(--gray-400)">Fornecedores notificados</div></div>' +
          '<div style="text-align:center;padding:.75rem;background:var(--blue-light);border-radius:var(--radius-md)"><div style="font-size:1.25rem;font-weight:700;color:var(--blue)">7</div><div style="font-size:.75rem;color:var(--gray-400)">Itens na cotação</div></div>' +
          '<div style="text-align:center;padding:.75rem;background:var(--blue-light);border-radius:var(--radius-md)"><div style="font-size:1.25rem;font-weight:700;color:var(--blue)">~2h</div><div style="font-size:.75rem;color:var(--gray-400)">Tempo médio de resposta</div></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:.5rem;color:var(--gray-400);font-size:.875rem"><div class="loading-spinner"></div> Aguardando respostas dos fornecedores...</div>' +
      '</div>' +
    '</div>',

    // Step 4: Compare offers
    '<div style="max-width:600px;margin:0 auto">' +
      '<h3 style="font-size:1.25rem;font-weight:700;color:var(--gray-900);margin-bottom:.5rem">💰 Compare ofertas lado a lado</h3>' +
      '<p style="color:var(--gray-400);margin-bottom:1.25rem">Quando os fornecedores respondem, você vê tudo comparado: preço, prazo, forma de pagamento e reputação.</p>' +
      '<div class="demo-mockup">' +
        '<div style="font-weight:600;margin-bottom:.75rem">3 ofertas recebidas para Cotação #VV-2844</div>' +
        '<div class="demo-offer-row best">' +
          '<div><div style="font-weight:600">Farma Atacado Central</div><div style="font-size:.8125rem;color:var(--gray-400)">1-2 dias · Boleto 30d · 4.8 ★</div></div>' +
          '<div style="text-align:right"><div style="font-size:1.125rem;font-weight:700;color:var(--success)">R$ 1.289,00</div><span class="best-badge">★ Melhor oferta</span></div>' +
        '</div>' +
        '<div class="demo-offer-row">' +
          '<div><div style="font-weight:600">Distribuidora Saúde Total</div><div style="font-size:.8125rem;color:var(--gray-400)">2-3 dias · PIX/Boleto · 4.6 ★</div></div>' +
          '<div style="text-align:right"><div style="font-size:1.125rem;font-weight:700;color:var(--gray-900)">R$ 1.340,00</div></div>' +
        '</div>' +
        '<div class="demo-offer-row">' +
          '<div><div style="font-weight:600">Atacado MedBem SP</div><div style="font-size:.8125rem;color:var(--gray-400)">1 dia · PIX · 4.9 ★</div></div>' +
          '<div style="text-align:right"><div style="font-size:1.125rem;font-weight:700;color:var(--gray-900)">R$ 1.415,00</div></div>' +
        '</div>' +
      '</div>' +
    '</div>',

    // Step 5: Confirm order
    '<div style="max-width:600px;margin:0 auto;text-align:center">' +
      '<div style="font-size:4rem;margin-bottom:1rem">🎉</div>' +
      '<h3 style="font-size:1.5rem;font-weight:700;color:var(--gray-900);margin-bottom:.75rem">Pedido confirmado!</h3>' +
      '<p style="color:var(--gray-400);margin-bottom:1.5rem;max-width:400px;margin-left:auto;margin-right:auto">Com um clique você escolhe a melhor oferta. O fornecedor é notificado e o pedido é processado automaticamente.</p>' +
      '<div class="demo-mockup" style="text-align:left">' +
        '<div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem">' +
          '<span class="chip chip-green" style="font-size:.875rem">✓ Pedido realizado</span>' +
          '<span style="font-size:.875rem;color:var(--gray-400)">Cotação #VV-2844</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
          '<div><div style="font-size:.8125rem;color:var(--gray-400)">Fornecedor</div><div style="font-weight:600">Farma Atacado Central</div></div>' +
          '<div><div style="font-size:.8125rem;color:var(--gray-400)">Valor total</div><div style="font-weight:600;color:var(--success)">R$ 1.289,00</div></div>' +
          '<div><div style="font-size:.8125rem;color:var(--gray-400)">Prazo de entrega</div><div style="font-weight:600">1-2 dias úteis</div></div>' +
          '<div><div style="font-size:.8125rem;color:var(--gray-400)">Economia estimada</div><div style="font-weight:600;color:var(--success)">R$ 126,00 (9%)</div></div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:1.5rem">' +
        '<p style="font-size:.9375rem;color:var(--gray-600);font-weight:500">Pronto para experimentar no seu negócio?</p>' +
      '</div>' +
    '</div>'
  ];

  content.innerHTML = stepContents[demoStep] || '';
}

// Legacy support: keep the old demo modal functions working too
function closeDemoModal() {
  closeDemoSimulation();
}

function submitDemo() {
  showToast('✅ Solicitação enviada! Entraremos em contato em até 24h.', 'success');
  closeDemoSimulation();
}

// ═══════════════════════════════
// FORGOT PASSWORD
// ═══════════════════════════════
function showForgotModal() {
  showToast('Um link de recuperação foi enviado para seu e-mail.', 'info');
}

// ═══════════════════════════════
// SCROLL REVEAL
// ═══════════════════════════════
function initScrollReveal() {
  var revealObs = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (e.isIntersecting) {
        e.target.classList.add('revealed');
        revealObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('[data-reveal]').forEach(function(el) { revealObs.observe(el); });
}

// ═══════════════════════════════
// INIT
// ═══════════════════════════════
function showSplashScreen() {
  var splash = document.createElement('div');
  splash.id = 'splash-screen';
  splash.style.cssText = 'position:fixed;inset:0;z-index:9999;background:linear-gradient(135deg,#0057FF 0%,#3373FF 100%);display:flex;align-items:center;justify-content:center;flex-direction:column;transition:opacity .5s ease,transform .5s ease';
  splash.innerHTML =
    '<img src="img/favicon.svg" alt="Vapt Vupt logo" style="width:80px;height:80px;margin-bottom:1.5rem;animation:splashPulse 1s ease infinite alternate">' +
    '<div style="color:#fff;font-family:var(--font-display);font-size:2rem;font-weight:400;opacity:0;animation:splashFadeIn .6s ease .3s forwards">Vapt Vupt</div>' +
    '<div style="color:rgba(255,255,255,.6);font-size:.875rem;margin-top:.5rem;opacity:0;animation:splashFadeIn .6s ease .6s forwards">Reposição Inteligente de Estoque</div>';
  document.body.appendChild(splash);
  setTimeout(function() {
    splash.style.opacity = '0';
    splash.style.transform = 'scale(1.05)';
    setTimeout(function() { splash.remove(); }, 500);
  }, 1800);
}

window.addEventListener('DOMContentLoaded', function() {
  renderCatalog();
  renderPromos();
  renderCriticalItems();
  renderQuotes();
  initScrollReveal();
  showSplashScreen();
  // Auto-login from cached session
  var session = localStorage.getItem('vv_session');
  if (session) {
    try {
      var user = JSON.parse(session);
      appState.currentUser = user;
      showPage('page-dashboard');
      initDashboard();
    } catch(e) {
      console.warn('Sessão inválida no cache, limpando:', e);
      localStorage.removeItem('vv_session');
    }
  }
});
