/**
 * Foundry Lite - Application Client SPA Temps Réel
 */

// Initialisation du client Socket.io (reste ouvert en permanence entre les vues SPA)
const socket = io();

// Configuration de la salle et rôle du client actuel (défini lors de la création / connexion)
let CURRENT_ROOM = null;
let CURRENT_ROLE = 'player';

// Cache local des personnages (pour pré-remplir la modale MJ)
const charactersCache = new Map();

// Éléments du DOM (Statut & Cartes)
const statusIndicator = document.getElementById('status-indicator');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// Éléments de la modale MJ
const editModal = document.getElementById('mj-edit-modal');
const editForm = document.getElementById('mj-edit-form');
const editSlotInput = document.getElementById('edit-slot');
const editNameInput = document.getElementById('edit-name');
const editClassInput = document.getElementById('edit-class');
const editHpInput = document.getElementById('edit-hp');
const editMaxHpInput = document.getElementById('edit-max-hp');
const editEnergyInput = document.getElementById('edit-energy');
const editMaxEnergyInput = document.getElementById('edit-max-energy');
const modalSlotLabel = document.getElementById('modal-char-slot-label');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');

// Éléments du DOM (Taverne - Chat & Dés)
const diceHistory = document.getElementById('dice-history');
const chatHistory = document.getElementById('chat-history');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatSenderInput = document.getElementById('chat-sender');
const diceTargetSelect = document.getElementById('dice-target-select');
const mjTargetContainer = document.getElementById('mj-target-container');

// Éléments de l'overlay de suspense de dés
const suspenseOverlay = document.getElementById('dice-suspense-overlay');
const overlayBackdrop = document.getElementById('dice-overlay-backdrop');
const overlayCard = document.getElementById('dice-overlay-card');
const overlaySender = document.getElementById('dice-overlay-sender');
const overlayIcon = document.getElementById('dice-overlay-icon');
const overlayVal = document.getElementById('dice-overlay-val');
const overlayVerdict = document.getElementById('dice-overlay-verdict');
const overlaySub = document.getElementById('dice-overlay-sub');
const appBody = document.getElementById('app-body') || document.body;

// ============================================================
// DONNÉES & LOGIQUE DE CRÉATION DE PERSONNAGE (MEDIEVAL RPG)
// ============================================================

const RPG_RACES = {
  humain: {
    id: 'humain',
    name: 'Humain',
    icon: '👤',
    tagline: 'Adaptable et résolu',
    description: 'Les humains excellent dans la polyvalence. Robuste adaptabilité face à toutes les épreuves.',
    hpMod: 2,
    energyMod: 2,
    passive: {
      name: 'Volonté Indomptable',
      description: 'Équilibré en toutes circonstances (+2 PV Max, +2 Énergie Max).'
    }
  },
  elfe: {
    id: 'elfe',
    name: 'Elfe',
    icon: '🧝',
    tagline: 'Grâce et affinité arcanique',
    description: 'Agilité surnaturelle et affinité mystique remarquable.',
    hpMod: -2,
    energyMod: 6,
    passive: {
      name: 'Grâce Arcanique',
      description: 'Canalise les énergies supérieures (+6 Énergie Max, -2 PV Max).'
    }
  },
  nain: {
    id: 'nain',
    name: 'Nain',
    icon: '🧔',
    tagline: 'Inébranlable comme le roc',
    description: 'Forgerons et guerriers coriaces forgés dans les entrailles rocheuses.',
    hpMod: 6,
    energyMod: -2,
    passive: {
      name: 'Cœur de Granit',
      description: 'Résistance physique légendaire (+6 PV Max, -2 Énergie Max).'
    }
  },
  'demi-orc': {
    id: 'demi-orc',
    name: 'Demi-Orc',
    icon: '🐗',
    tagline: 'Férocité sauvage et sang chaud',
    description: 'Force martiale brute capable d\'encaisser les pires chocs.',
    hpMod: 8,
    energyMod: -4,
    passive: {
      name: 'Fureur Sauvage',
      description: 'Dévoué à la puissance martiale brute (+8 PV Max, -4 Énergie Max).'
    }
  },
  halfelin: {
    id: 'halfelin',
    name: 'Halfelin',
    icon: '🍀',
    tagline: 'Chance insolente & esquive',
    description: 'Petits par la taille mais insaisissables et bénis des dieux de la fortune.',
    hpMod: -1,
    energyMod: 4,
    passive: {
      name: 'Chance Insolente',
      description: 'Évite le péril avec nonchalance (+4 Énergie Max, -1 PV Max).'
    }
  },
  drakeide: {
    id: 'drakeide',
    name: 'Drakéide',
    icon: '🐲',
    tagline: 'Lignée draconique fière',
    description: 'Écailles épaisses impénétrables et souffle destructeur intimidant.',
    hpMod: 4,
    energyMod: 0,
    passive: {
      name: 'Souffle Draconique',
      description: 'Écailles épaisses et aura intimidante (+4 PV Max).'
    }
  },
  tieffelin: {
    id: 'tieffelin',
    name: 'Tieffelin',
    icon: '😈',
    tagline: 'Filiation infernale & ruse',
    description: 'Puise dans les flammes des abîmes pour nourrir ses ressources spirituelles.',
    hpMod: 0,
    energyMod: 5,
    passive: {
      name: 'Héritage Infernal',
      description: 'Le feu des abîmes nourrit son esprit (+5 Énergie Max).'
    }
  },
  gnome: {
    id: 'gnome',
    name: 'Gnome',
    icon: '⚙️',
    tagline: 'Esprit ingénieux & vivacité',
    description: 'Inventeurs et illusionnistes perpétuels dotés d\'une vivacité d\'esprit hors pair.',
    hpMod: -3,
    energyMod: 7,
    passive: {
      name: 'Esprit Ingénieux',
      description: 'Vivacité mentale exceptionnelle (+7 Énergie Max, -3 PV Max).'
    }
  },
  gobelin: {
    id: 'gobelin',
    name: 'Gobelin',
    icon: '👺',
    tagline: 'Opportunisme & ruse fourbe',
    description: 'Survivant des ruines prompt à frapper en traître puis à fuir.',
    hpMod: -2,
    energyMod: 5,
    passive: {
      name: 'Fuite Agile',
      description: 'Réflexes d\'anguille forgés par le danger (+5 Énergie Max, -2 PV Max).'
    }
  },
  'demi-elfe': {
    id: 'demi-elfe',
    name: 'Demi-Elfe',
    icon: '🌿',
    tagline: 'Harmonie des deux mondes',
    description: 'Héritage mixte combinant la robustesse humaine et la finesse elfique.',
    hpMod: 1,
    energyMod: 3,
    passive: {
      name: 'Héritage Mixte',
      description: 'Combine constitution et grâce (+1 PV Max, +3 Énergie Max).'
    }
  }
};

const RPG_CLASSES = {
  guerrier: {
    id: 'guerrier',
    name: 'Guerrier',
    icon: '🛡️',
    tagline: 'Maître d\'armes et pilier de combat',
    baseHp: 28,
    baseEnergy: 10,
    role: 'Tank / Dégâts Physiques',
    classPassive: 'Second Souffle (Tenacité au corps-à-corps)'
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    icon: '🔮',
    tagline: 'Érudit des arts mystiques arcaniques',
    baseHp: 16,
    baseEnergy: 26,
    role: 'Dégâts Magiques / Contrôle',
    classPassive: 'Affinité Élémentaire (Sorts destructeurs)'
  },
  voleur: {
    id: 'voleur',
    name: 'Voleur',
    icon: '🗡️',
    tagline: 'Ombre mortelle et frappes chirurgicales',
    baseHp: 20,
    baseEnergy: 16,
    role: 'Dégâts Critiques / Furtivité',
    classPassive: 'Attaque Sournoise (Frappe dans l\'angle mort)'
  },
  clerc: {
    id: 'clerc',
    name: 'Clerc',
    icon: '☀️',
    tagline: 'Serviteur dévoué des puissances saintes',
    baseHp: 24,
    baseEnergy: 18,
    role: 'Soutien / Soins Divins',
    classPassive: 'Bénédiction Lumineuse (Prière protectrice)'
  },
  rodeur: {
    id: 'rodeur',
    name: 'Rôdeur',
    icon: '🏹',
    tagline: 'Traqueur infatigable des contrées sauvages',
    baseHp: 22,
    baseEnergy: 15,
    role: 'Dégâts à Distance / Pistage',
    classPassive: 'Œil du Faucon (Tir précis et pistage)'
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: '⚔️',
    tagline: 'Champion en armure investi d\'un serment sacré',
    baseHp: 26,
    baseEnergy: 14,
    role: 'Tank Saint / Châtiment',
    classPassive: 'Châtiment Divin (Lame sacrée et aura)'
  }
};

const CLASS_STARTING_PACKAGES = {
  guerrier: [
    { name: 'Épée longue d\'acier trempé', type: 'item', icon: '🗡️' },
    { name: 'Potion de soin mineure', type: 'item', icon: '🧪' },
    { name: 'Second Souffle', type: 'spell', icon: '🛡️' }
  ],
  mage: [
    { name: 'Bâton de sorcier gravé', type: 'item', icon: '🪄' },
    { name: 'Fiole de mana concentrée', type: 'item', icon: '🧪' },
    { name: 'Boule de Feu', type: 'spell', icon: '🔥' }
  ],
  voleur: [
    { name: 'Dagues jumelles effilées', type: 'item', icon: '🗡️' },
    { name: 'Outils de crochetage complexes', type: 'item', icon: '🗝️' },
    { name: 'Attaque Sournoise', type: 'spell', icon: '👤' }
  ],
  clerc: [
    { name: 'Masse d\'armes sanctifiée', type: 'item', icon: '🔨' },
    { name: 'Symbole sacré en argent pur', type: 'item', icon: '✨' },
    { name: 'Prière de Guérison', type: 'spell', icon: '☀️' }
  ],
  rodeur: [
    { name: 'Arc long en if & carquois', type: 'item', icon: '🏹' },
    { name: 'Piège à loup en fer forgé', type: 'item', icon: '⛓️' },
    { name: 'Tir Précis Mortel', type: 'spell', icon: '🎯' }
  ],
  paladin: [
    { name: 'Espadon de justice éclatant', type: 'item', icon: '⚔️' },
    { name: 'Flasque d\'eau lustrale', type: 'item', icon: '🧪' },
    { name: 'Châtiment Radiant', type: 'spell', icon: '⚡' }
  ]
};

let currentSelectedRace = 'humain';
let currentSelectedClass = 'guerrier';

// ============================================================
// COULEURS DISTINCTIVES (JETON, FICHE, TAVERNE)
// ⚠️ La couleur JAUNE / OR (#facc15 / #eab308) est réservée au MJ
// ============================================================
const HERO_COLORS = [
  { id: 'red', name: 'Cramoisi Sanglant', hex: '#ef4444', borderClass: 'border-red-500', bgClass: 'bg-red-500', textClass: 'text-red-400' },
  { id: 'blue', name: 'Saphir Arcanique', hex: '#3b82f6', borderClass: 'border-blue-500', bgClass: 'bg-blue-500', textClass: 'text-blue-400' },
  { id: 'emerald', name: 'Émeraude Sauvage', hex: '#10b981', borderClass: 'border-emerald-500', bgClass: 'bg-emerald-500', textClass: 'text-emerald-400' },
  { id: 'purple', name: 'Pourpre Nébuleux', hex: '#a855f7', borderClass: 'border-purple-500', bgClass: 'bg-purple-500', textClass: 'text-purple-400' },
  { id: 'orange', name: 'Braise Ardente', hex: '#f97316', borderClass: 'border-orange-500', bgClass: 'bg-orange-500', textClass: 'text-orange-400' },
  { id: 'cyan', name: 'Givre Boréal', hex: '#06b6d4', borderClass: 'border-cyan-500', bgClass: 'bg-cyan-500', textClass: 'text-cyan-400' },
  { id: 'rose', name: 'Rose Sombre', hex: '#f43f5e', borderClass: 'border-rose-500', bgClass: 'bg-rose-500', textClass: 'text-rose-400' }
];

let currentSelectedColor = HERO_COLORS[0].hex; // #ef4444 par défaut

