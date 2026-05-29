// Plus de MATIERES en dur ! Elles sont chargées depuis matieres.json

let matieresList = [];
let currentMatiere = null;
let currentCats = [];
let currentFilter = 'all';
let openCats = {};

// CATEGORIES PAR DÉFAUT pour chaque matière (si fichier JSON absent)
const DEFAULT_CATEGORIES = {
  francais: {
    categories: [
      { nom: "Orthographe", sous_categories: ["Accords", "Homophones", "Pluriels"] },
      { nom: "Grammaire", sous_categories: ["Conjugaison", "Syntaxe", "Nature des mots"] },
      { nom: "Vocabulaire", sous_categories: ["Sens propre/figuré", "Familles de mots", "Préfixes/Suffixes"] }
    ]
  },
  maths: {
    categories: [
      { nom: "Calcul", sous_categories: ["Opérations", "Fractions", "Pourcentages"] },
      { nom: "Géométrie", sous_categories: ["Figures", "Périmètres/Aires", "Angles"] },
      { nom: "Problèmes", sous_categories: ["Modélisation", "Grandeurs", "Logique"] }
    ]
  },
  sciences: {
    categories: [
      { nom: "Biologie", sous_categories: ["Cellules", "Reproduction", "Écosystèmes"] },
      { nom: "Physique", sous_categories: ["Mouvement", "Énergie", "Électricité"] }
    ]
  },
  histoire: {
    categories: [
      { nom: "Dates", sous_categories: ["Révolution", "Guerres", "Régimes"] },
      { nom: "Personnages", sous_categories: ["Rois", "Présidents", "Scientifiques"] }
    ]
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getData(matiereId) {
  try {
    return JSON.parse(localStorage.getItem('bil_err_' + matiereId) || '[]');
  } catch {
    return [];
  }
}

function saveData(matiereId, d) {
  localStorage.setItem('bil_err_' + matiereId, JSON.stringify(d));
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function revisionLabel(ts) {
  if (!ts) return '';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rev = new Date(ts);
  rev.setHours(0, 0, 0, 0);
  const diff = Math.round((rev - now) / 86400000);
  if (diff < 0) return 'En retard';
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  return 'Dans ' + diff + 'j';
}

function isLate(ts) {
  if (!ts) return false;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const rev = new Date(ts);
  rev.setHours(0, 0, 0, 0);
  return rev < now;
}

function statusClass(s) {
  if (s === 'À revoir') return 'revoir';
  if (s === 'En cours') return 'encours';
  return 'maitrise';
}

function showError(msg) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = msg;
  errorDiv.classList.add('show');
  setTimeout(() => errorDiv.classList.remove('show'), 4000);
}

// Chargement des matières depuis matieres.json
async function loadMatieres() {
  try {
    const response = await fetch('matieres.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    matieresList = data;
    document.getElementById('headerSubtitle').textContent = 'Sélectionne une matière pour commencer';
    renderAccueil();
  } catch (error) {
    console.error('Erreur chargement matieres.json:', error);
    document.getElementById('headerSubtitle').textContent = 'Erreur : matieres.json introuvable';
    document.getElementById('matieresGrid').innerHTML = '<div style="color:var(--error); text-align:center; padding:40px;">❌ Fichier matieres.json manquant ou invalide</div>';
  }
}

function renderAccueil() {
  const grid = document.getElementById('matieresGrid');
  if (!matieresList.length) {
    grid.innerHTML = '<div style="color:var(--muted); text-align:center; padding:40px;">Aucune matière disponible</div>';
    return;
  }

  grid.innerHTML = matieresList.map(m => {
    const data = getData(m.id);
    const aRevoir = data.filter(e => e.status === 'À revoir').length;
    return `
      <div class="matiere-btn" data-matiere="${m.id}" style="border-color: rgba(${hexToRgb(m.couleur)}, 0.2)">
        <div class="matiere-dot" style="background:${m.couleur}"></div>
        <div class="matiere-name">${escapeHtml(m.nom)}</div>
        <div class="matiere-count">${data.length} erreur${data.length > 1 ? 's' : ''} · ${aRevoir} à revoir</div>
      </div>`;
  }).join('');

  document.querySelectorAll('.matiere-btn').forEach(btn => {
    btn.addEventListener('click', () => goMatiere(btn.dataset.matiere));
  });
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function goAccueil() {
  currentMatiere = null;
  currentCats = [];
  openCats = {};
  document.getElementById('page-accueil').style.display = 'block';
  document.getElementById('page-erreurs').style.display = 'none';
  document.getElementById('headerSubtitle').textContent = 'Sélectionne une matière pour commencer';
  renderAccueil();
}

async function goMatiere(id) {
  const m = matieresList.find(x => x.id === id);
  if (!m) return;
  currentMatiere = m;
  currentFilter = 'all';
  openCats = {};

  try {
    const res = await fetch(m.fichier);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    currentCats = json.categories || [];
  } catch (e) {
    console.warn('Impossible de charger', m.fichier, e);
    if (DEFAULT_CATEGORIES[id]) {
      currentCats = DEFAULT_CATEGORIES[id].categories;
      showError(`Fichier ${m.fichier} introuvable. Utilisation des catégories par défaut.`);
    } else {
      currentCats = [];
      showError(`Impossible de charger les catégories pour ${m.nom}. Vérifie que ${m.fichier} existe.`);
    }
  }

  document.getElementById('page-accueil').style.display = 'none';
  document.getElementById('page-erreurs').style.display = 'block';
  document.getElementById('headerSubtitle').textContent = m.nom + ' — erreurs à l\'écrit';

  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.filter-btn[data-filter="all"]').classList.add('active');

  populateForm();
  renderErreurs();
}

function populateForm() {
  const catSel = document.getElementById('fCat');
  if (currentCats.length === 0) {
    catSel.innerHTML = '<option>Aucune catégorie disponible</option>';
    document.getElementById('fSub').innerHTML = '';
    return;
  }
  catSel.innerHTML = currentCats.map(c => `<option>${escapeHtml(c.nom)}</option>`).join('');
  updateSubcats();
}

function updateSubcats() {
  const catName = document.getElementById('fCat').value;
  const cat = currentCats.find(c => c.nom === catName);
  const subSel = document.getElementById('fSub');
  if (cat && cat.sous_categories && cat.sous_categories.length) {
    subSel.innerHTML = cat.sous_categories.map(s => `<option>${escapeHtml(s)}</option>`).join('');
  } else {
    subSel.innerHTML = '<option>Aucune</option>';
  }
}

function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderErreurs();
}

function toggleCat(name) {
  openCats[name] = !openCats[name];
  renderErreurs();
}

function cycleStatus(id) {
  const data = getData(currentMatiere.id);
  const idx = data.findIndex(e => e.id === id);
  if (idx === -1) return;
  const order = ['À revoir', 'En cours', 'Maîtrisé'];
  const cur = order.indexOf(data[idx].status);
  data[idx].status = order[(cur + 1) % 3];
  saveData(currentMatiere.id, data);
  renderErreurs();
}

function deleteError(id) {
  if (confirm('Supprimer cette erreur ?')) {
    const data = getData(currentMatiere.id).filter(e => e.id !== id);
    saveData(currentMatiere.id, data);
    renderErreurs();
  }
}

function addError() {
  if (!currentCats.length) {
    showError("Aucune catégorie disponible. Vérifie les fichiers JSON.");
    return;
  }

  const cat = document.getElementById('fCat').value;
  const sub = document.getElementById('fSub').value;
  const err = document.getElementById('fErr').value.trim();
  const cor = document.getElementById('fCor').value.trim();
  const status = document.getElementById('fStatus').value;
  const days = parseInt(document.getElementById('fRevision').value);

  if (!err || !cor) {
    showError("Remplis l'erreur et la correction.");
    return;
  }
  if (cat === 'Aucune catégorie disponible') {
    showError("Aucune catégorie valide disponible.");
    return;
  }

  const revDate = new Date();
  revDate.setDate(revDate.getDate() + days);
  const data = getData(currentMatiere.id);
  data.unshift({
    id: Date.now().toString(),
    cat,
    sub: sub === 'Aucune' ? '' : sub,
    err,
    cor,
    status,
    added: Date.now(),
    revision: revDate.getTime()
  });
  saveData(currentMatiere.id, data);

  document.getElementById('fErr').value = '';
  document.getElementById('fCor').value = '';
  document.getElementById('fStatus').value = 'À revoir';
  document.getElementById('fRevision').value = '1';

  openCats[cat] = true;
  renderErreurs();
}

function resetMatiere() {
  if (confirm('⚠️ Supprimer TOUTES les erreurs de ' + currentMatiere.nom + ' ? Cette action est irréversible.')) {
    localStorage.removeItem('bil_err_' + currentMatiere.id);
    renderErreurs();
    showError(`Toutes les erreurs de ${currentMatiere.nom} ont été supprimées.`);
  }
}

function renderErreurs() {
  if (!currentMatiere) return;
  const data = getData(currentMatiere.id);

  document.getElementById('statTotal').textContent = data.length;
  document.getElementById('statReview').textContent = data.filter(e => e.status === 'À revoir').length;
  document.getElementById('statMastered').textContent = data.filter(e => e.status === 'Maîtrisé').length;

  const container = document.getElementById('categoriesContainer');
  if (!container) return;
  container.innerHTML = '';

  if (currentCats.length === 0) {
    container.innerHTML = '<div class="empty-cat" style="text-align:center;padding:40px;">⚠️ Aucune catégorie chargée. Vérifie les fichiers JSON.</div>';
    return;
  }

  currentCats.forEach(cat => {
    let items = data.filter(e => e.cat === cat.nom);
    const allItems = [...items];
    if (currentFilter !== 'all') items = items.filter(e => e.status === currentFilter);
    const isOpen = openCats[cat.nom] === true;
    const color = currentMatiere.couleur;

    const section = document.createElement('div');
    section.className = 'cat-section';

    let itemsHtml = '';
    if (items.length === 0) {
      itemsHtml = `<div class="empty-cat">${currentFilter === 'all' ? 'Aucune erreur dans cette catégorie' : 'Aucune erreur avec ce filtre'}</div>`;
    } else {
      itemsHtml = items.map(e => {
        const late = isLate(e.revision);
        return `
          <div class="err-item">
            <div class="err-wrong">${escapeHtml(e.err)}</div>
            <div class="err-right">${escapeHtml(e.cor)}${e.sub ? '<br><span style="font-size:10px;color:var(--muted)">' + escapeHtml(e.sub) + '</span>' : ''}</div>
            <div class="err-meta">
              <span>${formatDate(e.added)}</span>
              <span class="err-revision ${late ? 'late' : ''}">${revisionLabel(e.revision)}</span>
            </div>
            <div class="err-actions">
              <span class="status-badge ${statusClass(e.status)}" data-id="${e.id}">${e.status}</span>
              <button class="del-btn" data-id="${e.id}" title="Supprimer">×</button>
            </div>
          </div>`;
      }).join('');
    }

    section.innerHTML = `
      <div class="cat-header ${isOpen ? 'open' : ''}" data-cat="${escapeHtml(cat.nom)}">
        <div class="cat-dot" style="background:${color}"></div>
        <div class="cat-name">${escapeHtml(cat.nom)}</div>
        <div class="cat-count">${allItems.length}</div>
        <div class="cat-toggle">▼</div>
      </div>
      <div class="cat-body ${isOpen ? 'open' : ''}">
        ${itemsHtml}
      </div>`;

    container.appendChild(section);
  });

  document.querySelectorAll('.cat-header').forEach(header => {
    const catName = header.dataset.cat;
    header.removeEventListener('click', () => toggleCat(catName));
    header.addEventListener('click', () => toggleCat(catName));
  });

  document.querySelectorAll('.status-badge').forEach(badge => {
    badge.removeEventListener('click', () => cycleStatus(badge.dataset.id));
    badge.addEventListener('click', () => cycleStatus(badge.dataset.id));
  });

  document.querySelectorAll('.del-btn').forEach(btn => {
    btn.removeEventListener('click', () => deleteError(btn.dataset.id));
    btn.addEventListener('click', () => deleteError(btn.dataset.id));
  });
}

// INITIALISATION
function init() {
  document.getElementById('backBtn').addEventListener('click', goAccueil);
  document.getElementById('addBtn').addEventListener('click', addError);
  document.getElementById('resetBtn').addEventListener('click', resetMatiere);
  document.getElementById('fCat').addEventListener('change', updateSubcats);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => setFilter(btn.dataset.filter, btn));
  });

  loadMatieres();
}

init();