// ============================================================
// ATTRIBUTS (FORCE, DEXTÉRITÉ, INTELLIGENCE, CHARISME) & TITRE
// ============================================================

const BASE_ATTRIBUTE = 8;
const MAX_ATTRIBUTE_POINT_BUY = 15;
const TOTAL_POINT_BUY_POINTS = 20;

let currentAttributeMode = 'point-buy'; // 'point-buy' | '3d6'
let currentAttributes = {
  force: 8,
  dexterite: 8,
  intelligence: 8,
  charisme: 8
};

function getForgedTitle() {
  const statusEl = document.getElementById('select-origin-status');
  const conceptEl = document.getElementById('select-origin-concept');
  const status = statusEl ? statusEl.value : 'Réfugié';
  const concept = conceptEl ? conceptEl.value : 'des cendres';
  return `${status} ${concept}`;
}

function calculatePointsRemaining() {
  const spent = Math.max(0, currentAttributes.force - BASE_ATTRIBUTE) +
                Math.max(0, currentAttributes.dexterite - BASE_ATTRIBUTE) +
                Math.max(0, currentAttributes.intelligence - BASE_ATTRIBUTE) +
                Math.max(0, currentAttributes.charisme - BASE_ATTRIBUTE);
  return Math.max(0, TOTAL_POINT_BUY_POINTS - spent);
}

function updateAttributesUI() {
  const pointsRemaining = calculatePointsRemaining();

  // Affichage des valeurs d'attributs
  ['force', 'dexterite', 'intelligence', 'charisme'].forEach((stat) => {
    const valEl = document.getElementById(`attr-val-${stat}`);
    if (valEl) valEl.textContent = currentAttributes[stat];

    // Mise à jour sur le parchemin
    const parchmentStatEl = document.getElementById(`parchment-stat-${stat}`);
    if (parchmentStatEl) parchmentStatEl.textContent = currentAttributes[stat];
  });

  // Compteur visuel de points
  const pointsLeftEl = document.getElementById('attr-points-left');
  if (pointsLeftEl) pointsLeftEl.textContent = pointsRemaining;

  const pointsStatusEl = document.getElementById('attr-points-status');
  if (pointsStatusEl) {
    if (pointsRemaining === 0) {
      pointsStatusEl.classList.remove('hidden');
    } else {
      pointsStatusEl.classList.add('hidden');
    }
  }

  // Badge de mode
  const badgeEl = document.getElementById('attr-mode-badge');
  const parchmentModeText = document.getElementById('parchment-attr-mode-text');

  if (currentAttributeMode === 'random' || currentAttributeMode === '3d6') {
    if (badgeEl) {
      badgeEl.textContent = 'Mode Aléatoire (Verrouillé)';
      badgeEl.className = 'text-[10px] uppercase font-bold font-mono px-2 py-0.5 bg-amber-950/80 border border-amber-600/80 text-amber-300';
    }
    if (parchmentModeText) parchmentModeText.textContent = 'Tirage Aléatoire (20 pts répartis)';

    // Verrouillage de tous les boutons [+] et [-]
    document.querySelectorAll('.attr-btn-minus, .attr-btn-plus').forEach((btn) => {
      btn.disabled = true;
    });
  } else {
    if (badgeEl) {
      badgeEl.textContent = 'Mode Point Buy';
      badgeEl.className = 'text-[10px] uppercase font-bold font-mono px-2 py-0.5 bg-amber-950/70 border border-amber-800/60 text-amber-300';
    }
    if (parchmentModeText) parchmentModeText.textContent = `Point Buy (${pointsRemaining} pts dispo)`;

    // Gestion de l'activation/désactivation des boutons
    ['force', 'dexterite', 'intelligence', 'charisme'].forEach((stat) => {
      const minusBtn = document.querySelector(`.attr-btn-minus[data-stat="${stat}"]`);
      const plusBtn = document.querySelector(`.attr-btn-plus[data-stat="${stat}"]`);

      if (minusBtn) {
        minusBtn.disabled = currentAttributes[stat] <= BASE_ATTRIBUTE;
      }
      if (plusBtn) {
        plusBtn.disabled = currentAttributes[stat] >= MAX_ATTRIBUTE_POINT_BUY || pointsRemaining <= 0;
      }
    });
  }
}

function initCharacterCreationUI() {
  const racesContainer = document.getElementById('races-container');
  const classesContainer = document.getElementById('classes-container');

  if (racesContainer) {
    let raceHtml = '';
    Object.values(RPG_RACES).forEach((race) => {
      const isSelected = race.id === currentSelectedRace;
      const hpSign = race.hpMod >= 0 ? `+${race.hpMod}` : `${race.hpMod}`;
      const nrjSign = race.energyMod >= 0 ? `+${race.energyMod}` : `${race.energyMod}`;
      
      raceHtml += `
        <button
          type="button"
          data-race="${race.id}"
          class="select-card stone-card border-2 ${isSelected ? 'border-amber-500 selected' : 'border-stone-800'} p-3 text-left flex flex-col justify-between rounded-none transition"
        >
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xl">${race.icon}</span>
              <h4 class="font-cinzel text-xs font-bold text-amber-200">${escapeHtml(race.name)}</h4>
            </div>
            <p class="font-crimson text-[11px] text-stone-400 italic line-clamp-1 mt-1">${escapeHtml(race.tagline)}</p>
          </div>
          <div class="mt-2.5 pt-1.5 border-t border-amber-950/40 flex items-center justify-between text-[10px] font-mono font-bold">
            <span class="${race.hpMod >= 0 ? 'text-rose-400' : 'text-rose-600'}">${hpSign} PV</span>
            <span class="${race.energyMod >= 0 ? 'text-sky-400' : 'text-sky-600'}">${nrjSign} NRJ</span>
          </div>
        </button>
      `;
    });
    racesContainer.innerHTML = raceHtml;

    racesContainer.querySelectorAll('button[data-race]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const raceId = btn.getAttribute('data-race');
        if (raceId && RPG_RACES[raceId]) {
          currentSelectedRace = raceId;
          racesContainer.querySelectorAll('button[data-race]').forEach((b) => {
            b.classList.remove('selected', 'border-amber-500');
            b.classList.add('border-stone-800');
          });
          btn.classList.add('selected', 'border-amber-500');
          btn.classList.remove('border-stone-800');

          const label = document.getElementById('selected-race-label');
          if (label) label.textContent = RPG_RACES[raceId].name;

          updateCharacterPreview();
        }
      });
    });
  }

  if (classesContainer) {
    let classHtml = '';
    Object.values(RPG_CLASSES).forEach((cls) => {
      const isSelected = cls.id === currentSelectedClass;
      classHtml += `
        <button
          type="button"
          data-class="${cls.id}"
          class="select-card stone-card border-2 ${isSelected ? 'border-amber-500 selected' : 'border-stone-800'} p-3.5 text-left flex flex-col justify-between rounded-none transition"
        >
          <div>
            <div class="flex items-center gap-2">
              <span class="text-2xl">${cls.icon}</span>
              <div>
                <h4 class="font-cinzel text-sm font-bold text-amber-200">${escapeHtml(cls.name)}</h4>
                <p class="font-crimson text-xs text-amber-400/80 font-medium">${escapeHtml(cls.role)}</p>
              </div>
            </div>
            <p class="font-crimson text-xs text-stone-400 italic mt-1.5">${escapeHtml(cls.tagline)}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-amber-950/40 flex items-center justify-between font-mono text-xs font-bold">
            <span class="text-rose-400">❤️ ${cls.baseHp} PV Base</span>
            <span class="text-sky-400">⚡ ${cls.baseEnergy} NRJ Base</span>
          </div>
        </button>
      `;
    });
    classesContainer.innerHTML = classHtml;

    classesContainer.querySelectorAll('button[data-class]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const classId = btn.getAttribute('data-class');
        if (classId && RPG_CLASSES[classId]) {
          currentSelectedClass = classId;
          classesContainer.querySelectorAll('button[data-class]').forEach((b) => {
            b.classList.remove('selected', 'border-amber-500');
            b.classList.add('border-stone-800');
          });
          btn.classList.add('selected', 'border-amber-500');
          btn.classList.remove('border-stone-800');

          const label = document.getElementById('selected-class-label');
          if (label) label.textContent = RPG_CLASSES[classId].name;

          updateCharacterPreview();
        }
      });
    });
  }

  // Écouteurs pour les boutons [+] et [-] du Point Buy
  document.querySelectorAll('.attr-btn-minus').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (currentAttributeMode !== 'point-buy') return;
      const stat = btn.getAttribute('data-stat');
      if (stat && currentAttributes[stat] > BASE_ATTRIBUTE) {
        currentAttributes[stat]--;
        updateAttributesUI();
      }
    });
  });

  document.querySelectorAll('.attr-btn-plus').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (currentAttributeMode !== 'point-buy') return;
      const stat = btn.getAttribute('data-stat');
      const pointsLeft = calculatePointsRemaining();
      if (stat && pointsLeft > 0 && currentAttributes[stat] < MAX_ATTRIBUTE_POINT_BUY) {
        currentAttributes[stat]++;
        updateAttributesUI();
      }
    });
  });

  // Bouton Tirage Aléatoire (Option B - Serveur 20 points distribués)
  const btnRollStats = document.getElementById('btn-roll-stats');
  if (btnRollStats) {
    btnRollStats.addEventListener('click', () => {
      btnRollStats.disabled = true;
      socket.emit('char:roll_stats', (res) => {
        btnRollStats.disabled = false;
        if (res?.success && res.stats) {
          currentAttributeMode = 'random';
          currentAttributes.force = res.stats.force;
          currentAttributes.dexterite = res.stats.dexterite;
          currentAttributes.intelligence = res.stats.intelligence;
          currentAttributes.charisme = res.stats.charisme;
          updateAttributesUI();
        } else {
          alert('Échec de la génération des statistiques par le serveur.');
        }
      });
    });
  }

  // Bouton Réinitialiser / Revenir à Point Buy
  const btnResetPointBuy = document.getElementById('btn-reset-point-buy');
  if (btnResetPointBuy) {
    btnResetPointBuy.addEventListener('click', () => {
      currentAttributeMode = 'point-buy';
      currentAttributes = { force: 8, dexterite: 8, intelligence: 8, charisme: 8 };
      updateAttributesUI();
    });
  }

  // Listes déroulantes de l'Historique (Titre)
  const selectOriginStatus = document.getElementById('select-origin-status');
  const selectOriginConcept = document.getElementById('select-origin-concept');

  if (selectOriginStatus) {
    selectOriginStatus.addEventListener('change', updateCharacterPreview);
  }
  if (selectOriginConcept) {
    selectOriginConcept.addEventListener('change', updateCharacterPreview);
  }

  // Initialisation graphique des attributs
  updateAttributesUI();

  // Étape 6 : Initialisation de la sélection des Couleurs Héroïques (Le Jaune est interdit aux joueurs)
  renderColorPalette();
}

/**
 * Génère ou met à jour la palette de couleurs en verrouillant et grisant les couleurs déjà prises par d'autres héros
 */
function renderColorPalette() {
  const charColorsGrid = document.getElementById('char-colors-grid');
  if (!charColorsGrid) return;

  // Récupérer la liste des couleurs déjà prises par d'autres héros dans la salle
  const takenColors = new Set();
  charactersCache.forEach((char) => {
    // Si ce n'est pas le personnage du joueur connecté
    if (char && char.color && char.socketId !== socket.id) {
      takenColors.add(char.color.toLowerCase());
    }
  });

  // Si la couleur actuellement sélectionnée est déjà prise par un autre joueur, basculer sur la première disponible
  if (takenColors.has(currentSelectedColor.toLowerCase())) {
    const firstAvailable = HERO_COLORS.find(c => !takenColors.has(c.hex.toLowerCase()));
    if (firstAvailable) {
      currentSelectedColor = firstAvailable.hex;
      const colorLabel = document.getElementById('selected-color-label');
      if (colorLabel) colorLabel.textContent = firstAvailable.name;
    }
  }

  let colorHtml = '';
  HERO_COLORS.forEach((colorObj) => {
    const isTaken = takenColors.has(colorObj.hex.toLowerCase());
    const isSelected = colorObj.hex === currentSelectedColor;

    let buttonClass = 'color-select-btn p-2.5 bg-stone-950 border-2 flex flex-col items-center justify-center gap-1.5 transition';
    if (isTaken) {
      buttonClass += ' opacity-40 cursor-not-allowed border-stone-900 filter grayscale';
    } else if (isSelected) {
      buttonClass += ' border-amber-400 ring-2 ring-amber-400/50 cursor-pointer';
    } else {
      buttonClass += ' border-stone-800 hover:border-stone-600 cursor-pointer';
    }

    colorHtml += `
      <button
        type="button"
        data-color="${colorObj.hex}"
        ${isTaken ? 'disabled aria-disabled="true"' : ''}
        title="${escapeHtml(colorObj.name)}${isTaken ? ' (Déjà choisie par un autre joueur)' : ''}"
        class="${buttonClass}"
      >
        <span class="w-6 h-6 rounded-full shadow-inner border border-white/20 flex items-center justify-center text-xs relative" style="background-color: ${colorObj.hex};">
          <span class="color-check ${isSelected && !isTaken ? '' : 'hidden'} text-white font-black text-[10px]">✓</span>
          ${isTaken ? '<span class="text-rose-500 font-bold text-xs absolute">✕</span>' : ''}
        </span>
        <span class="font-cinzel text-[10px] font-bold text-stone-300 text-center truncate max-w-[85px]">
          ${escapeHtml(colorObj.name)}
        </span>
        ${isTaken ? '<span class="text-[8px] uppercase font-bold text-rose-400/90 font-mono tracking-tighter">Prise</span>' : ''}
      </button>
    `;
  });
  charColorsGrid.innerHTML = colorHtml;

  charColorsGrid.querySelectorAll('.color-select-btn:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hex = btn.getAttribute('data-color');
      if (hex) {
        currentSelectedColor = hex;
        renderColorPalette();
        const colorObj = HERO_COLORS.find(c => c.hex === hex);
        const colorLabel = document.getElementById('selected-color-label');
        if (colorLabel && colorObj) {
          colorLabel.textContent = colorObj.name;
        }
        updateCharacterPreview();
      }
    });
  });
}

function updateCharacterPreview() {
  const nameInput = document.getElementById('char-name-input');
  const heroName = nameInput?.value.trim() || 'Aventurier Sans Nom';

  const race = RPG_RACES[currentSelectedRace] || RPG_RACES.humain;
  const cls = RPG_CLASSES[currentSelectedClass] || RPG_CLASSES.guerrier;

  const maxHp = Math.max(10, cls.baseHp + race.hpMod);
  const maxEnergy = Math.max(4, cls.baseEnergy + race.energyMod);

  const hpSign = race.hpMod >= 0 ? `+${race.hpMod}` : `${race.hpMod}`;
  const energySign = race.energyMod >= 0 ? `+${race.energyMod}` : `${race.energyMod}`;

  // DOM Elements du parchemin
  const parchmentName = document.getElementById('parchment-name');
  const parchmentTitle = document.getElementById('parchment-title');
  const titlePreviewTag = document.getElementById('title-preview-tag');
  const parchmentArchetype = document.getElementById('parchment-archetype');
  const parchmentRole = document.getElementById('parchment-role');
  const parchmentHp = document.getElementById('parchment-hp');
  const parchmentHpDetail = document.getElementById('parchment-hp-detail');
  const parchmentEnergy = document.getElementById('parchment-energy');
  const parchmentEnergyDetail = document.getElementById('parchment-energy-detail');
  const parchmentPassiveTitle = document.getElementById('parchment-passive-title');
  const parchmentPassiveDesc = document.getElementById('parchment-passive-desc');

  if (parchmentName) {
    parchmentName.textContent = heroName;
    parchmentName.style.color = currentSelectedColor;
  }

  const parchmentColorDot = document.getElementById('parchment-color-dot');
  if (parchmentColorDot) {
    parchmentColorDot.style.backgroundColor = currentSelectedColor;
  }

  const parchmentSheetCard = document.getElementById('parchment-sheet-card');
  if (parchmentSheetCard) {
    parchmentSheetCard.style.boxShadow = `inset 0 0 35px rgba(115, 65, 20, 0.45), 0 0 15px ${currentSelectedColor}40`;
  }

  // Mise à jour du Titre d'Origine forgé en temps réel
  const forgedTitle = getForgedTitle();
  if (parchmentTitle) {
    parchmentTitle.textContent = forgedTitle;
  }
  if (titlePreviewTag) titlePreviewTag.textContent = forgedTitle;

  if (parchmentArchetype) parchmentArchetype.textContent = `${race.icon} ${race.name} ${cls.name}`;
  if (parchmentRole) parchmentRole.textContent = cls.role;

  if (parchmentHp) parchmentHp.textContent = maxHp;
  if (parchmentHpDetail) parchmentHpDetail.textContent = `Base ${cls.baseHp} (${cls.name}) + Race ${hpSign}`;

  if (parchmentEnergy) parchmentEnergy.textContent = maxEnergy;
  if (parchmentEnergyDetail) parchmentEnergyDetail.textContent = `Base ${cls.baseEnergy} (${cls.name}) + Race ${energySign}`;

  if (parchmentPassiveTitle) {
    const classShort = cls.classPassive.split('(')[0].trim();
    parchmentPassiveTitle.textContent = `${race.passive.name} & ${classShort}`;
  }
  if (parchmentPassiveDesc) {
    parchmentPassiveDesc.textContent = `${race.passive.description} Associé au savoir de la classe ${cls.name} : ${cls.classPassive}.`;
  }

  // Mise à jour de la Dotation de la Classe (2 objets + 1 sort / compétence)
  const startingPackageContainer = document.getElementById('parchment-starting-package');
  if (startingPackageContainer) {
    const pkg = CLASS_STARTING_PACKAGES[currentSelectedClass] || [];
    startingPackageContainer.innerHTML = pkg.map((item) => `
      <li class="flex items-center justify-between gap-2 border-b border-amber-950/15 pb-1">
        <span class="flex items-center gap-1.5">
          <span class="text-sm">${item.icon}</span>
          <span class="font-cinzel font-bold text-amber-950 text-xs">${escapeHtml(item.name)}</span>
        </span>
        <span class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-none ${item.type === 'spell' ? 'bg-red-950/20 text-red-900 border border-red-900/30' : 'bg-amber-950/15 text-amber-950 border border-amber-950/20'}">
          ${item.type === 'spell' ? 'Sort / Don' : 'Équipement'}
        </span>
      </li>
    `).join('');
  }

  // Synchronisation des statistiques d'attributs sur le parchemin
  updateAttributesUI();
}

// ============================================================
// 1. GESTION DE LA NAVIGATION SPA (Équipe, Taverne, Carte)
// ============================================================

/**
 * Change la vue active sans recharger la page pour préserver la connexion Socket.io
 * @param {'home'|'create-char'|'team'|'tavern'|'map'} tabId 
 */
function switchView(tabId) {
  // Tant que le joueur ou le MJ n'a pas créé ou rejoint de salle, le reste est inaccessible
  if (tabId !== 'home' && !CURRENT_ROOM) {
    alert('Veuillez d\'abord créer ou rejoindre une salle depuis l\'Accueil.');
    return;
  }

  // 1. Masquer toutes les vues
  document.querySelectorAll('.spa-view').forEach((view) => {
    view.classList.add('hidden');
  });

  // 2. Afficher la vue demandée
  const targetView = document.getElementById(`view-${tabId}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // 3. Mettre à jour le style des boutons d'onglets
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    const isCurrent = tab.getAttribute('data-tab') === tabId;
    if (isCurrent) {
      tab.classList.remove('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-900');
      tab.classList.add('bg-amber-500', 'text-slate-950', 'shadow');
    } else {
      tab.classList.remove('bg-amber-500', 'text-slate-950', 'shadow');
      tab.classList.add('text-slate-400', 'hover:text-slate-200', 'hover:bg-slate-900');
    }
  });

  // Si on passe sur la taverne, auto-scroll vers le bas
  if (tabId === 'tavern') {
    scrollChatToBottom();
    scrollDiceToBottom();
  }
}

// ============================================================
// 2. GESTION DU STATUT RÉSEAU
// ============================================================

function setConnectionStatus(connected) {
  if (connected) {
    statusIndicator.className = 'flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 shadow-sm';
    statusDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    statusText.textContent = `Connecté (${CURRENT_ROLE === 'mj' ? 'MJ' : 'Joueur'})`;
  } else {
    statusIndicator.className = 'flex items-center gap-2 text-xs font-semibold px-3 py-1 rounded-full bg-rose-950/80 text-rose-300 border border-rose-700/60 shadow-sm';
    statusDot.className = 'w-2 h-2 rounded-full bg-rose-400';
    statusText.textContent = 'Déconnecté';
  }
}

/**
 * Applique les restrictions d'interface :
 * - Tant qu'aucune salle n'est rejointe : les onglets Équipe, Taverne et Carte sont complètement masqués
 * - Quand une salle est rejointe : les onglets apparaissent
 * - Si l'utilisateur est Joueur : boutons +/- et crayon masqués, dés masqués
 */
function applyRolePermissions() {
  const isJoined = Boolean(CURRENT_ROOM);
  const isMJ = CURRENT_ROLE === 'mj';

  // 0. Affichage conditionnel des onglets de jeu dans la navbar
  document.querySelectorAll('.unjoined-hidden').forEach((tab) => {
    if (isJoined) {
      tab.classList.remove('hidden');
      tab.classList.add('flex');
    } else {
      tab.classList.remove('flex');
      tab.classList.add('hidden');
    }
  });

  // 1. Boutons +/- des jauges sur les fiches de personnages
  document.querySelectorAll('button[data-action="vital-change"]').forEach((btn) => {
    btn.style.display = isMJ ? '' : 'none';
  });

  // 2. Boutons crayon ✏️ d'édition complète des fiches
  document.querySelectorAll('button[data-action="open-edit-modal"]').forEach((btn) => {
    btn.style.display = isMJ ? '' : 'none';
  });

  // 2.1 Boutons + Nouvel Objet et modification des quantités dans l'inventaire
  document.querySelectorAll('.btn-add-item').forEach((btn) => {
    btn.style.display = isMJ ? '' : 'none';
  });
  document.querySelectorAll('button[data-action="change-item-qty"]').forEach((btn) => {
    btn.style.display = isMJ ? '' : 'none';
  });

  // 3. Barre de boutons rapides de dés dans la Taverne
  const quickDiceBar = document.getElementById('mj-quick-dice-bar');
  if (quickDiceBar) {
    quickDiceBar.style.display = isMJ ? '' : 'none';
  }

  // 4. Sélecteur de cible de dés
  if (mjTargetContainer) {
    mjTargetContainer.style.display = isMJ ? '' : 'none';
  }

  // 5. Placeholder du chat
  if (chatInput) {
    chatInput.placeholder = isMJ 
      ? 'Tapez un message ou /r 1d20+3...' 
      : 'Tapez un message pour vos compagnons et le MJ...';
  }

  // 5.1 Bouton Sauvegarder la Salle (Réservé au MJ connecté dans une salle)
  const btnSaveRoom = document.getElementById('btn-save-room');
  if (btnSaveRoom) {
    if (isJoined && isMJ) {
      btnSaveRoom.classList.remove('hidden');
      btnSaveRoom.classList.add('flex');
    } else {
      btnSaveRoom.classList.remove('flex');
      btnSaveRoom.classList.add('hidden');
    }
  }

  // 6. Mise à jour de l'onglet et du mode de la Forge de Personnage (Création complète vs Renommer uniquement)
  updateForgeModeUI();
}

/**
 * Configure la vue "Forge de Personnage" selon l'état du joueur :
 * - Si le joueur a déjà forgé son personnage : il ne peut QUE se renommer (étapes 2 à 6 masquées).
 * - L'onglet de navigation passe de "Forger Héros" à "Renommer Héros".
 * - Si le personnage n'est pas encore forgé : toutes les étapes de création sont accessibles.
 */
function updateForgeModeUI() {
  const isMJ = CURRENT_ROLE === 'mj';
  const myChar = getMyCharacter();
  const hasForgedChar = Boolean(myChar && myChar.created);

  const navTabForge = document.getElementById('nav-tab-forge');
  const fullForgeSteps = document.getElementById('full-forge-steps');
  const renameOnlyBadge = document.getElementById('rename-only-badge');
  const renameNoticeBox = document.getElementById('rename-notice-box');
  const charNameStepNumber = document.getElementById('char-name-step-number');
  const submitBtn = document.getElementById('btn-forge-destiny');
  const charNameInput = document.getElementById('char-name-input');

  if (isMJ) {
    // Le MJ n'a pas de fiche de personnage à forger
    if (navTabForge) navTabForge.classList.add('hidden');
    return;
  }

  if (hasForgedChar) {
    // Mode Renommer uniquement
    if (navTabForge) {
      navTabForge.classList.remove('hidden');
      navTabForge.classList.add('flex');
      navTabForge.innerHTML = '<span>🏷️</span><span>Renommer Héros</span>';
    }
    if (fullForgeSteps) fullForgeSteps.classList.add('hidden');
    if (renameOnlyBadge) renameOnlyBadge.classList.remove('hidden');
    if (renameNoticeBox) renameNoticeBox.classList.remove('hidden');
    if (charNameStepNumber) charNameStepNumber.textContent = '🏷️';
    if (submitBtn) {
      submitBtn.innerHTML = '<span class="text-lg">🖋️</span><span>Enregistrer mon Nouveau Nom</span><span class="text-lg">✨</span>';
    }
    if (charNameInput && myChar?.name) {
      charNameInput.value = myChar.name;
    }
  } else {
    // Mode Création complète
    if (navTabForge) {
      navTabForge.classList.remove('hidden');
      navTabForge.classList.add('flex');
      navTabForge.innerHTML = '<span>📜</span><span>Forger Héros</span>';
    }
    if (fullForgeSteps) fullForgeSteps.classList.remove('hidden');
    if (renameOnlyBadge) renameOnlyBadge.classList.add('hidden');
    if (renameNoticeBox) renameNoticeBox.classList.add('hidden');
    if (charNameStepNumber) charNameStepNumber.textContent = '1.';
    if (submitBtn) {
      submitBtn.innerHTML = '<span class="text-lg">⚔️</span><span>Forger mon Destin</span><span class="text-lg">⚜️</span>';
    }
  }
}

/**
 * Récupère le personnage du joueur connecté
 */
function getMyCharacter() {
  const currentChars = Array.from(charactersCache.values());
  return currentChars.find(c => c.socketId === socket.id) || null;
}

// ============================================================
// 3. GESTION DES FICHES DE PERSONNAGES ET INVENTAIRE
// ============================================================

/**
 * Compresse une image côté client via HTML5 Canvas (max 400x400px, WebP 0.8)
 * et l'envoie via POST /api/upload
 * @param {File|Blob} file 
 * @returns {Promise<string>} URL publique de l'image
 */
async function compressAndUploadImage(file) {
  if (!file) throw new Error('Aucun fichier image sélectionné.');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier image.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Le fichier sélectionné n\'est pas une image valide.'));
      img.onload = () => {
        // Redimensionnement proportionnel max 400x400px
        const maxDim = 400;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Conversion en Blob WebP (qualité 0.8)
        canvas.toBlob(async (blob) => {
          if (!blob) {
            return reject(new Error('Échec de la conversion Canvas en WebP.'));
          }

          try {
            const formData = new FormData();
            formData.append('file', blob, 'item.webp');

            const res = await fetch('/api/upload', {
              method: 'POST',
              body: formData
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
              throw new Error(data.error || 'Erreur lors de l\'upload de l\'image.');
            }

            const url = data.url || data.data?.url;
            resolve(url);
          } catch (uploadErr) {
            reject(uploadErr);
          }
        }, 'image/webp', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Génère le HTML de la grille des objets de l'inventaire
 */
function renderInventoryItemsHTML(slot, inventory = []) {
  if (!inventory || inventory.length === 0) {
    return `<div class="col-span-full py-3 text-center text-stone-500 font-crimson italic text-xs border border-dashed border-stone-900 bg-stone-950/40">Le sac est vide...</div>`;
  }

  const isMJ = CURRENT_ROLE === 'mj';

  return inventory.map((item) => {
    const hasImg = !!item.imgUrl;
    const qty = item.qty || 1;
    const itemId = item.id || '';

    return `
      <div class="group relative bg-stone-950 border border-amber-950/70 hover:border-amber-800/80 p-2 flex flex-col justify-between transition shadow-inner">
        <!-- Bouton [x] pour jeter l'objet -->
        <button
          type="button"
          data-action="remove-item"
          data-slot="${slot}"
          data-item-id="${escapeHtml(itemId)}"
          title="Jeter l'objet : ${escapeHtml(item.name)}"
          class="absolute top-1 right-1 w-4 h-4 text-stone-500 hover:text-rose-400 font-mono text-xs font-bold leading-none flex items-center justify-center cursor-pointer opacity-70 hover:opacity-100 transition z-10"
        >×</button>

        <!-- Miniature de l'objet (Image WebP ou Icône de repli) -->
        <div class="flex items-center justify-center my-1">
          ${hasImg ? `
            <img src="${escapeHtml(item.imgUrl)}" alt="${escapeHtml(item.name)}" class="w-10 h-10 object-cover border border-amber-900/60 shadow bg-stone-900">
          ` : `
            <div class="w-10 h-10 flex items-center justify-center text-lg bg-stone-900/80 border border-amber-950 text-amber-300">
              ${item.icon || '📦'}
            </div>
          `}
        </div>

        <!-- Nom et Description -->
        <div class="text-center px-0.5">
          <div class="font-cinzel text-[11px] font-bold text-amber-200 truncate" title="${escapeHtml(item.name)}">
            ${escapeHtml(item.name)}
          </div>
          ${item.desc ? `
            <div class="font-crimson italic text-[9px] text-stone-400 line-clamp-1 mt-0.5" title="${escapeHtml(item.desc)}">
              ${escapeHtml(item.desc)}
            </div>
          ` : ''}
        </div>

        <!-- Contrôle de la quantité (+/- réservé au MJ) -->
        <div class="flex items-center justify-center gap-1 mt-2 pt-1 border-t border-amber-950/40 text-[10px] font-mono">
          <button
            type="button"
            data-action="change-item-qty"
            data-slot="${slot}"
            data-item-id="${escapeHtml(itemId)}"
            data-delta="-1"
            title="Diminuer la quantité"
            class="w-4 h-4 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-rose-300 border border-stone-800 flex items-center justify-center cursor-pointer transition leading-none"
            style="display: ${isMJ ? '' : 'none'};"
          >−</button>
          <span class="text-amber-400 font-bold px-1.5 py-0.5 bg-stone-900/90 border border-amber-950/60">
            x${qty}
          </span>
          <button
            type="button"
            data-action="change-item-qty"
            data-slot="${slot}"
            data-item-id="${escapeHtml(itemId)}"
            data-delta="1"
            title="Augmenter la quantité"
            class="w-4 h-4 bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-emerald-300 border border-stone-800 flex items-center justify-center cursor-pointer transition leading-none"
            style="display: ${isMJ ? '' : 'none'};"
          >+</button>
        </div>
      </div>
    `;
  }).join('');
}

function createCharacterCardHTML(char) {
  const isMJ = CURRENT_ROLE === 'mj';
  const hpPercent = Math.max(0, Math.min(100, Math.round((char.hp / char.maxHp) * 100)));
  const energyPercent = Math.max(0, Math.min(100, Math.round((char.energy / char.maxEnergy) * 100)));

  const charColor = char.color || '#ef4444';

  return `
    <article data-slot="${char.slot}" class="stone-card border-2 rounded-none p-5 shadow-2xl flex flex-col justify-between hover:brightness-105 transition duration-200" style="border-color: ${charColor}88; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.7), inset 0 0 25px rgba(0,0,0,0.8), 0 0 15px ${charColor}20;">
      <div>
        <div class="flex items-center justify-between mb-4 border-b border-amber-950/80 pb-2.5">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-none bg-stone-950 font-cinzel text-lg font-bold flex items-center justify-center border-2 shadow-inner" style="border-color: ${charColor}; color: ${charColor};">
              ${char.raceIcon || '🛡️'}
            </span>
            <div>
              <h3 class="char-name font-cinzel font-bold text-base tracking-wide flex items-center gap-2" style="color: ${charColor};">
                <span>${escapeHtml(char.name)}</span>
                <span class="w-2.5 h-2.5 rounded-full inline-block shadow-sm" style="background-color: ${charColor};" title="Couleur de sceau"></span>
              </h3>
              ${char.title ? `<div class="font-cinzel text-[11px] font-bold text-amber-300 italic tracking-wider">${escapeHtml(char.title)}</div>` : ''}
              <span class="char-class font-crimson text-xs italic font-medium text-amber-400/90">
                ${escapeHtml(char.race ? `${char.race} ` : '')}${escapeHtml(char.class)}${char.role ? ` — ${escapeHtml(char.role)}` : ''}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" data-action="open-edit-modal" data-slot="${char.slot}" title="Modifier le personnage (MJ)" class="p-1.5 rounded-none bg-stone-900 hover:bg-amber-950 text-stone-400 hover:text-amber-300 border border-amber-900/60 transition cursor-pointer text-xs" style="display: ${isMJ ? '' : 'none'};">
              ✏️
            </button>
            <span class="text-[10px] font-cinzel font-bold uppercase px-2.5 py-1 rounded-none bg-stone-950 border shadow-inner" style="border-color: ${charColor}80; color: ${charColor};">Aventurier ${Number(char.slot) + 1}</span>
          </div>
        </div>

        ${char.passive ? `
          <div class="mb-2.5 px-3 py-1.5 bg-amber-950/20 border border-amber-900/40 rounded-none flex items-center gap-2 text-[11px] text-amber-200/90 shadow-inner">
            <span class="text-xs">⚜️</span>
            <span class="font-cinzel font-bold text-amber-300">${escapeHtml(char.passive.name || '')}</span>
          </div>
        ` : ''}

        ${char.attributes ? `
          <div class="mb-3 px-2.5 py-1.5 bg-stone-950/80 border border-stone-800 grid grid-cols-4 gap-1 text-center font-mono text-[11px]">
            <div class="border-r border-stone-800"><span class="text-stone-400 block text-[9px] font-cinzel font-bold">FOR</span><span class="font-bold text-red-300">${char.attributes.force ?? 8}</span></div>
            <div class="border-r border-stone-800"><span class="text-stone-400 block text-[9px] font-cinzel font-bold">DEX</span><span class="font-bold text-emerald-300">${char.attributes.dexterite ?? 8}</span></div>
            <div class="border-r border-stone-800"><span class="text-stone-400 block text-[9px] font-cinzel font-bold">INT</span><span class="font-bold text-sky-300">${char.attributes.intelligence ?? 8}</span></div>
            <div><span class="text-stone-400 block text-[9px] font-cinzel font-bold">CHA</span><span class="font-bold text-purple-300">${char.attributes.charisme ?? 8}</span></div>
          </div>
        ` : ''}

        <!-- Jauge PV -->
        <div class="space-y-1.5 mb-5">
          <div class="flex justify-between text-xs font-medium">
            <span class="text-rose-400 font-semibold font-cinzel flex items-center gap-1">❤️ Points de Vie</span>
            <span class="hp-text font-mono text-stone-200 font-bold">${char.hp} / ${char.maxHp}</span>
          </div>
          <div class="w-full bg-stone-950 h-3.5 rounded-none overflow-hidden border border-amber-950/80 p-0.5">
            <div class="hp-bar h-full transition-all duration-300 ease-out ${hpPercent <= 25 ? 'bg-gradient-to-r from-rose-800 to-rose-600 animate-pulse' : 'bg-gradient-to-r from-rose-700 to-amber-600'}" style="width: ${hpPercent}%;"></div>
          </div>
          <div class="flex items-center justify-end gap-1.5 pt-1">
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="-5" class="px-2.5 py-1 text-xs font-bold rounded-none bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition cursor-pointer" style="display: ${isMJ ? '' : 'none'};">-5</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="-1" class="px-3 py-1 text-xs font-bold rounded-none bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800/60 transition cursor-pointer" style="display: ${isMJ ? '' : 'none'};">-1</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="1" class="px-3 py-1 text-xs font-bold rounded-none bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 transition cursor-pointer" style="display: ${isMJ ? '' : 'none'};">+1</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="5" class="px-2.5 py-1 text-xs font-bold rounded-none bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 transition cursor-pointer" style="display: ${isMJ ? '' : 'none'};">+5</button>
          </div>
        </div>

        <!-- Jauge Énergie -->
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs font-medium">
            <span class="text-sky-400 font-semibold font-cinzel flex items-center gap-1">⚡ Énergie / Mana</span>
            <span class="energy-text font-mono text-stone-200 font-bold">${char.energy} / ${char.maxEnergy}</span>
          </div>
          <div class="w-full bg-stone-950 h-3.5 rounded-none overflow-hidden border border-amber-950/80 p-0.5">
            <div class="energy-bar h-full transition-all duration-300 ease-out bg-gradient-to-r from-sky-700 to-indigo-500" style="width: ${energyPercent}%;"></div>
          </div>
          <div class="flex items-center justify-end gap-1.5 pt-1">
            <button data-action="vital-change" data-slot="${char.slot}" data-type="energy" data-delta="-1" class="px-3 py-1 text-xs font-bold rounded-none bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800/60 transition cursor-pointer" style="display: ${isMJ ? '' : 'none'};">-1</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="energy" data-delta="1" class="px-3 py-1 text-xs font-bold rounded-none bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/60 transition cursor-pointer" style="display: ${isMJ ? '' : 'none'};">+1</button>
          </div>
        </div>

        <!-- Section Inventaire du Héros -->
        <div class="mt-4 pt-3 border-t border-amber-950/70 space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <span class="text-sm">🎒</span>
              <h4 class="font-cinzel text-xs font-bold text-amber-300 uppercase tracking-wider">Inventaire</h4>
              <span class="char-inv-count text-[10px] font-mono text-stone-400" data-slot="${char.slot}">(${(char.inventory || []).length})</span>
            </div>
            <!-- Bouton + Nouvel Objet (visible uniquement pour le MJ) -->
            <button
              type="button"
              data-action="open-add-item-modal"
              data-slot="${char.slot}"
              class="btn-add-item px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800/60 font-cinzel text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center gap-1"
              style="display: ${isMJ ? '' : 'none'};"
            >
              <span>+</span>
              <span>Nouvel Objet</span>
            </button>
          </div>

          <!-- Grille des objets de l'inventaire -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 char-inventory-grid" data-slot="${char.slot}">
            ${renderInventoryItemsHTML(char.slot, char.inventory || [])}
          </div>
        </div>
      </div>
    </article>
  `;
}

/**
 * Met à jour complètement la grille des personnages affichés
 */
function updateCharactersGrid(characters = []) {
  charactersCache.clear();
  const grid = document.getElementById('characters-grid');
  if (!grid) return;

  if (!characters || characters.length === 0) {
    grid.innerHTML = `
      <div id="no-players-message" class="col-span-full flex flex-col items-center justify-center p-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl text-center space-y-3">
        <div class="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-3xl shadow-inner">
          ⏳
        </div>
        <h3 class="font-bold text-slate-200 text-base">En attente de vos aventuriers...</h3>
        <p class="text-xs text-slate-400 max-w-sm">
          La salle est créée. Dès qu'un joueur rejoint la partie (jusqu'à 4 joueurs maximum), sa fiche de personnage sera automatiquement générée et affichée ici en temps réel.
        </p>
      </div>
    `;
    updateDiceTargetOptions([]);
    return;
  }

  // Stocker dans le cache et générer les cartes
  let html = '';
  characters.forEach((char) => {
    charactersCache.set(Number(char.slot), char);
    html += createCharacterCardHTML(char);
  });
  grid.innerHTML = html;

  // Mettre à jour les options de cible pour le MJ
  updateDiceTargetOptions(characters);

  // Mettre à jour la palette de couleurs (grise les couleurs nouvellement choisies par d'autres joueurs)
  renderColorPalette();

  // Mettre à jour le mode de la Forge de Personnage (Création complète vs Renommer uniquement)
  updateForgeModeUI();
}

/**
 * Met à jour le menu déroulant des cibles de dé du MJ
 */
function updateDiceTargetOptions(characters = []) {
  if (!diceTargetSelect) return;
  const currentVal = diceTargetSelect.value;
  let optionsHTML = '<option value="all">🌐 Toute la table (Général)</option>';
  characters.forEach((char) => {
    optionsHTML += `<option value="${char.slot}">Slot ${Number(char.slot) + 1} : ${escapeHtml(char.name)} (${escapeHtml(char.class)})</option>`;
  });
  diceTargetSelect.innerHTML = optionsHTML;
  if (diceTargetSelect.querySelector(`option[value="${currentVal}"]`)) {
    diceTargetSelect.value = currentVal;
  }
}

function renderCharacter(slot, char) {
  // Sauvegarde dans le cache local
  charactersCache.set(Number(slot), char);

  const card = document.querySelector(`article[data-slot="${slot}"]`);
  if (!card) {
    // Si la carte n'est pas encore rendue, on met à jour la liste complète
    const currentChars = Array.from(charactersCache.values());
    updateCharactersGrid(currentChars);
    return;
  }

  // Nom & Classe
  const nameEl = card.querySelector('.char-name');
  const classEl = card.querySelector('.char-class');
  const charColor = char.color || '#ef4444';

  if (nameEl && char.name) {
    nameEl.innerHTML = `<span>${escapeHtml(char.name)}</span><span class="w-2.5 h-2.5 rounded-full inline-block shadow-sm" style="background-color: ${charColor};" title="Couleur de sceau"></span>`;
    nameEl.style.color = charColor;
  }
  if (classEl && char.class) classEl.textContent = char.class;

  // Mise à jour de la bordure et de l'ombre de la carte avec la couleur du joueur
  card.style.borderColor = `${charColor}88`;
  card.style.boxShadow = `0 10px 25px -5px rgba(0,0,0,0.7), inset 0 0 25px rgba(0,0,0,0.8), 0 0 15px ${charColor}20`;

  // Mise à jour de l'icône de race
  const raceIconEl = card.querySelector('.stone-card > div > div > div > span:first-child');
  if (raceIconEl) {
    raceIconEl.style.borderColor = charColor;
    raceIconEl.style.color = charColor;
  }

  // Mise à jour de l'option correspondante dans le combo-box du MJ
  if (diceTargetSelect) {
    const opt = diceTargetSelect.querySelector(`option[value="${slot}"]`);
    if (opt) {
      opt.textContent = `Slot ${Number(slot) + 1} : ${char.name} (${char.class})`;
    }
  }

  // Pourcentages
  const hpPercent = Math.max(0, Math.min(100, Math.round((char.hp / char.maxHp) * 100)));
  const energyPercent = Math.max(0, Math.min(100, Math.round((char.energy / char.maxEnergy) * 100)));

  // Jauge PV
  const hpText = card.querySelector('.hp-text');
  const hpBar = card.querySelector('.hp-bar');
  if (hpText) hpText.textContent = `${char.hp} / ${char.maxHp}`;
  if (hpBar) {
    hpBar.style.width = `${hpPercent}%`;
    if (hpPercent <= 25) {
      hpBar.className = 'h-full rounded-full transition-all duration-300 ease-out hp-bar bg-gradient-to-r from-rose-700 to-rose-500 animate-pulse';
    } else {
      hpBar.className = 'h-full rounded-full transition-all duration-300 ease-out hp-bar bg-gradient-to-r from-rose-600 to-amber-500';
    }
  }

  // Jauge Énergie
  const energyText = card.querySelector('.energy-text');
  const energyBar = card.querySelector('.energy-bar');
  if (energyText) energyText.textContent = `${char.energy} / ${char.maxEnergy}`;
  if (energyBar) {
    energyBar.style.width = `${energyPercent}%`;
  }

  // Inventaire
  if (Array.isArray(char.inventory)) {
    const invGrid = card.querySelector(`.char-inventory-grid[data-slot="${slot}"]`);
    if (invGrid) {
      invGrid.innerHTML = renderInventoryItemsHTML(slot, char.inventory);
      const isMJ = CURRENT_ROLE === 'mj';
      invGrid.querySelectorAll('button[data-action="change-item-qty"]').forEach((btn) => {
        btn.style.display = isMJ ? '' : 'none';
      });
    }
    const invCount = card.querySelector(`.char-inv-count[data-slot="${slot}"]`);
    if (invCount) {
      invCount.textContent = `(${char.inventory.length})`;
    }
  }

  // Accentuation visuelle
  card.classList.add('ring-2', 'ring-amber-400/50');
  setTimeout(() => card.classList.remove('ring-2', 'ring-amber-400/50'), 350);
}

function emitVitalsUpdate(slot, hpChange = 0, energyChange = 0) {
  socket.emit('char:update_vitals', {
    roomId: CURRENT_ROOM,
    slot: Number(slot),
    hpChange: Number(hpChange),
    energyChange: Number(energyChange),
    role: CURRENT_ROLE
  });
}

/**
 * Ouvre la modale d'édition MJ et pré-remplit les champs avec les données actuelles
 */
function openMjEditModal(slot) {
  const slotIndex = Number(slot);
  const char = charactersCache.get(slotIndex);
  if (!char) return;

  editSlotInput.value = slotIndex;
  modalSlotLabel.textContent = `Slot #${slotIndex + 1} - ${char.name} (${char.class})`;

  editNameInput.value = char.name || '';
  editClassInput.value = char.class || '';
  editHpInput.value = char.hp;
  editMaxHpInput.value = char.maxHp;
  editEnergyInput.value = char.energy;
  editMaxEnergyInput.value = char.maxEnergy;

  editModal.classList.remove('hidden');
}

/**
 * Ferme la modale d'édition MJ
 */
function closeMjEditModal() {
  editModal.classList.add('hidden');
}

// ============================================================
// 4. GESTION DU CHAT ET DES DÉS (VUE TAVERNE)
// ============================================================

function getSenderName() {
  const name = chatSenderInput?.value?.trim();
  return name && name.length > 0 ? name : 'Aventurier';
}

function scrollChatToBottom() {
  if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
}

function scrollDiceToBottom() {
  if (diceHistory) diceHistory.scrollTop = diceHistory.scrollHeight;
}

function formatTime(isoString) {
  const date = isoString ? new Date(isoString) : new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[m]);
}

function appendChatMessage({ sender, text, timestamp, color, isMJ }) {
  if (!chatHistory) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-sm transition hover:border-slate-700';
  msgEl.setAttribute('data-sender', sender);

  // Si l'émetteur est le MJ : couleur jaune dorée #facc15 et couronne 👑
  const senderColor = isMJ ? '#facc15' : (color || '#ef4444');
  const mjCrownBadge = isMJ ? '<span class="text-xs" title="Maître du Jeu">👑</span>' : '';

  msgEl.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <span class="font-bold font-cinzel text-xs flex items-center gap-1.5 msg-sender-header" style="color: ${senderColor};">
        ${mjCrownBadge}
        <span class="msg-sender-name">${escapeHtml(sender)}</span>
      </span>
      <span class="text-[10px] text-slate-500 font-mono">${formatTime(timestamp)}</span>
    </div>
    <p class="text-slate-200 text-xs sm:text-sm break-words">${escapeHtml(text)}</p>
  `;
  chatHistory.appendChild(msgEl);
  scrollChatToBottom();
}

function appendDiceResult({ sender, formula, rolls, modifier, total, target, isCriticalSuccess, isCriticalFailure, timestamp, color, isMJ }) {
  if (!diceHistory) return;
  const rollEl = document.createElement('div');
  const timeStr = formatTime(timestamp);
  const rollsDetail = `[ ${rolls.join(', ')} ]`;
  let modStr = '';
  if (modifier > 0) modStr = ` + ${modifier}`;
  else if (modifier < 0) modStr = ` - ${Math.abs(modifier)}`;

  const senderColor = isMJ ? '#facc15' : (color || '#ef4444');
  const mjCrownBadge = isMJ ? '<span class="text-xs" title="Maître du Jeu">👑</span> ' : '';

  const targetBadge = target ? `<span class="ml-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold text-[10px] border border-amber-500/30">➔ ${escapeHtml(target.name)}</span>` : '';

  if (isCriticalSuccess) {
    // 20 Naturel (Réussite critique)
    rollEl.className = 'bg-emerald-950/60 border-2 border-emerald-500 rounded-xl p-3.5 shadow-[0_0_20px_rgba(16,185,129,0.25)]';
    rollEl.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-bold text-xs" style="color: ${senderColor};">🎲 ${mjCrownBadge}${escapeHtml(sender)} lance <span class="font-mono underline text-emerald-300">${formula}</span>${targetBadge}</span>
        <span class="text-[10px] text-emerald-400/80 font-mono">${timeStr}</span>
      </div>
      <div class="bg-emerald-500/25 text-emerald-200 text-center py-1.5 rounded-lg font-black text-xs uppercase tracking-wider my-1 border border-emerald-500/40">
        ✨ 20 NATUREL ! RÉUSSITE CRITIQUE ! ✨
      </div>
      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-emerald-800/60 text-xs">
        <span class="text-emerald-300/80 font-mono text-[11px]">Détail : ${rollsDetail}${modStr}</span>
        <span class="text-2xl font-black text-emerald-300 font-mono">${total}</span>
      </div>
    `;
  } else if (isCriticalFailure) {
    // 1 Naturel (Échec critique)
    rollEl.className = 'bg-rose-950/60 border-2 border-rose-600 rounded-xl p-3.5 shadow-[0_0_20px_rgba(225,29,72,0.25)]';
    rollEl.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-bold text-xs" style="color: ${senderColor};">🎲 ${mjCrownBadge}${escapeHtml(sender)} lance <span class="font-mono underline text-rose-300">${formula}</span>${targetBadge}</span>
        <span class="text-[10px] text-rose-400/80 font-mono">${timeStr}</span>
      </div>
      <div class="bg-rose-600/25 text-rose-200 text-center py-1.5 rounded-lg font-black text-xs uppercase tracking-wider my-1 border border-rose-500/40">
        💀 1 NATUREL ! ÉCHEC CRITIQUE ! 💀
      </div>
      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-rose-800/60 text-xs">
        <span class="text-rose-300/80 font-mono text-[11px]">Détail : ${rollsDetail}${modStr}</span>
        <span class="text-2xl font-black text-rose-300 font-mono">${total}</span>
      </div>
    `;
  } else {
    // Tirage normal
    rollEl.className = 'bg-slate-900 border border-indigo-500/40 rounded-xl p-3';
    rollEl.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold text-xs" style="color: ${senderColor};">🎲 ${mjCrownBadge}${escapeHtml(sender)} lance <span class="font-mono text-amber-300 font-bold">${formula}</span>${targetBadge}</span>
        <span class="text-[10px] text-slate-500 font-mono">${timeStr}</span>
      </div>
      <div class="flex items-center justify-between mt-1 text-xs">
        <span class="text-slate-400 font-mono text-[11px]">Détail : <span class="text-slate-200">${rollsDetail}</span>${modStr}</span>
        <span class="text-lg font-bold text-amber-400 font-mono px-2.5 py-0.5 rounded bg-slate-950 border border-slate-800">${total}</span>
      </div>
    `;
  }

  diceHistory.appendChild(rollEl);
  scrollDiceToBottom();
}

/**
 * Déclenche l'animation de suspense au centre de l'écran lors du tirage de dé
 */
let suspenseTimeout = null;
let slotMachineInterval = null;

function triggerDiceSuspenseAnimation(dice) {
  // Le MJ ne doit pas être ralenti par l'animation de suspense : il doit rester réactif
  if (CURRENT_ROLE === 'mj') return;
  if (!suspenseOverlay) return;

  const d20Val = dice.rolls && dice.rolls.length > 0 ? dice.rolls[0] : dice.total;
  const isD20 = dice.sides === 20 && dice.count === 1;
  const sides = dice.sides || 20;

  // Réinitialiser tout timeout ou intervalle précédent
  if (suspenseTimeout) {
    clearTimeout(suspenseTimeout);
    suspenseTimeout = null;
  }
  if (slotMachineInterval) {
    clearInterval(slotMachineInterval);
    slotMachineInterval = null;
  }

  // Retirer les classes de secousse, zoom et lueur
  appBody.classList.remove('shake-active');
  overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded-3xl transition-all duration-300 transform bg-slate-900/95 border-2 border-indigo-500/60 shadow-2xl';
  overlayVal.className = 'font-mono font-black text-6xl sm:text-7xl my-1 tracking-tight text-amber-300 slot-rolling';

  // Remplir le nom de l'expéditeur et la cible
  const targetLabel = dice.target ? ` ➔ pour ${dice.target.name}` : '';
  overlaySender.className = 'text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 bg-indigo-950/80 text-indigo-200 border border-indigo-800 shadow';
  overlaySender.textContent = dice.isMJ ? `👑 Le Maître du Jeu${targetLabel}` : `🎲 ${dice.sender}${targetLabel}`;
  overlaySub.textContent = `Formule : ${dice.formula}`;

  // État d'attente Casino (Machine à sous)
  overlayIcon.textContent = '🎲';
  overlayVerdict.textContent = 'LE SORT EN EST JETÉ...';
  overlayVerdict.className = 'text-xl sm:text-2xl font-black uppercase tracking-wider text-amber-400/90 my-2 animate-pulse';

  // Animation machine à sous pendant 2 secondes (nombres aléatoires défilants très vite)
  slotMachineInterval = setInterval(() => {
    const randomVal = Math.floor(Math.random() * sides) + 1;
    overlayVal.textContent = randomVal;
  }, 65);

  // Affichage immédiat de l'overlay avec transition fluide
  suspenseOverlay.classList.remove('hidden');
  void suspenseOverlay.offsetWidth; // Forcer le reflow CSS

  overlayBackdrop.classList.remove('opacity-0');
  overlayBackdrop.classList.add('opacity-100');

  overlayCard.classList.remove('opacity-0', 'scale-75');
  overlayCard.classList.add('opacity-100', 'scale-100');

  // À la fin des 2 secondes : Arrêt de la machine à sous et REVEAL FINAL avec EFFET ZOOM
  setTimeout(() => {
    if (slotMachineInterval) {
      clearInterval(slotMachineInterval);
      slotMachineInterval = null;
    }

    // Retirer l'animation machine à sous et appliquer l'impact ZOOM final
    overlayVal.classList.remove('slot-rolling');
    overlayVal.classList.add('final-zoom-impact');
    overlayVal.textContent = d20Val;
    overlaySub.textContent = `Formule : ${dice.formula} (Total : ${dice.total})`;

    // Configuration selon les 4 paliers d20 ou autre dé
    if (isD20) {
      if (d20Val === 1) {
        // 1 : Échec Critique + secousse de tout l'écran
        overlayIcon.textContent = '💀';
        overlayVerdict.textContent = 'ÉCHEC CRITIQUE !';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-black uppercase tracking-wider text-rose-500 my-2 drop-shadow-[0_0_20px_rgba(244,63,94,0.9)]';
        overlayVal.className = 'font-mono font-black text-7xl sm:text-8xl my-1 tracking-tight text-rose-400 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded-3xl transition-all duration-300 transform bg-rose-950/90 border-4 border-rose-600 shadow-[0_0_60px_rgba(225,29,72,0.8)] crit-glow-fail';
        overlaySender.className = 'text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 bg-rose-900/80 text-rose-200 border border-rose-700 shadow';

        // Secousse intense de tout l'écran
        appBody.classList.add('shake-active');

      } else if (d20Val >= 2 && d20Val <= 9) {
        // 2 à 9 : Échec
        overlayIcon.textContent = '❌';
        overlayVerdict.textContent = 'ÉCHEC';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-black uppercase tracking-wider text-amber-500 my-2';
        overlayVal.className = 'font-mono font-black text-6xl sm:text-7xl my-1 tracking-tight text-amber-400 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded-3xl transition-all duration-300 transform bg-slate-900/95 border-2 border-amber-600/70 shadow-2xl';
        overlaySender.className = 'text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 bg-amber-950/80 text-amber-200 border border-amber-800 shadow';

      } else if (d20Val >= 10 && d20Val <= 19) {
        // 10 à 19 : Réussite
        overlayIcon.textContent = '⚔️';
        overlayVerdict.textContent = 'RÉUSSITE';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-black uppercase tracking-wider text-emerald-400 my-2';
        overlayVal.className = 'font-mono font-black text-6xl sm:text-7xl my-1 tracking-tight text-emerald-300 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded-3xl transition-all duration-300 transform bg-slate-900/95 border-2 border-emerald-500/70 shadow-2xl';
        overlaySender.className = 'text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 bg-emerald-950/80 text-emerald-200 border border-emerald-800 shadow';

      } else if (d20Val === 20) {
        // 20 : Réussite Critique + Pluie de confettis !
        overlayIcon.textContent = '👑';
        overlayVerdict.textContent = 'RÉUSSITE CRITIQUE !';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-black uppercase tracking-wider text-amber-300 my-2 drop-shadow-[0_0_25px_rgba(251,191,36,1)]';
        overlayVal.className = 'font-mono font-black text-7xl sm:text-8xl my-1 tracking-tight text-amber-400 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded-3xl transition-all duration-300 transform bg-emerald-950/90 border-4 border-amber-400 shadow-[0_0_70px_rgba(245,158,11,0.9)] crit-glow-success';
        overlaySender.className = 'text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 bg-amber-500 text-slate-950 font-black shadow-lg';

        // Déclenchement des confettis festifs
        if (typeof confetti === 'function') {
          try {
            confetti({
              particleCount: 120,
              spread: 90,
              origin: { y: 0.55 },
              colors: ['#f59e0b', '#10b981', '#38bdf8', '#fbbf24', '#ffffff']
            });
            setTimeout(() => {
              confetti({ particleCount: 80, angle: 60, spread: 65, origin: { x: 0.1, y: 0.6 } });
              confetti({ particleCount: 80, angle: 120, spread: 65, origin: { x: 0.9, y: 0.6 } });
            }, 200);
          } catch (e) {
            console.warn('Erreur confetti :', e);
          }
        }
      }
    } else {
      // Autre type de dé (d6, d10, etc.)
      overlayIcon.textContent = '🎲';
      overlayVerdict.textContent = `TOTAL : ${dice.total}`;
      overlayVerdict.className = 'text-2xl sm:text-3xl font-black uppercase tracking-wider text-sky-400 my-2';
      overlayVal.className = 'font-mono font-black text-6xl my-1 text-slate-100 final-zoom-impact';
      overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded-3xl transition-all duration-300 transform bg-slate-900/95 border-2 border-indigo-500/60 shadow-2xl';
      overlaySender.className = 'text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full mb-3 bg-indigo-950/80 text-indigo-200 border border-indigo-800 shadow';
    }

    // Disparition automatique après 3.2 secondes suivant la révélation
    suspenseTimeout = setTimeout(() => {
      overlayBackdrop.classList.remove('opacity-100');
      overlayBackdrop.classList.add('opacity-0');

      overlayCard.classList.remove('opacity-100', 'scale-100');
      overlayCard.classList.add('opacity-0', 'scale-75');

      setTimeout(() => {
        suspenseOverlay.classList.add('hidden');
        appBody.classList.remove('shake-active');
        overlayVal.classList.remove('final-zoom-impact');
      }, 300);
    }, 3200);

  }, 2000); // 2 secondes d'attente avec machine à sous
}

function emitDiceRoll(formula) {
  if (!formula) return;

  // Récupérer la cible sélectionnée par le MJ dans le combo box
  let target = null;
  if (diceTargetSelect) {
    const selectedVal = diceTargetSelect.value;
    if (selectedVal !== 'all') {
      const slotIndex = Number(selectedVal);
      const char = charactersCache.get(slotIndex);
      target = {
        slot: slotIndex,
        name: char ? char.name : `Slot ${slotIndex + 1}`
      };
    }
  }

  socket.emit('dice:roll', {
    roomId: CURRENT_ROOM,
    sender: getSenderName(),
    isMJ: CURRENT_ROLE === 'mj',
    target,
    formula: formula.trim()
  });
}

// ============================================================
// 5. ÉCOUTEURS D'ÉVÉNEMENTS SOCKET.IO
// ============================================================

socket.on('connect', () => {
  setConnectionStatus(true);

  // Restauration de la session de salle en cas de reconnexion
  if (CURRENT_ROOM && CURRENT_ROLE) {
    socket.emit('room:join', {
      roomId: CURRENT_ROOM,
      username: CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : (CURRENT_USER_NAME || 'Joueur'),
      role: CURRENT_ROLE
    }, (res) => {
      if (res?.characters) {
        updateCharactersGrid(res.characters);
      }
    });
  }

  // Synchronisation des 4 fiches de personnages uniquement si une salle est active
  if (CURRENT_ROOM) {
    socket.emit('char:get_all', { roomId: CURRENT_ROOM }, (response) => {
      if (response?.success && Array.isArray(response.characters)) {
        response.characters.forEach((char) => renderCharacter(char.slot, char));
      }
    });
  }
});

socket.on('disconnect', () => {
  setConnectionStatus(false);
});

// Réception des mises à jour des fiches
socket.on('char:vitals_updated', ({ slot, character }) => {
  renderCharacter(slot, character);
});

// Réception de la synchronisation complète de la liste des personnages (apparition/départ de joueurs)
socket.on('char:sync_all', ({ characters }) => {
  updateCharactersGrid(characters);
});

socket.on('room:user_joined', ({ user, characters }) => {
  if (Array.isArray(characters)) {
    updateCharactersGrid(characters);
  }
});

socket.on('room:user_left', ({ user, characters }) => {
  if (Array.isArray(characters)) {
    updateCharactersGrid(characters);
  }
});

// Événement déclenché lorsque le MJ quitte ou ferme la table
socket.on('room:closed_by_mj', ({ message }) => {
  alert(message || 'Le Maître du Jeu a quitté la table. Vous avez été déconnecté.');
  // Réinitialiser l'état client et renvoyer à l'accueil
  CURRENT_ROOM = null;
  CURRENT_ROLE = null;
  charactersCache.clear();
  const currentRoomEl = document.getElementById('current-room');
  if (currentRoomEl) currentRoomEl.textContent = 'Aucune';
  applyRolePermissions();
  setConnectionStatus(false);
  switchView('home');
});

// Événement de confirmation de sauvegarde de la partie
socket.on('room:saved', ({ roomId, timestamp }) => {
  const timeStr = new Date(timestamp).toLocaleTimeString();
  const btnSaveRoom = document.getElementById('btn-save-room');
  if (btnSaveRoom) {
    btnSaveRoom.innerHTML = '<span>✅</span><span>Sauvegardé !</span>';
    setTimeout(() => {
      btnSaveRoom.innerHTML = '<span>💾</span><span>Sauvegarder</span>';
    }, 2500);
  }
  // Message de confirmation discret dans le chat si présent
  appendChatMessage({
    sender: 'Système',
    text: `📜 La partie "${roomId}" a été sauvegardée par le MJ à ${timeStr}. Les fiches et inventaires sont conservés !`,
    timestamp,
    color: '#10b981',
    isMJ: false
  });
});

// Réception des messages de chat
socket.on('chat:broadcast', appendChatMessage);

// Réception du renommage d'un aventurier : mise à jour instantanée de tous ses anciens messages dans le chat
socket.on('chat:rename_sender', ({ oldName, newName, color }) => {
  if (!chatHistory || !oldName || !newName) return;

  // 1. Mettre à jour tous les messages envoyés avec l'ancien nom
  const messageElements = chatHistory.querySelectorAll(`div[data-sender="${oldName}"]`);
  messageElements.forEach((msgEl) => {
    msgEl.setAttribute('data-sender', newName);
    const nameSpan = msgEl.querySelector('.msg-sender-name');
    if (nameSpan) {
      nameSpan.textContent = newName;
    }
    const headerSpan = msgEl.querySelector('.msg-sender-header');
    if (headerSpan && color) {
      headerSpan.style.color = color;
    }
  });

  // 2. Mettre également à jour l'expéditeur courant si c'est ce joueur
  if (chatSenderInput && chatSenderInput.value === oldName) {
    chatSenderInput.value = newName;
  }
});

// Réception des résultats de dés
socket.on('dice:result', (result) => {
  appendDiceResult(result);
  // Déclenche l'animation centrale cinématographique
  triggerDiceSuspenseAnimation(result);
});

// Réception des mises à jour de l'inventaire en temps réel
socket.on('inv:updated', ({ slot, character, inventory }) => {
  if (character) {
    charactersCache.set(Number(slot), character);
  }
  const card = document.querySelector(`article[data-slot="${slot}"]`);
  if (card) {
    const items = inventory || character?.inventory || [];
    const invGrid = card.querySelector(`.char-inventory-grid[data-slot="${slot}"]`);
    if (invGrid) {
      invGrid.innerHTML = renderInventoryItemsHTML(slot, items);
      const isMJ = CURRENT_ROLE === 'mj';
      invGrid.querySelectorAll('button[data-action="change-item-qty"]').forEach((btn) => {
        btn.style.display = isMJ ? '' : 'none';
      });
    }
    const invCount = card.querySelector(`.char-inv-count[data-slot="${slot}"]`);
    if (invCount) {
      invCount.textContent = `(${items.length})`;
    }
  }
});

// ============================================================
// 6. INITIALISATION DES INTERACTIONS UTILISATEURS
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Gestion des clics sur la barre de navigation SPA
  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      if (targetTab) switchView(targetTab);
    });
  });

  // 1.1 Bouton Sauvegarder la Table pour le MJ
  const btnSaveRoom = document.getElementById('btn-save-room');
  if (btnSaveRoom) {
    btnSaveRoom.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      btnSaveRoom.innerHTML = '<span>⏳</span><span>Sauvegarde...</span>';
      socket.emit('room:save', { roomId: CURRENT_ROOM }, (res) => {
        if (res?.success) {
          btnSaveRoom.innerHTML = '<span>✅</span><span>Sauvegardé !</span>';
          setTimeout(() => {
            btnSaveRoom.innerHTML = '<span>💾</span><span>Sauvegarder</span>';
          }, 2500);
        } else {
          alert(`Erreur lors de la sauvegarde : ${res?.error || 'Inconnue'}`);
          btnSaveRoom.innerHTML = '<span>💾</span><span>Sauvegarder</span>';
        }
      });
    });
  }

  // 2. Boutons +/- des jauges de personnages (Réservé au MJ)
  document.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="vital-change"]');
    if (!button) return;

    if (CURRENT_ROLE !== 'mj') {
      alert('Seul le Maître du Jeu peut modifier les fiches de personnages.');
      return;
    }

    const slot = button.getAttribute('data-slot');
    const type = button.getAttribute('data-type');
    const delta = parseInt(button.getAttribute('data-delta'), 10);

    if (slot === null || isNaN(delta)) return;

    if (type === 'hp') {
      emitVitalsUpdate(slot, delta, 0);
    } else if (type === 'energy') {
      emitVitalsUpdate(slot, 0, delta);
    }
  });

  // 3. Boutons rapides de dés (Réservé au MJ)
  document.addEventListener('click', (event) => {
    const diceBtn = event.target.closest('button[data-quick-dice]');
    if (diceBtn) {
      if (CURRENT_ROLE !== 'mj') {
        alert('Seul le Maître du Jeu a le pouvoir de lancer les dés.');
        return;
      }
      emitDiceRoll(diceBtn.getAttribute('data-quick-dice'));
    }
  });

  // 4. Envoi du chat et détection des commandes /r ou /roll
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      const rollMatch = text.match(/^\/(?:r|roll)\s+(.+)$/i);
      if (rollMatch) {
        if (CURRENT_ROLE !== 'mj') {
          alert('Seul le Maître du Jeu a le pouvoir de lancer les dés.');
          chatInput.value = '';
          return;
        }
        emitDiceRoll(rollMatch[1].trim());
      } else {
        socket.emit('chat:message', {
          roomId: CURRENT_ROOM,
          sender: getSenderName(),
          text,
          color: CURRENT_ROLE === 'mj' ? '#facc15' : currentSelectedColor,
          isMJ: CURRENT_ROLE === 'mj'
        });
      }

      chatInput.value = '';
      chatInput.focus();
    });
  }

  // 5. Ouverture de la modale MJ via le bouton crayon ✏️
  document.addEventListener('click', (event) => {
    const editBtn = event.target.closest('button[data-action="open-edit-modal"]');
    if (!editBtn) return;
    const slot = editBtn.getAttribute('data-slot');
    if (slot !== null) {
      openMjEditModal(slot);
    }
  });

  // Fermeture modale
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeMjEditModal);
  if (btnCancelModal) btnCancelModal.addEventListener('click', closeMjEditModal);

  // Clic à l'extérieur pour fermer
  if (editModal) {
    editModal.addEventListener('click', (e) => {
      if (e.target === editModal) closeMjEditModal();
    });
  }

  // 6. Soumission du formulaire d'édition complète MJ
  if (editForm) {
    editForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const slot = parseInt(editSlotInput.value, 10);
      const name = editNameInput.value.trim();
      const charClass = editClassInput.value.trim();
      const hp = parseInt(editHpInput.value, 10);
      const maxHp = parseInt(editMaxHpInput.value, 10);
      const energy = parseInt(editEnergyInput.value, 10);
      const maxEnergy = parseInt(editMaxEnergyInput.value, 10);

      if (isNaN(slot) || !name || !charClass || isNaN(maxHp) || maxHp <= 0) {
        alert('Veuillez vérifier les champs obligatoires.');
        return;
      }

      // Émission de la mise à jour complète réservée au MJ
      socket.emit('char:update_full', {
        roomId: CURRENT_ROOM,
        slot,
        role: CURRENT_ROLE,
        fields: {
          name,
          class: charClass,
          hp,
          maxHp,
          energy,
          maxEnergy
        }
      }, (response) => {
        if (response?.success) {
          closeMjEditModal();
        } else {
          alert(`Erreur : ${response?.error || 'Échec de la mise à jour'}`);
        }
      });
    });
  }

  // 7. Initialisation de la Forge de Personnage (Création de Héros)
  initCharacterCreationUI();
  updateCharacterPreview();

  const charNameInput = document.getElementById('char-name-input');
  if (charNameInput) {
    charNameInput.addEventListener('input', updateCharacterPreview);
  }

  const charCreateForm = document.getElementById('char-create-form');
  if (charCreateForm) {
    charCreateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = charNameInput?.value.trim();
      if (!name) {
        alert('Veuillez donner un nom à votre héros.');
        return;
      }
      if (!CURRENT_ROOM) {
        alert('Veuillez d\'abord vous connecter à une salle depuis l\'Accueil.');
        return;
      }

      const myChar = getMyCharacter();
      const hasForgedChar = Boolean(myChar && myChar.created);

      const submitBtn = document.getElementById('btn-forge-destiny');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75');
      }

      if (hasForgedChar) {
        // Mode Renommer uniquement : aucun re-calcul d'attributs requis
        socket.emit('char:rename', {
          roomId: CURRENT_ROOM,
          name
        }, (response) => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75');
          }

          if (response?.success) {
            // Mise à jour de l'expéditeur du chat avec le nouveau nom
            if (chatSenderInput) {
              chatSenderInput.value = name;
            }
            updateForgeModeUI();
            switchView('team');
          } else {
            alert(`Erreur : ${response?.error || 'Échec du renommage du héros'}`);
          }
        });
      } else {
        // Mode Création complète : vérification des 20 points
        const pointsRemaining = calculatePointsRemaining();
        if (pointsRemaining > 0) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75');
          }
          alert(`Il vous reste encore ${pointsRemaining} point(s) d'attribut à répartir. Tous les 20 points doivent être dépensés avant de forger votre destin !`);
          return;
        }

        socket.emit('char:create', {
          roomId: CURRENT_ROOM,
          name,
          raceId: currentSelectedRace,
          classId: currentSelectedClass,
          title: getForgedTitle(),
          attributes: { ...currentAttributes },
          color: currentSelectedColor
        }, (response) => {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-75');
          }

          if (response?.success) {
            if (chatSenderInput) {
              chatSenderInput.value = name;
            }
            updateForgeModeUI();
            // Bascule directe sur la vue Équipe avec la nouvelle fiche affichée
            switchView('team');
          } else {
            alert(`Erreur : ${response?.error || 'Échec de la forge du personnage'}`);
          }
        });
      }
    });
  }

  // 8. Gestion du formulaire de connexion au salon (Vue Accueil)
  const joinForm = document.getElementById('join-form');
  const lobbyConsole = document.getElementById('lobby-console');
  const btnClearLobby = document.getElementById('btn-clear-lobby');

  function logLobby(msg, colorClass = 'text-slate-300') {
    if (!lobbyConsole) return;
    const line = document.createElement('div');
    line.className = colorClass;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    lobbyConsole.appendChild(line);
    lobbyConsole.scrollTop = lobbyConsole.scrollHeight;
  }

  if (btnClearLobby && lobbyConsole) {
    btnClearLobby.addEventListener('click', () => {
      lobbyConsole.innerHTML = '<p class="text-slate-500">[Console effacée]</p>';
    });
  }

  if (joinForm) {
    joinForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const roomId = document.getElementById('roomId')?.value.trim() || 'table-ronde';
      const username = document.getElementById('username')?.value.trim();
      const role = document.getElementById('role')?.value || 'player';

      if (!username) {
        logLobby('Veuillez renseigner un pseudo.', 'text-rose-400');
        return;
      }

      logLobby(`Connexion à la salle "${roomId}" en tant que ${username} (${role})...`, 'text-sky-400');

      // Mettre à jour l'expéditeur du chat avec le pseudo et le rôle
      if (chatSenderInput) {
        chatSenderInput.value = username;
      }
      CURRENT_ROLE = role;

      // Émission de l'événement room:join
      socket.emit('room:join', { roomId, username, role }, (res) => {
        if (res?.success) {
          CURRENT_ROOM = roomId;
          logLobby(`Succès ! Salle "${roomId}" rejointe. Total connectés : ${res.room.users.length}`, 'text-emerald-400 font-bold');
          
          // Mise à jour de l'affichage de la salle dans la navbar
          const currentRoomEl = document.getElementById('current-room');
          if (currentRoomEl) currentRoomEl.textContent = roomId;

          // Synchronisation immédiate des fiches de la salle (vide au début pour le MJ, ou avec les joueurs connectés)
          if (Array.isArray(res.characters)) {
            updateCharactersGrid(res.characters);
          } else {
            socket.emit('char:get_all', { roomId: CURRENT_ROOM }, (charRes) => {
              if (charRes?.success && Array.isArray(charRes.characters)) {
                updateCharactersGrid(charRes.characters);
              }
            });
          }

          // Mise à jour des permissions UI selon le rôle (MJ vs Joueur)
          applyRolePermissions();
          setConnectionStatus(true);

          // Si c'est un joueur avec un personnage déjà forgé (partie sauvegardée), l'assigner
          const existingChar = res.character || (Array.isArray(res.characters) ? res.characters.find(c => c.socketId === socket.id || (c.name && c.name.toLowerCase() === username.toLowerCase())) : null);
          const hasForgedChar = existingChar && existingChar.created;

          if (hasForgedChar && charNameInput) {
            charNameInput.value = existingChar.name;
          }

          setTimeout(() => {
            if (CURRENT_ROLE === 'player' && !hasForgedChar) {
              if (charNameInput && !charNameInput.value) {
                charNameInput.value = username;
              }
              updateCharacterPreview();
              switchView('create-char');
            } else {
              switchView('team');
            }
          }, 500);
        } else {
          logLobby(`Erreur : ${res?.error || 'Échec lors de la connexion à la salle.'}`, 'text-rose-400 font-bold');
        }
      });
    });
  }

  // 9. Initialisation de l'Inventaire & Modale d'ajout d'objets (Réservée au MJ)
  function initInventoryUI() {
    let selectedItemFile = null;
    const modalNewItem = document.getElementById('modal-new-item');
    const formNewItem = document.getElementById('form-new-item');
    const itemSlotInput = document.getElementById('item-slot-input');
    const itemNameInput = document.getElementById('item-name-input');
    const itemDescInput = document.getElementById('item-desc-input');
    const itemQtyInput = document.getElementById('item-qty-input');
    const itemFileInput = document.getElementById('item-file-input');
    const itemDropzone = document.getElementById('item-dropzone');
    const dropzoneDefaultPrompt = document.getElementById('dropzone-default-prompt');
    const dropzonePreviewContainer = document.getElementById('dropzone-preview-container');
    const itemPreviewImg = document.getElementById('item-preview-img');
    const itemPreviewName = document.getElementById('item-preview-name');
    const btnRemoveItemImg = document.getElementById('btn-remove-item-img');
    const btnCloseNewItemModal = document.getElementById('btn-close-new-item-modal');
    const btnCancelNewItem = document.getElementById('btn-cancel-new-item');
    const btnSubmitNewItem = document.getElementById('btn-submit-new-item');
    const btnSubmitItemText = document.getElementById('btn-submit-item-text');
    const modalItemSlotLabel = document.getElementById('modal-item-slot-label');

    function openAddItemModal(slot) {
      if (CURRENT_ROLE !== 'mj') {
        alert('Seul le Maître du Jeu peut forger et ajouter des objets aux inventaires.');
        return;
      }
      const char = charactersCache.get(Number(slot));
      if (modalItemSlotLabel) {
        modalItemSlotLabel.textContent = char ? `Pour ${char.name} (${char.class})` : `Pour le Slot #${Number(slot) + 1}`;
      }
      if (itemSlotInput) itemSlotInput.value = slot;
      if (itemNameInput) itemNameInput.value = '';
      if (itemDescInput) itemDescInput.value = '';
      if (itemQtyInput) itemQtyInput.value = '1';
      resetItemFilePreview();
      if (modalNewItem) modalNewItem.classList.remove('hidden');
    }

    function closeAddItemModal() {
      if (modalNewItem) modalNewItem.classList.add('hidden');
      resetItemFilePreview();
    }

    function resetItemFilePreview() {
      selectedItemFile = null;
      if (itemFileInput) itemFileInput.value = '';
      if (dropzoneDefaultPrompt) dropzoneDefaultPrompt.classList.remove('hidden');
      if (dropzonePreviewContainer) dropzonePreviewContainer.classList.add('hidden');
      if (itemPreviewImg) itemPreviewImg.src = '';
      if (itemPreviewName) itemPreviewName.textContent = '';
    }

    function handleFileSelected(file) {
      if (!file || !file.type.startsWith('image/')) {
        alert('Veuillez sélectionner un fichier image valide (PNG, JPEG, WEBP).');
        return;
      }
      selectedItemFile = file;
      if (dropzoneDefaultPrompt) dropzoneDefaultPrompt.classList.add('hidden');
      if (dropzonePreviewContainer) dropzonePreviewContainer.classList.remove('hidden');
      if (itemPreviewImg) itemPreviewImg.src = URL.createObjectURL(file);
      if (itemPreviewName) itemPreviewName.textContent = file.name;
    }

    if (itemDropzone) {
      itemDropzone.addEventListener('click', () => {
        if (itemFileInput) itemFileInput.click();
      });
      itemDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        itemDropzone.classList.add('border-amber-400', 'bg-stone-900');
      });
      itemDropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        itemDropzone.classList.remove('border-amber-400', 'bg-stone-900');
      });
      itemDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        itemDropzone.classList.remove('border-amber-400', 'bg-stone-900');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFileSelected(e.dataTransfer.files[0]);
        }
      });
    }

    if (itemFileInput) {
      itemFileInput.addEventListener('change', () => {
        if (itemFileInput.files && itemFileInput.files.length > 0) {
          handleFileSelected(itemFileInput.files[0]);
        }
      });
    }

    if (btnRemoveItemImg) {
      btnRemoveItemImg.addEventListener('click', (e) => {
        e.stopPropagation();
        resetItemFilePreview();
      });
    }

    if (btnCloseNewItemModal) btnCloseNewItemModal.addEventListener('click', closeAddItemModal);
    if (btnCancelNewItem) btnCancelNewItem.addEventListener('click', closeAddItemModal);

    if (modalNewItem) {
      modalNewItem.addEventListener('click', (e) => {
        if (e.target === modalNewItem) closeAddItemModal();
      });
    }

    // Clics délégués sur les cartes d'inventaire
    document.addEventListener('click', (event) => {
      // 1. Ouvrir la modale d'ajout
      const openBtn = event.target.closest('button[data-action="open-add-item-modal"]');
      if (openBtn) {
        const slot = openBtn.getAttribute('data-slot');
        if (slot !== null) openAddItemModal(slot);
        return;
      }

      // 2. Jeter un objet [x]
      const removeBtn = event.target.closest('button[data-action="remove-item"]');
      if (removeBtn) {
        const slot = removeBtn.getAttribute('data-slot');
        const itemId = removeBtn.getAttribute('data-item-id');
        if (slot !== null && itemId) {
          if (confirm('Voulez-vous vraiment jeter cet objet de votre besace ?')) {
            socket.emit('inv:remove_item', {
              roomId: CURRENT_ROOM,
              slot: Number(slot),
              itemId
            });
          }
        }
        return;
      }

      // 3. Modifier la quantité (+/-)
      const changeQtyBtn = event.target.closest('button[data-action="change-item-qty"]');
      if (changeQtyBtn) {
        if (CURRENT_ROLE !== 'mj') {
          alert('Seul le Maître du Jeu peut modifier la quantité des objets.');
          return;
        }
        const slot = changeQtyBtn.getAttribute('data-slot');
        const itemId = changeQtyBtn.getAttribute('data-item-id');
        const delta = parseInt(changeQtyBtn.getAttribute('data-delta'), 10);
        if (slot !== null && itemId && !isNaN(delta)) {
          socket.emit('inv:update_qty', {
            roomId: CURRENT_ROOM,
            slot: Number(slot),
            itemId,
            delta
          });
        }
        return;
      }
    });

    // Soumission du formulaire d'ajout d'objet
    if (formNewItem) {
      formNewItem.addEventListener('submit', async (e) => {
        e.preventDefault();
        const slot = parseInt(itemSlotInput.value, 10);
        const name = itemNameInput.value.trim();
        const desc = itemDescInput.value.trim();
        const qty = Math.max(1, parseInt(itemQtyInput.value, 10) || 1);

        if (!name) {
          alert('Veuillez renseigner un nom pour l\'objet.');
          return;
        }

        if (btnSubmitNewItem) btnSubmitNewItem.disabled = true;
        if (btnSubmitItemText) btnSubmitItemText.textContent = 'Envoi...';

        let imgUrl = null;
        try {
          if (selectedItemFile) {
            if (btnSubmitItemText) btnSubmitItemText.textContent = 'Compression WebP...';
            imgUrl = await compressAndUploadImage(selectedItemFile);
          }

          if (btnSubmitItemText) btnSubmitItemText.textContent = 'Forgé !';

          socket.emit('inv:add_item', {
            roomId: CURRENT_ROOM,
            slot,
            item: {
              name,
              desc,
              qty,
              imgUrl
            }
          }, (response) => {
            if (btnSubmitNewItem) btnSubmitNewItem.disabled = false;
            if (btnSubmitItemText) btnSubmitItemText.textContent = 'Forger l\'Objet';

            if (response?.success) {
              closeAddItemModal();
            } else {
              alert(`Erreur : ${response?.error || 'Échec de l\'ajout de l\'objet'}`);
            }
          });
        } catch (err) {
          console.error('[Inventory Error]', err);
          alert(`Erreur lors du traitement de l'image : ${err.message}`);
          if (btnSubmitNewItem) btnSubmitNewItem.disabled = false;
          if (btnSubmitItemText) btnSubmitItemText.textContent = 'Forger l\'Objet';
        }
      });
    }
  }

  // Initialisation de la gestion d'inventaire
  initInventoryUI();

  // Application initiale des permissions de rôle
  applyRolePermissions();
});
