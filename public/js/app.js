/**
 * Foundry Lite - Application Client SPA Temps Réel
 */

// Initialisation du client Socket.io (reste ouvert en permanence entre les vues SPA)
const socket = io();

// Configuration de la salle et rôle du client actuel (défini lors de la création / connexion)
let CURRENT_ROOM = null;
let CURRENT_ROLE = 'player';
let CURRENT_USER_NAME = '';
let myAssignedSlot = null;

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

  // Si on passe sur la Carte Tactique, rafraîchir l'affichage du Canvas
  if (tabId === 'map') {
    if (typeof initOrRefreshTacticalMap === 'function') {
      initOrRefreshTacticalMap();
    }
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

  // 5.2 Outils de Carte Tactique et Brouillard de guerre (Réservés au MJ)
  const mjFogTools = document.getElementById('mj-fog-tools');
  const mjWallTools = document.getElementById('mj-wall-tools');
  const mjMapActions = document.getElementById('mj-map-actions');
  if (mjFogTools) {
    if (isJoined && isMJ) {
      mjFogTools.classList.remove('hidden');
      mjFogTools.classList.add('flex');
    } else {
      mjFogTools.classList.remove('flex');
      mjFogTools.classList.add('hidden');
    }
  }
  if (mjWallTools) {
    if (isJoined && isMJ) {
      mjWallTools.classList.remove('hidden');
      mjWallTools.classList.add('flex');
    } else {
      mjWallTools.classList.remove('flex');
      mjWallTools.classList.add('hidden');
    }
  }
  if (mjMapActions) {
    if (isJoined && isMJ) {
      mjMapActions.classList.remove('hidden');
      mjMapActions.classList.add('flex');
    } else {
      mjMapActions.classList.remove('flex');
      mjMapActions.classList.add('hidden');
    }
  }

  // 5.2.1 Bouton Tour Suivant rapide (visible pour le MJ)
  const btnNextTurn = document.getElementById('btn-next-turn');
  if (btnNextTurn) {
    if (isJoined && isMJ) {
      btnNextTurn.classList.remove('hidden');
      btnNextTurn.classList.add('inline-flex');
    } else {
      btnNextTurn.classList.remove('inline-flex');
      btnNextTurn.classList.add('hidden');
    }
  }

  // 5.3 Actualisation du brouillard de guerre pour refléter immédiatement le rôle (MJ semi-transparent vs Joueur opaque)
  if (typeof rebuildFogCanvas === 'function') {
    rebuildFogCanvas();
  }
  if (typeof requestMapRender === 'function') {
    requestMapRender();
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

  const isCurrentTurn = Boolean(
    tacticalMapState.currentTurn && (
      (typeof tacticalMapState.currentTurn.slot === 'number' && Number(char.slot) === Number(tacticalMapState.currentTurn.slot)) ||
      (char.name && tacticalMapState.currentTurn.name && char.name.toLowerCase() === tacticalMapState.currentTurn.name.toLowerCase())
    )
  );

  return `
    <article data-slot="${char.slot}" class="stone-card rpg-panel rpg-corner-brackets ${isCurrentTurn ? 'active-turn-card' : ''} p-5 shadow-2xl flex flex-col justify-between hover:brightness-105 transition duration-200" style="border-color: ${charColor}aa; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.85), inset 0 0 25px rgba(0,0,0,0.9), 0 0 15px ${charColor}25;">
      <div>
        <div class="flex items-center justify-between mb-4 border-b-2 border-double border-[#78350f]/80 pb-3">
          <div class="flex items-center gap-3">
            <span class="w-10 h-10 bg-[#080706] font-cinzel text-lg font-bold flex items-center justify-center border-2 shadow-inner" style="border-color: ${charColor}; color: ${charColor};">
              ${char.raceIcon || '🛡️'}
            </span>
            <div>
              <h3 class="char-name font-cinzel-dec font-bold text-base tracking-wide flex items-center gap-2" style="color: ${charColor};">
                <span>${escapeHtml(char.name)}</span>
                <span class="w-2.5 h-2.5 rounded-full inline-block shadow-sm" style="background-color: ${charColor};" title="Couleur de sceau"></span>
              </h3>
              ${char.title ? `<div class="font-cinzel text-[11px] font-bold text-[#fde047] italic tracking-wider">${escapeHtml(char.title)}</div>` : ''}
              <span class="char-class font-crimson text-xs italic font-medium text-amber-300/90">
                ${escapeHtml(char.race ? `${char.race} ` : '')}${escapeHtml(char.class)}${char.role ? ` — ${escapeHtml(char.role)}` : ''}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button type="button" data-action="open-edit-modal" data-slot="${char.slot}" title="Modifier le personnage (MJ)" class="rpg-btn p-1.5 text-xs text-stone-400 hover:text-[#fde047] cursor-pointer" style="display: ${isMJ ? '' : 'none'};">
              ✏️
            </button>
            <span class="text-[10px] font-cinzel font-bold uppercase px-2.5 py-1 bg-[#080706] border shadow-inner" style="border-color: ${charColor}80; color: ${charColor};">Aventurier ${Number(char.slot) + 1}</span>
          </div>
        </div>

        ${char.passive ? `
          <div class="mb-2.5 px-3 py-1.5 rpg-parchment-dark border border-[#573c24] flex items-center gap-2 text-[11px] text-amber-200/90 shadow-inner">
            <span class="text-xs">⚜️</span>
            <span class="font-cinzel font-bold text-amber-300">${escapeHtml(char.passive.name || '')}</span>
          </div>
        ` : ''}

        ${char.attributes ? `
          <div class="mb-3 px-2.5 py-1.5 bg-[#080706] border border-[#44281d] grid grid-cols-4 gap-1 text-center font-mono text-[11px] shadow-inner">
            <div class="border-r border-[#292524]"><span class="text-stone-400 block text-[9px] font-cinzel font-bold">FOR</span><span class="font-bold text-red-300">${char.attributes.force ?? 8}</span></div>
            <div class="border-r border-[#292524]"><span class="text-stone-400 block text-[9px] font-cinzel font-bold">DEX</span><span class="font-bold text-emerald-300">${char.attributes.dexterite ?? 8}</span></div>
            <div class="border-r border-[#292524]"><span class="text-stone-400 block text-[9px] font-cinzel font-bold">INT</span><span class="font-bold text-sky-300">${char.attributes.intelligence ?? 8}</span></div>
            <div><span class="text-stone-400 block text-[9px] font-cinzel font-bold">CHA</span><span class="font-bold text-purple-300">${char.attributes.charisme ?? 8}</span></div>
          </div>
        ` : ''}

        <!-- Jauge PV (Fiole de Sang Épaisse) -->
        <div class="space-y-1.5 mb-5">
          <div class="flex justify-between text-xs font-medium">
            <span class="text-rose-400 font-semibold font-cinzel flex items-center gap-1.5">
              <span>❤️</span>
              <span>Points de Vie</span>
            </span>
            <span class="hp-text font-mono text-stone-200 font-bold">${char.hp} / ${char.maxHp}</span>
          </div>
          <div class="w-full rpg-vial-tube h-4 p-0.5">
            <div class="hp-bar vial-blood ${hpPercent <= 25 ? 'vial-blood-critical' : ''} h-full shimmer-active transition-all duration-300 ease-out" style="width: ${hpPercent}%;"></div>
          </div>
          <div class="flex items-center justify-end gap-1.5 pt-1">
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="-5" class="rpg-btn rpg-btn-blood px-2 py-0.5 text-xs font-bold" style="display: ${isMJ ? '' : 'none'};">-5</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="-1" class="rpg-btn rpg-btn-blood px-2.5 py-0.5 text-xs font-bold" style="display: ${isMJ ? '' : 'none'};">-1</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="1" class="rpg-btn rpg-btn-blood px-2.5 py-0.5 text-xs font-bold" style="display: ${isMJ ? '' : 'none'};">+1</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="hp" data-delta="5" class="rpg-btn rpg-btn-blood px-2 py-0.5 text-xs font-bold" style="display: ${isMJ ? '' : 'none'};">+5</button>
          </div>
        </div>

        <!-- Jauge Énergie (Fiole d'Éther Arcanique) -->
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs font-medium">
            <span class="text-sky-400 font-semibold font-cinzel flex items-center gap-1.5">
              <span>⚡</span>
              <span>Énergie / Mana</span>
            </span>
            <span class="energy-text font-mono text-stone-200 font-bold">${char.energy} / ${char.maxEnergy}</span>
          </div>
          <div class="w-full rpg-vial-tube h-4 p-0.5">
            <div class="energy-bar vial-ether h-full shimmer-active transition-all duration-300 ease-out" style="width: ${energyPercent}%;"></div>
          </div>
          <div class="flex items-center justify-end gap-1.5 pt-1">
            <button data-action="vital-change" data-slot="${char.slot}" data-type="energy" data-delta="-1" class="rpg-btn rpg-btn-ether px-2.5 py-0.5 text-xs font-bold" style="display: ${isMJ ? '' : 'none'};">-1</button>
            <button data-action="vital-change" data-slot="${char.slot}" data-type="energy" data-delta="1" class="rpg-btn rpg-btn-ether px-2.5 py-0.5 text-xs font-bold" style="display: ${isMJ ? '' : 'none'};">+1</button>
          </div>
        </div>

        <!-- Section Inventaire du Héros -->
        <div class="mt-4 pt-3 border-t border-[#78350f]/60 space-y-2">
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
              class="btn-add-item rpg-btn rpg-btn-gold px-2.5 py-0.5 text-[10px] font-cinzel font-bold uppercase tracking-wider cursor-pointer flex items-center gap-1"
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
      <div id="no-players-message" class="col-span-full flex flex-col items-center justify-center p-12 rpg-panel rpg-corner-brackets border-2 border-stone-800 text-center space-y-3">
        <div class="w-14 h-14 rounded border border-amber-800/60 bg-stone-950 flex items-center justify-center text-3xl shadow-inner text-amber-500">
          ⏳
        </div>
        <h3 class="font-bold font-cinzel text-amber-200 text-base">En attente de vos aventuriers...</h3>
        <p class="text-xs text-stone-400 font-crimson max-w-sm leading-relaxed">
          La salle est prête. Dès qu'un héros rejoint la quête (jusqu'à 4 aventuriers), sa plaque de personnage forgée sera automatiquement générée et affichée ici en temps réel.
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

  // Si un tour est en cours, réactiver l'aura dorée sur la fiche concernée
  if (tacticalMapState.currentTurn) {
    updateTurnDisplay(tacticalMapState.currentTurn);
  }

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

  // Mise à jour de la bordure et de l'ombre forgée de la carte avec la couleur du joueur
  card.style.borderColor = `${charColor}aa`;
  card.style.boxShadow = `0 10px 25px -5px rgba(0,0,0,0.85), inset 0 0 25px rgba(0,0,0,0.9), 0 0 15px ${charColor}25`;

  // Vérifier si c'est le tour de ce personnage
  const isCurrentTurn = Boolean(
    tacticalMapState.currentTurn && (
      (typeof tacticalMapState.currentTurn.slot === 'number' && Number(slot) === Number(tacticalMapState.currentTurn.slot)) ||
      (char.name && tacticalMapState.currentTurn.name && char.name.toLowerCase() === tacticalMapState.currentTurn.name.toLowerCase())
    )
  );
  if (isCurrentTurn) {
    card.classList.add('active-turn-card');
  } else {
    card.classList.remove('active-turn-card');
  }

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

  // Jauge PV (Fiole de Sang Sculptée)
  const hpText = card.querySelector('.hp-text');
  const hpBar = card.querySelector('.hp-bar');
  if (hpText) hpText.textContent = `${char.hp} / ${char.maxHp}`;
  if (hpBar) {
    hpBar.style.width = `${hpPercent}%`;
    if (hpPercent <= 25) {
      hpBar.className = 'hp-bar vial-blood vial-blood-critical h-full shimmer-active transition-all duration-300 ease-out';
    } else {
      hpBar.className = 'hp-bar vial-blood h-full shimmer-active transition-all duration-300 ease-out';
    }
  }

  // Jauge Énergie (Fiole d'Éther Sculptée)
  const energyText = card.querySelector('.energy-text');
  const energyBar = card.querySelector('.energy-bar');
  if (energyText) energyText.textContent = `${char.energy} / ${char.maxEnergy}`;
  if (energyBar) {
    energyBar.style.width = `${energyPercent}%`;
    energyBar.className = 'energy-bar vial-ether h-full shimmer-active transition-all duration-300 ease-out';
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
  msgEl.className = isMJ 
    ? 'rpg-chat-msg-gm rounded p-3 mb-2 transition' 
    : 'rpg-chat-msg rounded p-3 mb-2 transition';
  msgEl.setAttribute('data-sender', sender);

  // Si l'émetteur est le MJ : couleur jaune dorée #facc15 et couronne 👑
  const senderColor = isMJ ? '#facc15' : (color || '#d4af37');
  const mjCrownBadge = isMJ ? '<span class="text-xs" title="Maître du Jeu">👑</span>' : '';

  msgEl.innerHTML = `
    <div class="flex items-center justify-between mb-1">
      <span class="font-bold font-cinzel text-xs flex items-center gap-1.5 msg-sender-header" style="color: ${senderColor};">
        ${mjCrownBadge}
        <span class="msg-sender-name">${escapeHtml(sender)}</span>
      </span>
      <span class="text-[10px] text-stone-500 font-mono">${formatTime(timestamp)}</span>
    </div>
    <p class="text-stone-200 text-xs sm:text-sm font-crimson break-words leading-relaxed">${escapeHtml(text)}</p>
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

  const senderColor = isMJ ? '#facc15' : (color || '#d4af37');
  const mjCrownBadge = isMJ ? '<span class="text-xs" title="Maître du Jeu">👑</span> ' : '';

  const targetBadge = target ? `<span class="ml-1.5 px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 font-semibold text-[10px] border border-amber-600/50">➔ ${escapeHtml(target.name)}</span>` : '';

  if (isCriticalSuccess) {
    // 20 Naturel (Réussite critique)
    rollEl.className = 'rpg-dice-card-crit-success rounded p-3 mb-2';
    rollEl.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-bold font-cinzel text-xs" style="color: ${senderColor};">🎲 ${mjCrownBadge}${escapeHtml(sender)} lance <span class="font-mono underline text-emerald-300">${formula}</span>${targetBadge}</span>
        <span class="text-[10px] text-emerald-400/80 font-mono">${timeStr}</span>
      </div>
      <div class="bg-emerald-950/70 text-emerald-200 text-center py-1.5 rounded font-cinzel font-black text-xs uppercase tracking-wider my-1 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
        ✨ 20 NATUREL ! RÉUSSITE CRITIQUE ! ✨
      </div>
      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-emerald-800/60 text-xs">
        <span class="text-emerald-300/80 font-mono text-[11px]">Détail : ${rollsDetail}${modStr}</span>
        <span class="text-2xl font-black text-emerald-300 font-mono">${total}</span>
      </div>
    `;
  } else if (isCriticalFailure) {
    // 1 Naturel (Échec critique)
    rollEl.className = 'rpg-dice-card-crit-fail rounded p-3 mb-2';
    rollEl.innerHTML = `
      <div class="flex items-center justify-between mb-1.5">
        <span class="font-bold font-cinzel text-xs" style="color: ${senderColor};">🎲 ${mjCrownBadge}${escapeHtml(sender)} lance <span class="font-mono underline text-rose-300">${formula}</span>${targetBadge}</span>
        <span class="text-[10px] text-rose-400/80 font-mono">${timeStr}</span>
      </div>
      <div class="bg-rose-950/70 text-rose-200 text-center py-1.5 rounded font-cinzel font-black text-xs uppercase tracking-wider my-1 border border-rose-500/50 shadow-[0_0_10px_rgba(225,29,72,0.3)]">
        💀 1 NATUREL ! ÉCHEC CRITIQUE ! 💀
      </div>
      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-rose-800/60 text-xs">
        <span class="text-rose-300/80 font-mono text-[11px]">Détail : ${rollsDetail}${modStr}</span>
        <span class="text-2xl font-black text-rose-300 font-mono">${total}</span>
      </div>
    `;
  } else {
    // Tirage normal
    rollEl.className = 'rpg-dice-card rounded p-3 mb-2';
    rollEl.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="font-bold font-cinzel text-xs" style="color: ${senderColor};">🎲 ${mjCrownBadge}${escapeHtml(sender)} lance <span class="font-mono text-amber-300 font-bold">${formula}</span>${targetBadge}</span>
        <span class="text-[10px] text-stone-500 font-mono">${timeStr}</span>
      </div>
      <div class="flex items-center justify-between mt-1 text-xs">
        <span class="text-stone-400 font-mono text-[11px]">Détail : <span class="text-stone-200">${rollsDetail}</span>${modStr}</span>
        <span class="text-lg font-bold text-amber-400 font-mono px-2.5 py-0.5 rounded bg-stone-950 border border-stone-800">${total}</span>
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
  appBody.classList.remove('shake-active', 'shake-subtle-active');
  overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded rpg-panel rpg-corner-brackets border-2 border-amber-900/80 transition-all duration-300 transform shadow-2xl';
  overlayVal.className = 'font-mono font-black text-6xl sm:text-7xl my-1 tracking-tight text-amber-400 slot-rolling';

  // Remplir le nom de l'expéditeur et la cible
  const targetLabel = dice.target ? ` ➔ pour ${dice.target.name}` : '';
  overlaySender.className = 'text-xs uppercase font-cinzel font-bold tracking-widest px-3 py-1 rounded mb-3 bg-stone-900 text-amber-200 border border-amber-800/80 shadow';
  overlaySender.textContent = dice.isMJ ? `👑 Le Maître du Jeu${targetLabel}` : `🎲 ${dice.sender}${targetLabel}`;
  overlaySub.textContent = `Formule : ${dice.formula}`;

  // État d'attente Casino (Machine à sous)
  overlayIcon.textContent = '🎲';
  overlayVerdict.textContent = 'LE SORT EN EST JETÉ...';
  overlayVerdict.className = 'text-xl sm:text-2xl font-cinzel font-black uppercase tracking-wider text-amber-400/90 my-2 animate-pulse';

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
        // 1 : Échec Critique + pulsation rouge sang sinistre + voile de fumée
        overlayIcon.textContent = '💀';
        overlayVerdict.textContent = 'ÉCHEC CRITIQUE !';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-cinzel font-black uppercase tracking-wider text-rose-500 my-2 drop-shadow-[0_0_20px_rgba(244,63,94,0.9)]';
        overlayVal.className = 'font-mono font-black text-7xl sm:text-8xl my-1 tracking-tight text-rose-400 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded rpg-panel rpg-corner-brackets transition-all duration-300 transform border-2 border-rose-600 shadow-[0_0_60px_rgba(225,29,72,0.8)] fumble-blood-active';
        overlaySender.className = 'text-xs uppercase font-cinzel font-bold tracking-widest px-3 py-1 rounded mb-3 bg-rose-950 text-rose-200 border border-rose-800 shadow';

        // Léger voile de fumée sombre
        const smokeOverlay = document.createElement('div');
        smokeOverlay.className = 'fumble-smoke-overlay';
        document.body.appendChild(smokeOverlay);
        setTimeout(() => smokeOverlay.remove(), 1400);

      } else if (d20Val >= 2 && d20Val <= 9) {
        // 2 à 9 : Échec
        overlayIcon.textContent = '❌';
        overlayVerdict.textContent = 'ÉCHEC';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-cinzel font-black uppercase tracking-wider text-amber-600/90 my-2';
        overlayVal.className = 'font-mono font-black text-6xl sm:text-7xl my-1 tracking-tight text-amber-500/90 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded rpg-panel rpg-corner-brackets transition-all duration-300 transform border-2 border-stone-700 shadow-2xl';
        overlaySender.className = 'text-xs uppercase font-cinzel font-bold tracking-widest px-3 py-1 rounded mb-3 bg-stone-900 text-stone-300 border border-stone-800 shadow';

      } else if (d20Val >= 10 && d20Val <= 19) {
        // 10 à 19 : Réussite
        overlayIcon.textContent = '⚔️';
        overlayVerdict.textContent = 'RÉUSSITE';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-cinzel font-black uppercase tracking-wider text-emerald-400 my-2';
        overlayVal.className = 'font-mono font-black text-6xl sm:text-7xl my-1 tracking-tight text-emerald-300 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded rpg-panel rpg-corner-brackets transition-all duration-300 transform border-2 border-emerald-800 shadow-2xl';
        overlaySender.className = 'text-xs uppercase font-cinzel font-bold tracking-widest px-3 py-1 rounded mb-3 bg-emerald-950 text-emerald-200 border border-emerald-800 shadow';

      } else if (d20Val === 20) {
        // 20 : Réussite Critique + Flash doré éclatant + Secousse subtile (3px) + Particules radiales
        overlayIcon.textContent = '👑';
        overlayVerdict.textContent = 'RÉUSSITE CRITIQUE !';
        overlayVerdict.className = 'text-3xl sm:text-4xl font-cinzel font-black uppercase tracking-wider text-amber-300 my-2 drop-shadow-[0_0_25px_rgba(251,191,36,1)]';
        overlayVal.className = 'font-mono font-black text-7xl sm:text-8xl my-1 tracking-tight text-amber-300 final-zoom-impact';
        overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded rpg-panel rpg-corner-brackets rpg-panel-gold transition-all duration-300 transform shadow-[0_0_70px_rgba(245,158,11,0.9)]';
        overlaySender.className = 'text-xs uppercase font-cinzel font-bold tracking-widest px-3 py-1 rounded mb-3 bg-amber-500 text-stone-950 font-black shadow-lg';

        // Flash doré éclatant en superposition
        const goldFlash = document.createElement('div');
        goldFlash.className = 'crit-flash-gold';
        document.body.appendChild(goldFlash);
        setTimeout(() => goldFlash.remove(), 900);

        // Secousse d'écran subtile (3px)
        appBody.classList.add('shake-subtle-active');

        // Déclenchement des confettis / étincelles magiques festifs
        if (typeof confetti === 'function') {
          try {
            confetti({
              particleCount: 120,
              spread: 90,
              origin: { y: 0.55 },
              colors: ['#d4af37', '#fde047', '#b45309', '#38bdf8', '#ffffff']
            });
            setTimeout(() => {
              confetti({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0.1, y: 0.6 } });
              confetti({ particleCount: 70, angle: 120, spread: 65, origin: { x: 0.9, y: 0.6 } });
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
      overlayVerdict.className = 'text-2xl sm:text-3xl font-cinzel font-black uppercase tracking-wider text-amber-300 my-2';
      overlayVal.className = 'font-mono font-black text-6xl my-1 text-stone-100 final-zoom-impact';
      overlayCard.className = 'relative z-10 max-w-md w-full flex flex-col items-center text-center p-8 rounded rpg-panel rpg-corner-brackets transition-all duration-300 transform border-2 border-amber-900/60 shadow-2xl';
      overlaySender.className = 'text-xs uppercase font-cinzel font-bold tracking-widest px-3 py-1 rounded mb-3 bg-stone-900 text-amber-200 border border-amber-800/80 shadow';
    }

    // Disparition automatique après 3.2 secondes suivant la révélation
    suspenseTimeout = setTimeout(() => {
      overlayBackdrop.classList.remove('opacity-100');
      overlayBackdrop.classList.add('opacity-0');

      overlayCard.classList.remove('opacity-100', 'scale-100');
      overlayCard.classList.add('opacity-0', 'scale-75');

      setTimeout(() => {
        suspenseOverlay.classList.add('hidden');
        appBody.classList.remove('shake-active', 'shake-subtle-active');
        overlayCard.classList.remove('fumble-blood-active');
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
      if (res?.map && typeof updateTacticalMapState === 'function') {
        updateTacticalMapState(res.map);
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
  if (typeof syncTokenVitals === 'function') {
    syncTokenVitals(slot, character);
  }
});

// Réception de la synchronisation complète de la liste des personnages (apparition/départ de joueurs)
socket.on('char:sync_all', ({ characters }) => {
  updateCharactersGrid(characters);
  if (typeof syncTokensFromCharacters === 'function') {
    syncTokensFromCharacters(characters);
  }
});

socket.on('room:user_joined', ({ user, characters }) => {
  if (Array.isArray(characters)) {
    updateCharactersGrid(characters);
    if (typeof syncTokensFromCharacters === 'function') {
      syncTokensFromCharacters(characters);
    }
  }
});

socket.on('room:user_left', ({ user, characters }) => {
  if (Array.isArray(characters)) {
    updateCharactersGrid(characters);
    if (typeof syncTokensFromCharacters === 'function') {
      syncTokensFromCharacters(characters);
    }
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
// 5.1 ÉCOUTEURS D'ÉVÉNEMENTS CARTE TACTIQUE (BATTLEMAP & FOG)
// ============================================================

// Mise à jour de l'image de fond de la Battlemap
socket.on('map:background_updated', ({ backgroundUrl }) => {
  tacticalMapState.backgroundUrl = backgroundUrl;
  loadBackgroundImage(backgroundUrl);
});

// Déplacement d'un pion émis par un autre joueur ou par le MJ
socket.on('map:token_moved', ({ tokenId, x, y }) => {
  const token = (tacticalMapState.tokens || []).find((t) => t.id === tokenId);
  if (token) {
    token.x = x;
    token.y = y;
    requestMapRender();
  }
});

// Ajout d'un nouveau pion (Monstre ou PNJ) par le MJ
socket.on('map:token_added', ({ token }) => {
  if (token && !tacticalMapState.tokens.some((t) => t.id === token.id)) {
    tacticalMapState.tokens.push(token);
    requestMapRender();
  }
});

// Suppression d'un pion de la carte par le MJ
socket.on('map:token_removed', ({ tokenId }) => {
  tacticalMapState.tokens = (tacticalMapState.tokens || []).filter((t) => t.id !== tokenId);
  if (hoveredToken && hoveredToken.id === tokenId) {
    hoveredToken = null;
    hideMapTooltip();
  }
  requestMapRender();
});

// Révélation d'une zone du brouillard de guerre par le MJ
socket.on('map:fog_revealed', ({ area }) => {
  if (area) {
    tacticalMapState.revealedAreas.push(area);
    rebuildFogCanvas();
    requestMapRender();
  }
});

// Réinitialisation complète du brouillard de guerre
socket.on('map:fog_reset', () => {
  tacticalMapState.revealedAreas = [];
  rebuildFogCanvas();
  requestMapRender();
});

// Mise à jour des réglages de la carte (grille, aimant, brouillard)
socket.on('map:settings_updated', (settings) => {
  if (typeof settings.gridSize === 'number') tacticalMapState.gridSize = settings.gridSize;
  if (typeof settings.snapToGrid === 'boolean') tacticalMapState.snapToGrid = settings.snapToGrid;
  if (typeof settings.fogEnabled === 'boolean') tacticalMapState.fogEnabled = settings.fogEnabled;
  updateMapSettingsUI();
  rebuildFogCanvas();
  requestMapRender();
});

// Réception du changement de tour de jeu émis par le MJ
socket.on('turn:changed', ({ currentTurn }) => {
  if (currentTurn) {
    tacticalMapState.currentTurn = currentTurn;
    if (typeof updateTurnDisplay === 'function') {
      updateTurnDisplay(currentTurn);
    }

    const isMyTurn = (CURRENT_ROLE === 'player') && (
      (typeof myAssignedSlot === 'number' && currentTurn.slot === myAssignedSlot) ||
      (CURRENT_USER_NAME && currentTurn.name && currentTurn.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase())
    );

    if (isMyTurn) {
      if (typeof playTurnChime === 'function') playTurnChime();
      if (typeof showTurnNotificationAlert === 'function') showTurnNotificationAlert(currentTurn);
    }

    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

// Réception d'une réglette ou d'un gabarit de sort émis par un autre joueur ou le MJ
socket.on('map:measured', (data) => {
  if (data && data.socketId) {
    remoteMeasurements.set(data.socketId, data);
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

// Effacement de la réglette ou du gabarit de sort distant
socket.on('map:measure_cleared', ({ socketId }) => {
  if (socketId && remoteMeasurements.has(socketId)) {
    remoteMeasurements.delete(socketId);
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

// Événements de synchronisation des Murs (rectilignes)
socket.on('map:wall_added', ({ wall }) => {
  if (wall) {
    if (!Array.isArray(tacticalMapState.walls)) tacticalMapState.walls = [];
    tacticalMapState.walls.push(wall);
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

socket.on('map:wall_removed', ({ wallId }) => {
  if (wallId && Array.isArray(tacticalMapState.walls)) {
    tacticalMapState.walls = tacticalMapState.walls.filter((w) => w.id !== wallId);
    if (hoveredWall && hoveredWall.id === wallId) hoveredWall = null;
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

socket.on('map:walls_cleared', () => {
  tacticalMapState.walls = [];
  hoveredWall = null;
  if (typeof requestMapRender === 'function') requestMapRender();
});

/**
 * Synchronise les jauges de vie d'un pion joueur quand sa fiche change
 */
function syncTokenVitals(slot, character) {
  if (!character) return;
  const token = (tacticalMapState.tokens || []).find((t) => t.type === 'player' && t.slot === Number(slot));
  if (token) {
    token.hp = character.hp;
    token.maxHp = character.maxHp;
    if (character.name) token.name = character.name;
    if (character.color) token.color = character.color;
    requestMapRender();
  }
}

/**
 * Synchronise tous les pions joueurs avec la liste des personnages connectés
 */
function syncTokensFromCharacters(characters) {
  if (!Array.isArray(characters)) return;
  characters.forEach((char) => {
    if (!char || !char.created) return;
    let token = (tacticalMapState.tokens || []).find((t) => t.type === 'player' && t.slot === char.slot);
    if (!token && char.name) {
      token = (tacticalMapState.tokens || []).find((t) => t.type === 'player' && t.name && t.name.toLowerCase() === char.name.toLowerCase());
    }
    if (token) {
      token.name = char.name;
      token.color = char.color || token.color;
      token.icon = char.classIcon || char.raceIcon || token.icon;
      token.hp = char.hp;
      token.maxHp = char.maxHp;
    }
  });
  requestMapRender();
}

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
            CURRENT_USER_NAME = name;
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
            CURRENT_USER_NAME = name;
            if (response.character) {
              myAssignedSlot = response.character.slot;
            }
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
      CURRENT_USER_NAME = username;

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

          // Synchronisation de la carte tactique
          if (res?.map && typeof updateTacticalMapState === 'function') {
            updateTacticalMapState(res.map);
          }

          // Mise à jour des permissions UI selon le rôle (MJ vs Joueur)
          applyRolePermissions();
          setConnectionStatus(true);

          // Si c'est un joueur avec un personnage déjà forgé (partie sauvegardée), l'assigner
          const existingChar = res.character || (Array.isArray(res.characters) ? res.characters.find(c => c.socketId === socket.id || (c.name && c.name.toLowerCase() === username.toLowerCase())) : null);
          if (existingChar) {
            myAssignedSlot = existingChar.slot;
          }
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

  // Initialisation de l'interface et des événements de la Carte Tactique
  initTacticalMapUI();

  // Application initiale des permissions de rôle
  applyRolePermissions();
});

// ============================================================
// 7. MOTEUR DE CARTE TACTIQUE (BATTLEMAP, FOG OF WAR & TOKENS)
// ============================================================

let tacticalMapState = {
  backgroundUrl: null,
  fogEnabled: true,
  tokens: [],
  revealedAreas: [],
  walls: [],
  currentTurn: null
};

let mapCamera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  minZoom: 0.5,
  maxZoom: 3.0
};

let mapActiveTool = 'select'; // 'select' | 'pan' | 'fog-rect' | 'fog-circle' | 'measure' | 'aoe-*' | 'wall' | 'wall-delete'
let isMapPanning = false;
let panStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

let draggedToken = null;
let dragOffset = { x: 0, y: 0 };
let dragTokenInitialPos = { x: 0, y: 0 };
let lastMoveEmitTime = 0;

let fogDrawState = {
  isDrawing: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};

let measureState = {
  isMeasuring: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  type: 'measure' // 'measure' | 'aoe-circle' | 'aoe-cone' | 'aoe-line'
};

const remoteMeasurements = new Map();
let lastMeasureEmitTime = 0;

// Variables pour le tracé et la gestion des Murs manuels
let wallDrawState = {
  isDrawing: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};
let hoveredWall = null;
let wallCollisionActive = null;

let hoveredToken = null;
let mapCanvas = null;
let mapCtx = null;
let mapContainer = null;
let offscreenFogCanvas = null;
let offscreenFogCtx = null;
let bgImage = null;
let bgImageLoading = false;
let mapAnimationId = null;
let cameraInitialized = false;

const DEFAULT_MAP_WIDTH = 2400;
const DEFAULT_MAP_HEIGHT = 1600;

/**
 * Met à jour l'état complet de la carte tactique
 */
function updateTacticalMapState(newMap) {
  if (!newMap) return;
  tacticalMapState = {
    ...tacticalMapState,
    ...newMap
  };
  if (!Array.isArray(tacticalMapState.tokens)) tacticalMapState.tokens = [];
  if (!Array.isArray(tacticalMapState.revealedAreas)) tacticalMapState.revealedAreas = [];
  if (!Array.isArray(tacticalMapState.walls)) tacticalMapState.walls = [];

  if (tacticalMapState.backgroundUrl) {
    loadBackgroundImage(tacticalMapState.backgroundUrl);
  } else {
    bgImage = null;
  }

  updateMapSettingsUI();
  rebuildFogCanvas();
  requestMapRender();
}

/**
 * Initialise ou rafraîchit la vue de la carte tactique
 */
function initOrRefreshTacticalMap() {
  resizeMapCanvas();

  if (CURRENT_ROOM && (!tacticalMapState.tokens || tacticalMapState.tokens.length === 0)) {
    socket.emit('map:get_state', { roomId: CURRENT_ROOM }, (res) => {
      if (res?.success && res.map) {
        updateTacticalMapState(res.map);
      }
    });
  }

  if (!cameraInitialized) {
    setTimeout(centerMapCamera, 60);
  } else {
    requestMapRender();
  }
}

/**
 * Convertit des coordonnées d'écran (CSS pixels relatifs au canvas) en coordonnées monde
 */
function screenToWorld(clientX, clientY) {
  if (!mapCanvas) return { x: 0, y: 0 };
  const rect = mapCanvas.getBoundingClientRect();
  const screenX = clientX - rect.left;
  const screenY = clientY - rect.top;
  return {
    x: (screenX - mapCamera.x) / mapCamera.zoom,
    y: (screenY - mapCamera.y) / mapCamera.zoom
  };
}

/**
 * Dimensions du monde de la Battlemap (soit l'image naturelle, soit la taille par défaut)
 */
function getMapWorldDimensions() {
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    return {
      w: bgImage.naturalWidth,
      h: bgImage.naturalHeight
    };
  }
  return {
    w: DEFAULT_MAP_WIDTH,
    h: DEFAULT_MAP_HEIGHT
  };
}

/**
 * Calcule la portée de vision d'un pion en pixels (en fonction de la race / vision dans le noir)
 */
function getTokenVisionRadius(token) {
  if (!token) return 600;
  if (typeof token.visionRadius === 'number' && token.visionRadius > 0) {
    return token.visionRadius;
  }

  let radius = 600; // 18m par défaut

  if (token.type === 'player') {
    const char = [...charactersCache.values()].find(
      (c) => c && (c.slot === token.slot || (token.name && c.name && c.name.toLowerCase() === token.name.toLowerCase()))
    );
    if (char) {
      const race = (char.race || '').toLowerCase();
      // Races dotées de la vision dans le noir (Darkvision)
      if (
        race.includes('elfe') ||
        race.includes('nain') ||
        race.includes('orc') ||
        race.includes('tieffelin') ||
        race.includes('gnome') ||
        race.includes('gobelin')
      ) {
        radius = 750; // 22.5 mètres (15 cases)
      } else {
        radius = 550; // 16.5 mètres (11 cases) pour les humains et halfelins
      }
    }
  }

  return radius;
}

/**
 * Calcule l'intersection entre un rayon 2D partant de (px, py) et un segment de mur (x1, y1)-(x2, y2)
 */
function getRaySegmentIntersection(px, py, dx, dy, maxDist, x1, y1, x2, y2) {
  const r_dx = dx * maxDist;
  const r_dy = dy * maxDist;
  const s_dx = x2 - x1;
  const s_dy = y2 - y1;

  const denom = r_dx * s_dy - r_dy * s_dx;
  if (Math.abs(denom) < 1e-9) return null;

  const qx = x1 - px;
  const qy = y1 - py;

  const t = (qx * s_dy - qy * s_dx) / denom;
  const u = (qx * r_dy - qy * r_dx) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: px + t * r_dx,
      y: py + t * r_dy,
      dist: t * maxDist
    };
  }
  return null;
}

/**
 * Calcule le polygone de visibilité (Ligne de Vue) autour d'un point par lancer de rayons (2D Raycasting)
 * Les murs dont 'blocksLight !== false' arrêtent les rayons et projettent des ombres
 */
function computeVisibilityPolygon(originX, originY, maxRadius, walls) {
  const activeWalls = (walls || []).filter((w) => w.blocksLight !== false);
  const anglesSet = new Set();

  // 1. Rayons circulaires uniformes (48 rayons pour une rotondité parfaite en zone dégagée)
  const numCircleRays = 48;
  for (let i = 0; i < numCircleRays; i++) {
    anglesSet.add((i / numCircleRays) * Math.PI * 2 - Math.PI);
  }

  // 2. Rayons projetés vers les sommets des murs proches (+/- epsilon pour franchir les coins)
  for (let i = 0; i < activeWalls.length; i++) {
    const w = activeWalls[i];
    const d1 = Math.hypot(w.x1 - originX, w.y1 - originY);
    const d2 = Math.hypot(w.x2 - originX, w.y2 - originY);

    if (d1 <= maxRadius * 1.5 || d2 <= maxRadius * 1.5) {
      const a1 = Math.atan2(w.y1 - originY, w.x1 - originX);
      const a2 = Math.atan2(w.y2 - originY, w.x2 - originX);
      const eps = 0.0002;

      anglesSet.add(a1 - eps);
      anglesSet.add(a1);
      anglesSet.add(a1 + eps);

      anglesSet.add(a2 - eps);
      anglesSet.add(a2);
      anglesSet.add(a2 + eps);
    }
  }

  const angles = Array.from(anglesSet).sort((a, b) => a - b);
  const polygon = [];

  for (let i = 0; i < angles.length; i++) {
    const ang = angles[i];
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);

    let closestDist = maxRadius;
    let hitX = originX + dx * maxRadius;
    let hitY = originY + dy * maxRadius;

    // Test d'occlusion avec chaque mur
    for (let j = 0; j < activeWalls.length; j++) {
      const w = activeWalls[j];
      const hit = getRaySegmentIntersection(originX, originY, dx, dy, maxRadius, w.x1, w.y1, w.x2, w.y2);
      if (hit && hit.dist < closestDist) {
        closestDist = hit.dist;
        hitX = hit.x;
        hitY = hit.y;
      }
    }

    polygon.push({ x: hitX, y: hitY, angle: ang });
  }

  return polygon;
}

/**
 * Vérifie si un point du plateau est visible pour les joueurs
 * (soit dans une zone manuellement révélée, soit dans la ligne de vue directe non-obstruée d'un héros)
 */
function isPointVisibleToPlayers(px, py) {
  if (!tacticalMapState.fogEnabled) return true;

  // 1. Zones révélées au pinceau par le MJ
  const areas = tacticalMapState.revealedAreas || [];
  for (let i = 0; i < areas.length; i++) {
    const a = areas[i];
    if (a.type === 'circle') {
      if (Math.hypot(px - a.x, py - a.y) <= (a.r || 50)) return true;
    } else {
      if (px >= a.x && px <= a.x + a.w && py >= a.y && py <= a.y + a.h) return true;
    }
  }

  // 2. Champ de vision automatique des pions joueurs
  const playerTokens = (tacticalMapState.tokens || []).filter((t) => t.type === 'player');
  if (!playerTokens.length) return false;

  const walls = (tacticalMapState.walls || []).filter((w) => w.blocksLight !== false);

  for (let i = 0; i < playerTokens.length; i++) {
    const pt = playerTokens[i];
    const maxRadius = getTokenVisionRadius(pt);
    const dist = Math.hypot(px - pt.x, py - pt.y);

    if (dist <= maxRadius) {
      let blocked = false;
      for (let j = 0; j < walls.length; j++) {
        const w = walls[j];
        if (doSegmentsIntersect(pt.x, pt.y, px, py, w.x1, w.y1, w.x2, w.y2)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
  }

  return false;
}

/**
 * Vérifie si un pion est actuellement visible pour les joueurs
 */
function isTokenVisibleToPlayers(token) {
  if (!token) return false;
  if (token.type === 'player') return true;
  if (CURRENT_ROLE === 'mj') return true;
  return isPointVisibleToPlayers(token.x, token.y);
}

/**
 * Dessine les contours arcaniques de vision des joueurs pour le Maître du Jeu
 */
function drawPlayerVisionOutlines(ctx) {
  const playerTokens = (tacticalMapState.tokens || []).filter((t) => t.type === 'player');
  if (!playerTokens.length) return;

  const walls = tacticalMapState.walls || [];

  ctx.save();
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);

  playerTokens.forEach((pToken) => {
    const visionRadius = getTokenVisionRadius(pToken);
    const poly = computeVisibilityPolygon(pToken.x, pToken.y, visionRadius, walls);

    if (poly.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.font = 'bold 9px Cinzel, Georgia, serif';
      ctx.fillStyle = 'rgba(254, 240, 138, 0.75)';
      ctx.textAlign = 'center';
      ctx.fillText(`Vision de ${pToken.name || 'Héros'}`, pToken.x, pToken.y - (pToken.size || 40) / 2 - 8);
      ctx.setLineDash([6, 6]);
    }
  });

  ctx.restore();
}

/**
 * Reconstruit le canvas de brouillard de guerre hors-champ (Offscreen Canvas)
 * Utilise 'destination-out' pour percer la vision automatique bloquée par les murs
 */
function rebuildFogCanvas() {
  if (!offscreenFogCanvas) {
    offscreenFogCanvas = document.createElement('canvas');
    offscreenFogCtx = offscreenFogCanvas.getContext('2d');
  }

  const { w, h } = getMapWorldDimensions();
  if (offscreenFogCanvas.width !== w || offscreenFogCanvas.height !== h) {
    offscreenFogCanvas.width = w;
    offscreenFogCanvas.height = h;
  }

  offscreenFogCtx.clearRect(0, 0, w, h);

  if (!tacticalMapState.fogEnabled) return;

  const isMJ = CURRENT_ROLE === 'mj';
  // Pour le MJ : brouillard semi-transparent pour superviser le donjon
  // Pour les Joueurs : obscurité totale impénétrable
  offscreenFogCtx.fillStyle = isMJ ? 'rgba(10, 10, 18, 0.60)' : 'rgba(5, 5, 8, 1.0)';
  offscreenFogCtx.fillRect(0, 0, w, h);

  offscreenFogCtx.save();
  offscreenFogCtx.globalCompositeOperation = 'destination-out';
  offscreenFogCtx.fillStyle = '#000000';

  // 1. Découpe des zones révélées manuellement par le MJ
  (tacticalMapState.revealedAreas || []).forEach((area) => {
    if (area.type === 'circle') {
      offscreenFogCtx.beginPath();
      offscreenFogCtx.arc(area.x, area.y, Math.max(5, area.r || 50), 0, Math.PI * 2);
      offscreenFogCtx.fill();
    } else {
      offscreenFogCtx.fillRect(area.x, area.y, area.w, area.h);
    }
  });

  // 2. Découpe du champ de vision automatique des pions joueurs (occulté par les murs)
  const playerTokens = (tacticalMapState.tokens || []).filter((t) => t.type === 'player');
  const walls = tacticalMapState.walls || [];

  playerTokens.forEach((pToken) => {
    const visionRadius = getTokenVisionRadius(pToken);
    const poly = computeVisibilityPolygon(pToken.x, pToken.y, visionRadius, walls);

    if (poly.length >= 3) {
      offscreenFogCtx.beginPath();
      offscreenFogCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        offscreenFogCtx.lineTo(poly[i].x, poly[i].y);
      }
      offscreenFogCtx.closePath();
      offscreenFogCtx.fill();
    }
  });

  offscreenFogCtx.restore();
}

/**
 * Charge l'image d'arrière-plan de la carte
 */
function loadBackgroundImage(url) {
  if (!url) {
    bgImage = null;
    bgImageLoading = false;
    rebuildFogCanvas();
    requestMapRender();
    return;
  }

  bgImageLoading = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    bgImage = img;
    bgImageLoading = false;
    rebuildFogCanvas();
    if (!cameraInitialized) {
      centerMapCamera();
    }
    requestMapRender();
  };
  img.onerror = () => {
    console.warn('[Battlemap] Impossible de charger l\'image de fond :', url);
    bgImage = null;
    bgImageLoading = false;
    rebuildFogCanvas();
    requestMapRender();
  };
  img.src = url;
}

/**
 * Ajuste le zoom en restant centré sur les coordonnées spécifiées
 */
function setZoom(newZoom, centerX, centerY) {
  if (!mapCanvas) return;
  const clampedZoom = Math.min(mapCamera.maxZoom, Math.max(mapCamera.minZoom, newZoom));
  if (Math.abs(clampedZoom - mapCamera.zoom) < 0.001) return;

  const rect = mapCanvas.getBoundingClientRect();
  const screenX = typeof centerX === 'number' ? centerX : rect.width / 2;
  const screenY = typeof centerY === 'number' ? centerY : rect.height / 2;

  const worldX = (screenX - mapCamera.x) / mapCamera.zoom;
  const worldY = (screenY - mapCamera.y) / mapCamera.zoom;

  mapCamera.zoom = Math.round(clampedZoom * 100) / 100;
  mapCamera.x = screenX - worldX * mapCamera.zoom;
  mapCamera.y = screenY - worldY * mapCamera.zoom;

  updateZoomDisplay();
  requestMapRender();
}

/**
 * Met à jour le label de zoom dans la barre d'outils
 */
function updateZoomDisplay() {
  const zoomDisplay = document.getElementById('map-zoom-display');
  if (zoomDisplay) {
    zoomDisplay.textContent = `${Math.round(mapCamera.zoom * 100)}%`;
  }
}

/**
 * Recentre la vue sur la carte
 */
function centerMapCamera() {
  if (!mapCanvas) return;
  const { w, h } = getMapWorldDimensions();
  const rect = mapCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  const zoomX = (rect.width * 0.9) / w;
  const zoomY = (rect.height * 0.9) / h;
  const targetZoom = Math.min(1.0, Math.max(0.5, Math.min(zoomX, zoomY)));

  mapCamera.zoom = Math.round(targetZoom * 20) / 20;
  mapCamera.x = (rect.width - w * mapCamera.zoom) / 2;
  mapCamera.y = (rect.height - h * mapCamera.zoom) / 2;

  cameraInitialized = true;
  updateZoomDisplay();
  requestMapRender();
}

/**
 * Adapte la taille interne du Canvas HTML5 à son conteneur CSS
 */
function resizeMapCanvas() {
  const container = document.getElementById('map-canvas-container');
  if (!container || !mapCanvas) return;
  const rect = container.getBoundingClientRect();
  const w = Math.floor(rect.width);
  const h = Math.floor(rect.height);
  if (w > 0 && h > 0 && (mapCanvas.width !== w || mapCanvas.height !== h)) {
    mapCanvas.width = w;
    mapCanvas.height = h;
    requestMapRender();
  }
}

/**
 * Planifie le rendu du canvas sur la prochaine frame d'animation
 */
function requestMapRender() {
  if (mapAnimationId) return;
  mapAnimationId = requestAnimationFrame(() => {
    mapAnimationId = null;
    renderTacticalMap();
  });
}

/**
 * Dessine l'intégralité du plateau tactique sur le Canvas
 */
function renderTacticalMap() {
  if (!mapCanvas || !mapCtx) return;

  const cw = mapCanvas.width;
  const ch = mapCanvas.height;
  if (cw <= 0 || ch <= 0) return;

  mapCtx.clearRect(0, 0, cw, ch);

  // Fond du conteneur en noir absolu
  mapCtx.fillStyle = '#08080c';
  mapCtx.fillRect(0, 0, cw, ch);

  const { w: worldW, h: worldH } = getMapWorldDimensions();

  mapCtx.save();
  // Application de la transformation caméra (Pan & Zoom)
  mapCtx.translate(mapCamera.x, mapCamera.y);
  mapCtx.scale(mapCamera.zoom, mapCamera.zoom);

  // 1. Fond de carte (Battlemap ou dalles de pierre gothiques)
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    mapCtx.drawImage(bgImage, 0, 0, worldW, worldH);
  } else {
    // Dalles sombres tactiques par défaut
    mapCtx.fillStyle = '#181822';
    mapCtx.fillRect(0, 0, worldW, worldH);

    mapCtx.fillStyle = '#1e1e2b';
    const slab = 100;
    for (let px = 0; px < worldW; px += slab) {
      for (let py = 0; py < worldH; py += slab) {
        if (((px / slab) + (py / slab)) % 2 === 0) {
          mapCtx.fillRect(px, py, slab, slab);
        }
      }
    }
  }

  // 2. Bordure du plateau de jeu
  mapCtx.save();
  mapCtx.strokeStyle = '#78350f';
  mapCtx.lineWidth = 3;
  mapCtx.strokeRect(0, 0, worldW, worldH);
  mapCtx.restore();

  // 2b. Murs tactiques infranchissables
  drawWalls(mapCtx, tacticalMapState.walls, CURRENT_ROLE === 'mj');

  // 3. Rayon d'action et portée de déplacement (Halo tactique sous les pions)
  if (draggedToken) {
    drawMovementHalo(mapCtx, draggedToken, false, true, dragTokenInitialPos);
  } else if (hoveredToken && mapActiveTool === 'select') {
    drawMovementHalo(mapCtx, hoveredToken, true, false, null);
  }

  // 4. Pions (Tokens)
  const tokens = tacticalMapState.tokens || [];
  const sortedTokens = [...tokens].sort((a, b) => {
    if (draggedToken && a.id === draggedToken.id) return 1;
    if (draggedToken && b.id === draggedToken.id) return -1;
    if (hoveredToken && a.id === hoveredToken.id) return 1;
    if (hoveredToken && b.id === hoveredToken.id) return -1;
    return 0;
  });

  sortedTokens.forEach((token) => {
    // Si c'est un joueur qui regarde et que le brouillard est actif, masquer les monstres hors champ de vision
    if (CURRENT_ROLE !== 'mj' && tacticalMapState.fogEnabled && token.type === 'monster') {
      if (!isTokenVisibleToPlayers(token)) {
        return;
      }
    }
    const isHovered = hoveredToken && hoveredToken.id === token.id;
    const isDragged = draggedToken && draggedToken.id === token.id;
    drawToken(mapCtx, token, isHovered, isDragged);
  });

  // 5. Calque de Brouillard de Guerre dynamique (occulté par les murs)
  if (tacticalMapState.fogEnabled) {
    rebuildFogCanvas();
    if (offscreenFogCanvas) {
      mapCtx.drawImage(offscreenFogCanvas, 0, 0, worldW, worldH);
    }
    // Pour le MJ : contours arcaniques du champ de vision des joueurs
    if (CURRENT_ROLE === 'mj') {
      drawPlayerVisionOutlines(mapCtx);
    }
  }

  // 6. Prévisualisation en direct lors du tracé de brouillard par le MJ
  if (fogDrawState.isDrawing && CURRENT_ROLE === 'mj') {
    mapCtx.save();
    mapCtx.strokeStyle = '#f59e0b';
    mapCtx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    mapCtx.lineWidth = 2;
    mapCtx.setLineDash([6, 4]);

    if (mapActiveTool === 'fog-circle') {
      const dx = fogDrawState.currentX - fogDrawState.startX;
      const dy = fogDrawState.currentY - fogDrawState.startY;
      const r = Math.hypot(dx, dy);
      mapCtx.beginPath();
      mapCtx.arc(fogDrawState.startX, fogDrawState.startY, r, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.stroke();
    } else if (mapActiveTool === 'fog-rect') {
      const x = Math.min(fogDrawState.startX, fogDrawState.currentX);
      const y = Math.min(fogDrawState.startY, fogDrawState.currentY);
      const w = Math.abs(fogDrawState.currentX - fogDrawState.startX);
      const h = Math.abs(fogDrawState.currentY - fogDrawState.startY);
      mapCtx.fillRect(x, y, w, h);
      mapCtx.strokeRect(x, y, w, h);
    }
    mapCtx.restore();
  }

  // 6b. Prévisualisation en direct lors du tracé d'un mur par le MJ
  if (wallDrawState.isDrawing && CURRENT_ROLE === 'mj') {
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.moveTo(wallDrawState.startX, wallDrawState.startY);
    mapCtx.lineTo(wallDrawState.currentX, wallDrawState.currentY);
    mapCtx.strokeStyle = '#f59e0b';
    mapCtx.lineWidth = 3.5;
    mapCtx.setLineDash([8, 4]);
    mapCtx.shadowColor = '#d97706';
    mapCtx.shadowBlur = 10;
    mapCtx.stroke();
    mapCtx.setLineDash([]);

    // Rivets d'extrémité
    [ { x: wallDrawState.startX, y: wallDrawState.startY }, { x: wallDrawState.currentX, y: wallDrawState.currentY } ].forEach((pt) => {
      mapCtx.beginPath();
      mapCtx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      mapCtx.fillStyle = '#fde047';
      mapCtx.strokeStyle = '#78350f';
      mapCtx.lineWidth = 2;
      mapCtx.fill();
      mapCtx.stroke();
    });

    const wallLen = Math.hypot(wallDrawState.currentX - wallDrawState.startX, wallDrawState.currentY - wallDrawState.startY);
    const midX = (wallDrawState.startX + wallDrawState.currentX) / 2;
    const midY = (wallDrawState.startY + wallDrawState.currentY) / 2;
    const wallM = ((wallLen / 50) * 1.5).toFixed(1);
    drawMapBadge(mapCtx, midX, midY - 14, `✦ Mur : ${wallM} m ✦`, 'rgba(12, 10, 9, 0.94)', '#f59e0b', '#fef08a');
    mapCtx.restore();
  }

  // 7. Mesures et Gabarits de Sorts de Zone (AoE) - Visibilité tactique intégrale au premier plan
  // A. Mesures distantes synchronisées des autres participants
  remoteMeasurements.forEach((meas) => {
    if (!meas) return;
    if (meas.type === 'measure') {
      drawMeasureLine(mapCtx, meas.startX, meas.startY, meas.currentX, meas.currentY, meas.color || '#38bdf8', true, meas.sender);
    } else {
      drawAoETemplate(mapCtx, meas.type, meas.startX, meas.startY, meas.currentX, meas.currentY, true, meas.sender);
    }
  });

  // B. Mesure ou Gabarit AoE local actif
  if (measureState.isMeasuring) {
    if (measureState.type === 'measure') {
      drawMeasureLine(mapCtx, measureState.startX, measureState.startY, measureState.currentX, measureState.currentY, '#f59e0b', false, null);
    } else {
      drawAoETemplate(mapCtx, measureState.type, measureState.startX, measureState.startY, measureState.currentX, measureState.currentY, false, null);
    }
  }

  mapCtx.restore();
}

/**
 * Calcule la vitesse tactique d'un pion en pixels, mètres et cases
 */
function getTokenSpeed(token) {
  if (!token) return { standardPx: 300, dashPx: 600, standardM: 9.0, dashM: 18.0, cases: 6 };
  let standardPx = 300; // 9m (6 cases) par défaut
  if (token.type === 'player') {
    const char = [...charactersCache.values()].find(
      (c) => c && (c.slot === token.slot || (token.name && c.name && c.name.toLowerCase() === token.name.toLowerCase()))
    );
    if (char) {
      const race = (char.race || '').toLowerCase();
      const vocation = (char.class || char.vocation || '').toLowerCase();
      if (race.includes('nain') || race.includes('halfelin') || race.includes('gnome')) {
        standardPx = 250; // 7.5m (5 cases)
      } else if (vocation.includes('voleur') || vocation.includes('rôdeur') || vocation.includes('rodeur')) {
        standardPx = 350; // 10.5m (7 cases)
      }
    }
  } else if (token.type === 'monster') {
    if ((token.size || 40) > 60) standardPx = 400; // 12m pour les grands monstres
  }

  const standardM = (standardPx / 50) * 1.5;
  const dashPx = standardPx * 2;
  const dashM = standardM * 2;
  const cases = standardPx / 50;
  return { standardPx, dashPx, standardM, dashM, cases };
}

/**
 * Dessine un badge informatif orné sur le canvas
 */
function drawMapBadge(ctx, x, y, text, bgColor = 'rgba(12, 10, 9, 0.94)', borderColor = '#d4af37', textColor = '#fef08a') {
  ctx.save();
  ctx.font = 'bold 11px Cinzel, Georgia, serif';
  const textWidth = ctx.measureText(text).width;
  const padX = 10;
  const w = textWidth + padX * 2;
  const h = 22;
  const bx = x - w / 2;
  const by = y - h / 2;

  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  const r = 3;
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(bx, by, w, h, r);
  } else {
    ctx.rect(bx, by, w, h);
  }
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/**
 * Dessine le halo de portée de déplacement (au survol ou lors du glisser-déposer)
 */
function drawMovementHalo(ctx, token, isHover, isDrag, dragStart) {
  if (!token) return;
  const speed = getTokenSpeed(token);
  ctx.save();

  if (isHover && !isDrag) {
    const pulse = Math.sin(Date.now() / 300) * 3;
    const r = speed.standardPx + pulse;

    // Disque semi-transparent arcanique au sol
    ctx.beginPath();
    ctx.arc(token.x, token.y, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.fill();

    // Bordure en pointillés magiques
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([8, 6]);
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Repères cardinaux runiques
    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 2;
    [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((ang) => {
      const cx = token.x + Math.cos(ang) * r;
      const cy = token.y + Math.sin(ang) * r;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fde047';
      ctx.fill();
      ctx.stroke();
    });

    // Badge d'information de portée
    drawMapBadge(
      ctx,
      token.x,
      token.y - r - 15,
      `✦ Portée Mouvement : ${speed.standardM.toFixed(1)} m (${speed.cases} cases) ✦`,
      'rgba(12, 10, 9, 0.94)',
      '#38bdf8',
      '#e0f2fe'
    );
  } else if (isDrag && dragStart) {
    // 1. Cercle fantôme de départ
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, (token.size || 40) / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Cercle de mouvement standard (ex. 9m / 300px)
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, speed.standardPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
    ctx.fill();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.stroke();

    // 3. Cercle d'action Course / Dash (ex. 18m / 600px)
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, speed.dashPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245, 158, 11, 0.04)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([10, 8]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Ligne de trajectoire dynamique
    const dist = Math.hypot(token.x - dragStart.x, token.y - dragStart.y);
    const distM = (dist / 50) * 1.5;
    const distCases = dist / 50;

    let trajColor = '#10b981';
    let trajText = `Mouvement : ${distM.toFixed(1)} m / ${speed.standardM.toFixed(1)} m (${distCases.toFixed(1)} c)`;
    let trajBorder = '#10b981';

    if (dist > speed.dashPx) {
      trajColor = '#ef4444';
      trajBorder = '#dc2626';
      trajText = `Dépassement : ${distM.toFixed(1)} m (Max Course: ${speed.dashM.toFixed(1)} m) !`;
    } else if (dist > speed.standardPx) {
      trajColor = '#f59e0b';
      trajBorder = '#d97706';
      trajText = `Action Course (Dash) : ${distM.toFixed(1)} m / ${speed.dashM.toFixed(1)} m`;
    }

    // Trait de trajectoire pointillé
    ctx.beginPath();
    ctx.moveTo(dragStart.x, dragStart.y);
    ctx.lineTo(token.x, token.y);
    ctx.strokeStyle = trajColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Badge au milieu de la trajectoire
    const midX = (dragStart.x + token.x) / 2;
    const midY = (dragStart.y + token.y) / 2;
    drawMapBadge(
      ctx,
      midX,
      midY - 14,
      trajText,
      'rgba(12, 10, 9, 0.94)',
      trajBorder,
      '#ffffff'
    );
  }

  ctx.restore();
}

/**
 * Dessine la réglette de mesure avec graduations et portée numérique
 */
function drawMeasureLine(ctx, startX, startY, endX, endY, color = '#f59e0b', isRemote = false, senderName = '') {
  const distPx = Math.hypot(endX - startX, endY - startY);
  if (distPx < 3) return;

  const cases = distPx / 50;
  const metres = cases * 1.5;
  const feet = cases * 5;

  ctx.save();

  // Ombre portée
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 6;

  // Ligne centrale principale
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Halo central
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Vecteur unitaire et normale
  const ux = (endX - startX) / distPx;
  const uy = (endY - startY) / distPx;
  const nx = -uy;
  const ny = ux;

  // Graduations tous les 50px (1 case = 1.5m)
  ctx.lineWidth = 1.5;
  for (let s = 50; s < distPx; s += 50) {
    const px = startX + ux * s;
    const py = startY + uy * s;
    const isMajor = (s % 100 === 0);
    const tickLen = isMajor ? 7 : 4;
    ctx.strokeStyle = isMajor ? '#fde047' : color;
    ctx.beginPath();
    ctx.moveTo(px - nx * tickLen, py - ny * tickLen);
    ctx.lineTo(px + nx * tickLen, py + ny * tickLen);
    ctx.stroke();
  }

  // Point de départ runique
  ctx.beginPath();
  ctx.arc(startX, startY, 5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Flèche à l'extrémité
  const arrowSize = 10;
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - ux * arrowSize + nx * (arrowSize * 0.55),
    endY - uy * arrowSize + ny * (arrowSize * 0.55)
  );
  ctx.lineTo(
    endX - ux * arrowSize - nx * (arrowSize * 0.55),
    endY - uy * arrowSize - ny * (arrowSize * 0.55)
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Badge numérique
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  const badgeLabel = isRemote && senderName
    ? `${senderName} : ${metres.toFixed(1)} m | ${Math.round(feet)} ft (${cases.toFixed(1)} c)`
    : `${metres.toFixed(1)} m | ${Math.round(feet)} ft (${cases.toFixed(1)} cases)`;

  drawMapBadge(
    ctx,
    midX,
    midY - 16,
    badgeLabel,
    'rgba(12, 10, 9, 0.94)',
    color,
    '#fef08a'
  );

  ctx.restore();
}

/**
 * Vérifie si un pion est dans un cercle AoE
 */
function isTokenInCircle(token, cx, cy, radius) {
  const tokenRadius = (token.size || 40) / 2;
  const dist = Math.hypot(token.x - cx, token.y - cy);
  return dist <= radius + tokenRadius;
}

/**
 * Vérifie si un pion est dans un cône AoE (angle standard de 53°)
 */
function isTokenInCone(token, ox, oy, tx, ty) {
  const length = Math.hypot(tx - ox, ty - oy);
  if (length < 5) return false;
  const tokenRadius = (token.size || 40) / 2;
  const dist = Math.hypot(token.x - ox, token.y - oy);
  if (dist > length + tokenRadius) return false;
  if (dist <= tokenRadius) return true;

  const halfSpread = 0.4636; // 26.565°
  const aimAngle = Math.atan2(ty - oy, tx - ox);
  const tokenAngle = Math.atan2(token.y - oy, token.x - ox);

  let diff = Math.abs(aimAngle - tokenAngle);
  while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);

  const angleMargin = Math.asin(Math.min(1, tokenRadius / dist));
  return diff <= halfSpread + angleMargin;
}

/**
 * Vérifie si un pion est dans une ligne AoE
 */
function isTokenInBeam(token, x1, y1, x2, y2, beamWidth = 50) {
  const tokenRadius = (token.size || 40) / 2;
  const halfW = beamWidth / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1) return Math.hypot(token.x - x1, token.y - y1) <= halfW + tokenRadius;

  const t = Math.max(0, Math.min(1, ((token.x - x1) * dx + (token.y - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  const dist = Math.hypot(token.x - projX, token.y - projY);

  return dist <= halfW + tokenRadius;
}

/**
 * Dessine un réticule de ciblage animé sur un pion pris dans une zone de sortilège
 */
function drawAoETargetReticle(ctx, token) {
  const radius = (token.size || 40) / 2;
  ctx.save();
  const pulse = Math.sin(Date.now() / 180) * 2;

  // Anneau rougeoyant de cible
  ctx.beginPath();
  ctx.arc(token.x, token.y, radius + 7 + pulse, 0, Math.PI * 2);
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 14;
  ctx.stroke();

  // Encoches en croix
  const notchLen = 6;
  const notchDist = radius + 9 + pulse;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#fca5a5';
  [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].forEach((angle) => {
    const nx = token.x + Math.cos(angle) * notchDist;
    const ny = token.y + Math.sin(angle) * notchDist;
    ctx.beginPath();
    ctx.moveTo(nx, ny);
    ctx.lineTo(nx + Math.cos(angle) * notchLen, ny + Math.sin(angle) * notchLen);
    ctx.stroke();
  });

  // Insigne de cible
  ctx.font = 'bold 9px Cinzel, Georgia, serif';
  ctx.fillStyle = '#fee2e2';
  ctx.shadowColor = '#dc2626';
  ctx.shadowBlur = 6;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('✦ CIBLE TOUCHÉE ✦', token.x, token.y - radius - 8);
  ctx.restore();
}

/**
 * Dessine un gabarit de sortilège de zone (AoE) avec détection et marquage des cibles
 */
function drawAoETemplate(ctx, type, startX, startY, endX, endY, isRemote = false, senderName = '') {
  const distPx = Math.hypot(endX - startX, endY - startY);
  if (distPx < 5) return;

  const tokens = tacticalMapState.tokens || [];
  const caughtTokens = [];

  ctx.save();

  if (type === 'aoe-circle') {
    const radius = distPx;
    const cases = radius / 50;
    const metres = cases * 1.5;
    const feet = cases * 5;

    // Détection des cibles dans le cercle
    tokens.forEach((t) => {
      if (CURRENT_ROLE !== 'mj' && tacticalMapState.fogEnabled && t.type === 'monster' && !isTokenVisibleToPlayers(t)) return;
      if (isTokenInCircle(t, startX, startY, radius)) {
        caughtTokens.push(t);
      }
    });

    // Remplissage radial dégradé arcanique
    const grad = ctx.createRadialGradient(startX, startY, radius * 0.1, startX, startY, radius);
    grad.addColorStop(0, 'rgba(245, 158, 11, 0.38)');
    grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.22)');
    grad.addColorStop(1, 'rgba(185, 28, 28, 0.12)');

    ctx.beginPath();
    ctx.arc(startX, startY, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Bordure dorée enflammée
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#d97706';
    ctx.shadowBlur = 12;
    ctx.stroke();

    // Anneau d'énergie extérieur pointillé
    ctx.beginPath();
    ctx.arc(startX, startY, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([8, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    // Rayon depuis le centre vers le curseur
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Badge
    const senderPrefix = isRemote && senderName ? `[${senderName}] ` : '';
    const badgeText = `${senderPrefix}Sphère AoE • Rayon : ${metres.toFixed(1)} m | ${Math.round(feet)} ft (${cases.toFixed(1)} c)`;
    drawMapBadge(ctx, startX, startY - radius - 16, badgeText, 'rgba(12, 10, 9, 0.94)', '#f59e0b', '#fef08a');

  } else if (type === 'aoe-cone') {
    const length = distPx;
    const cases = length / 50;
    const metres = cases * 1.5;
    const feet = cases * 5;
    const aimAngle = Math.atan2(endY - startY, endX - startX);
    const halfSpread = 0.4636; // 26.56° (angle total = 53.13°)

    // Détection des cibles dans le cône
    tokens.forEach((t) => {
      if (CURRENT_ROLE !== 'mj' && tacticalMapState.fogEnabled && t.type === 'monster' && !isTokenVisibleToPlayers(t)) return;
      if (isTokenInCone(t, startX, startY, endX, endY)) {
        caughtTokens.push(t);
      }
    });

    // Forme en éventail
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.arc(startX, startY, length, aimAngle - halfSpread, aimAngle + halfSpread);
    ctx.closePath();

    // Remplissage souffle arcanique
    const grad = ctx.createRadialGradient(startX, startY, length * 0.1, startX, startY, length);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.38)');
    grad.addColorStop(0.7, 'rgba(2, 132, 199, 0.22)');
    grad.addColorStop(1, 'rgba(12, 74, 110, 0.12)');
    ctx.fillStyle = grad;
    ctx.fill();

    // Bordure
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ligne médiane de visée
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Badge
    const senderPrefix = isRemote && senderName ? `[${senderName}] ` : '';
    const badgeText = `${senderPrefix}Cône AoE • Portée : ${metres.toFixed(1)} m | ${Math.round(feet)} ft (${cases.toFixed(1)} c)`;
    drawMapBadge(ctx, endX, endY - 16, badgeText, 'rgba(12, 10, 9, 0.94)', '#38bdf8', '#e0f2fe');

  } else if (type === 'aoe-line') {
    const length = distPx;
    const cases = length / 50;
    const metres = cases * 1.5;
    const feet = cases * 5;
    const beamWidth = 50; // 1 case = 1.5m

    // Détection des cibles dans la ligne
    tokens.forEach((t) => {
      if (CURRENT_ROLE !== 'mj' && tacticalMapState.fogEnabled && t.type === 'monster' && !isTokenVisibleToPlayers(t)) return;
      if (isTokenInBeam(t, startX, startY, endX, endY, beamWidth)) {
        caughtTokens.push(t);
      }
    });

    const angle = Math.atan2(endY - startY, endX - startX);
    const halfW = beamWidth / 2;

    ctx.save();
    ctx.translate(startX, startY);
    ctx.rotate(angle);

    // Remplissage faisceau électrique
    ctx.fillStyle = 'rgba(168, 85, 247, 0.24)';
    ctx.fillRect(0, -halfW, length, beamWidth);

    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#9333ea';
    ctx.shadowBlur = 12;
    ctx.strokeRect(0, -halfW, length, beamWidth);

    // Ligne médiane
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(length, 0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();

    ctx.restore();

    // Badge
    const midX = (startX + endX) / 2;
    const midY = (startY + endY) / 2;
    const senderPrefix = isRemote && senderName ? `[${senderName}] ` : '';
    const badgeText = `${senderPrefix}Ligne AoE • Longueur : ${metres.toFixed(1)} m | ${Math.round(feet)} ft (${cases.toFixed(1)} c)`;
    drawMapBadge(ctx, midX, midY - 20, badgeText, 'rgba(12, 10, 9, 0.94)', '#c084fc', '#f3e8ff');
  }

  // Marquer toutes les cibles touchées par le gabarit
  caughtTokens.forEach((token) => {
    drawAoETargetReticle(ctx, token);
  });

  // Badge récapitulatif des cibles affectées
  if (caughtTokens.length > 0) {
    const plural = caughtTokens.length > 1;
    drawMapBadge(
      ctx,
      startX,
      startY + 24,
      `✦ ${caughtTokens.length} ${plural ? 'Cibles Touchées' : 'Cible Touchée'} ✦`,
      'rgba(69, 10, 10, 0.96)',
      '#ef4444',
      '#fecaca'
    );
  }

  ctx.restore();
}

/**
 * Dessine un pion individuel sur le Canvas
 */
function drawToken(ctx, token, isHovered, isDragged) {
  const radius = (token.size || 40) / 2;
  const isMonster = token.type === 'monster';

  ctx.save();

  // Halo lumineux au survol ou lors du déplacement
  if (isDragged || isHovered) {
    ctx.shadowColor = token.color || (isMonster ? '#ef4444' : '#f59e0b');
    ctx.shadowBlur = isDragged ? 16 : 10;
  }

  // Socle circulaire du pion
  ctx.beginPath();
  ctx.arc(token.x, token.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = token.color || (isMonster ? '#dc2626' : '#2563eb');
  ctx.fill();

  // Cerclage extérieur métallique
  ctx.lineWidth = isDragged ? 4 : (isHovered ? 3 : 2);
  ctx.strokeStyle = isMonster ? '#7f1d1d' : '#fef08a';
  ctx.stroke();

  // Bague intérieure
  ctx.beginPath();
  ctx.arc(token.x, token.y, Math.max(2, radius - 3), 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Icône ou Initiale au centre du pion
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(radius * 1.15)}px sans-serif`;
  const iconStr = token.icon || (token.name ? token.name[0].toUpperCase() : '⚔️');
  ctx.fillText(iconStr, token.x, token.y + 1);

  // Cartouche de nom sous le pion
  const nameText = token.name || (isMonster ? 'Monstre' : 'Joueur');
  ctx.font = 'bold 11px Cinzel, Georgia, serif';
  const textWidth = ctx.measureText(nameText).width;
  const badgeW = textWidth + 14;
  const badgeH = 17;
  const badgeX = token.x - badgeW / 2;
  const badgeY = token.y + radius + 4;

  ctx.fillStyle = 'rgba(12, 10, 9, 0.94)';
  ctx.strokeStyle = token.color || '#d4af37';
  ctx.lineWidth = 1;

  ctx.beginPath();
  const r = 3;
  ctx.moveTo(badgeX + r, badgeY);
  ctx.lineTo(badgeX + badgeW - r, badgeY);
  ctx.arcTo(badgeX + badgeW, badgeY, badgeX + badgeW, badgeY + badgeH, r);
  ctx.lineTo(badgeX + badgeW, badgeY + badgeH - r);
  ctx.arcTo(badgeX + badgeW, badgeY + badgeH, badgeX, badgeY + badgeH, r);
  ctx.lineTo(badgeX + r, badgeY + badgeH);
  ctx.arcTo(badgeX, badgeY + badgeH, badgeX, badgeY, r);
  ctx.lineTo(badgeX, badgeY + r);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeW, badgeY, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fef08a';
  ctx.fillText(nameText, token.x, badgeY + badgeH / 2 + 1);

  // Aura animée et voyante si c'est le tour de ce joueur/pion
  const isCurrentTurn = Boolean(
    tacticalMapState.currentTurn && (
      (typeof tacticalMapState.currentTurn.slot === 'number' && token.slot === tacticalMapState.currentTurn.slot) ||
      (token.name && tacticalMapState.currentTurn.name && token.name.toLowerCase() === tacticalMapState.currentTurn.name.toLowerCase())
    )
  );

  if (isCurrentTurn) {
    ctx.save();
    const pulseOffset = Math.sin(Date.now() / 250) * 3;
    // Anneau doré éclatant
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius + 8 + pulseOffset, 0, Math.PI * 2);
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 16;
    ctx.stroke();

    // Anneau arcanique intérieur en pointillés
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius + 4 + pulseOffset * 0.5, 0, Math.PI * 2);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    // Insigne "TOUR ACTIF" au-dessus du pion
    ctx.font = 'bold 9px Cinzel, Georgia, serif';
    ctx.fillStyle = '#fde047';
    ctx.shadowColor = '#d4af37';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.fillText('✦ TOUR ACTIF ✦', token.x, token.y - radius - 7);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Teste si trois points forment un virage dans le sens trigonométrique
 */
function ccw(ax, ay, bx, by, cx, cy) {
  return (cy - ay) * (bx - ax) > (by - ay) * (cx - ax);
}

/**
 * Teste si deux segments de droite (x1, y1)-(x2, y2) et (x3, y3)-(x4, y4) se coupent
 */
function doSegmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  return (
    ccw(x1, y1, x3, y3, x4, y4) !== ccw(x2, y2, x3, y3, x4, y4) &&
    ccw(x1, y1, x2, y2, x3, y3) !== ccw(x1, y1, x2, y2, x4, y4)
  );
}

/**
 * Calcule la distance orthogonale euclidienne entre un point et un segment
 */
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Vérifie si une trajectoire de pion entre (fromX, fromY) et (toX, toY) heurte un mur
 * Bloque à la fois le franchissement direct et la pénétration du rayon du pion
 */
function checkWallCollision(fromX, fromY, toX, toY, tokenRadius = 20) {
  const walls = tacticalMapState.walls || [];
  if (!walls.length) return { collided: false };

  const minClearance = Math.max(8, tokenRadius * 0.7);

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.blocksMovement === false) continue;

    // 1. Intersection géométrique de trajectoire
    if (doSegmentsIntersect(fromX, fromY, toX, toY, w.x1, w.y1, w.x2, w.y2)) {
      return { collided: true, wall: w };
    }

    // 2. Collision par proximité (rayon du pion touchant le mur à l'arrivée)
    const distDest = distToSegment(toX, toY, w.x1, w.y1, w.x2, w.y2);
    if (distDest < minClearance) {
      return { collided: true, wall: w };
    }
  }

  return { collided: false };
}

/**
 * Recherche une extrémité de mur existante pour l'aimantation magnétique (snap)
 */
function findSnapEndpoint(x, y, threshold = 18) {
  const walls = tacticalMapState.walls || [];
  let best = null;
  let minDist = threshold;

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const d1 = Math.hypot(x - w.x1, y - w.y1);
    if (d1 < minDist) {
      minDist = d1;
      best = { x: w.x1, y: w.y1 };
    }
    const d2 = Math.hypot(x - w.x2, y - w.y2);
    if (d2 < minDist) {
      minDist = d2;
      best = { x: w.x2, y: w.y2 };
    }
  }

  if (best) {
    return { x: best.x, y: best.y, snapped: true };
  }
  return { x: Math.round(x), y: Math.round(y), snapped: false };
}

/**
 * Trouve le mur le plus proche d'un point (pour la sélection / démolition)
 */
function findWallAtPoint(x, y, threshold = 14) {
  const walls = tacticalMapState.walls || [];
  let closest = null;
  let minDist = threshold;

  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    const d = distToSegment(x, y, w.x1, w.y1, w.x2, w.y2);
    if (d < minDist) {
      minDist = d;
      closest = w;
    }
  }

  return closest;
}

/**
 * Dessine l'ensemble des murs du donjon sur le canvas
 */
function drawWalls(ctx, walls, isGM) {
  if (!walls || !walls.length) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. Ombre portée et fondation des murs
  walls.forEach((w) => {
    const isHovered = hoveredWall && hoveredWall.id === w.id;

    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 0, 0, 0.75)';
    ctx.shadowColor = isHovered ? '#ef4444' : '#000000';
    ctx.shadowBlur = isHovered ? 12 : 6;
    ctx.stroke();
  });

  // 2. Corps du mur en pierre volcanique / fer forgé
  walls.forEach((w) => {
    const isHovered = hoveredWall && hoveredWall.id === w.id;

    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = isHovered ? '#b91c1c' : '#1c1917';
    ctx.shadowBlur = 0;
    ctx.stroke();

    // 3. Filet d'ornement métallique / laiton terni
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = isHovered ? '#fca5a5' : '#78350f';
    ctx.stroke();

    // 4. Filet central doré fin
    ctx.beginPath();
    ctx.moveTo(w.x1, w.y1);
    ctx.lineTo(w.x2, w.y2);
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = isHovered ? '#ffffff' : '#d4af37';
    ctx.stroke();
  });

  // 5. Piliers et rivets d'ancrage aux extrémités (Visibles pour le MJ)
  if (isGM) {
    walls.forEach((w) => {
      const isHovered = hoveredWall && hoveredWall.id === w.id;
      const nodeColor = isHovered ? '#ef4444' : '#d4af37';
      const nodeBorder = isHovered ? '#fee2e2' : '#78350f';

      [ { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 } ].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = nodeColor;
        ctx.strokeStyle = nodeBorder;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      });
    });
  }

  // 6. Effet visuel d'impact / blocage de collision actif
  if (wallCollisionActive && Date.now() - wallCollisionActive.time < 500) {
    const age = Date.now() - wallCollisionActive.time;
    const alpha = Math.max(0, 1 - age / 500);
    const pulseR = 14 + (age / 500) * 12;

    ctx.save();
    ctx.beginPath();
    ctx.arc(wallCollisionActive.x, wallCollisionActive.y, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.font = 'bold 9px Cinzel, Georgia, serif';
    ctx.fillStyle = `rgba(254, 226, 226, ${alpha})`;
    ctx.textAlign = 'center';
    ctx.fillText('✦ MUR INFRANCHISSABLE ✦', wallCollisionActive.x, wallCollisionActive.y - pulseR - 4);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Vérifie si le client connecté a le droit de déplacer ce pion
 */
function canUserMoveToken(token) {
  if (!token) return false;
  // Le MJ a un contrôle absolu sur tous les pions
  if (CURRENT_ROLE === 'mj') return true;

  // Un joueur ne peut déplacer que son propre pion
  if (token.type === 'player') {
    if (typeof myAssignedSlot === 'number' && token.slot === myAssignedSlot) return true;
    if (CURRENT_USER_NAME && token.name && token.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()) return true;

    const myChar = [...charactersCache.values()].find(
      (c) => c && (c.socketId === socket.id || (c.name && CURRENT_USER_NAME && c.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()))
    );
    if (myChar && token.slot === myChar.slot) return true;
  }

  return false;
}

/**
 * Affiche l'infobulle d'informations tactiques d'un pion
 */
function showMapTooltip(token, clientX, clientY) {
  const tooltip = document.getElementById('map-token-tooltip');
  if (!tooltip || !mapContainer) return;

  const iconEl = document.getElementById('tooltip-token-icon');
  const nameEl = document.getElementById('tooltip-token-name');
  const typeEl = document.getElementById('tooltip-token-type');
  const hpContainer = document.getElementById('tooltip-token-hp-container');
  const hpValEl = document.getElementById('tooltip-token-hp-val');
  const hpBarEl = document.getElementById('tooltip-token-hp-bar');

  if (iconEl) iconEl.textContent = token.icon || '🛡️';
  if (nameEl) nameEl.textContent = token.name || 'Pion';
  if (typeEl) {
    typeEl.textContent = token.type === 'monster' ? 'Monstre / PNJ' : (token.slot !== undefined ? `Héros (Slot #${token.slot})` : 'Héros');
  }

  if (hpContainer) {
    if (typeof token.hp === 'number' && typeof token.maxHp === 'number' && token.maxHp > 0) {
      hpContainer.classList.remove('hidden');
      if (hpValEl) hpValEl.textContent = `${token.hp} / ${token.maxHp}`;
      if (hpBarEl) {
        const pct = Math.max(0, Math.min(100, Math.round((token.hp / token.maxHp) * 100)));
        hpBarEl.style.width = `${pct}%`;
        hpBarEl.className = `h-full transition-all duration-200 ${pct > 50 ? 'bg-emerald-500' : (pct > 25 ? 'bg-amber-500' : 'bg-rose-600')}`;
      }
    } else {
      hpContainer.classList.add('hidden');
    }
  }

  const containerRect = mapContainer.getBoundingClientRect();
  let left = clientX - containerRect.left + 15;
  let top = clientY - containerRect.top + 15;

  if (left + 160 > containerRect.width) left = clientX - containerRect.left - 170;
  if (top + 100 > containerRect.height) top = clientY - containerRect.top - 110;

  tooltip.style.left = `${Math.max(10, left)}px`;
  tooltip.style.top = `${Math.max(10, top)}px`;
  tooltip.classList.remove('hidden');
}

/**
 * Masque l'infobulle tactique
 */
function hideMapTooltip() {
  const tooltip = document.getElementById('map-token-tooltip');
  if (tooltip) tooltip.classList.add('hidden');
}

/**
 * Met à jour l'outil actif dans l'interface
 */
function setMapTool(toolName) {
  mapActiveTool = toolName;
  document.querySelectorAll('.map-tool-btn').forEach((btn) => {
    const isCurrent = btn.getAttribute('data-map-tool') === toolName;
    if (isCurrent) {
      btn.classList.add('rpg-btn-gold');
      btn.classList.remove('rpg-btn-subtle');
    } else {
      btn.classList.remove('rpg-btn-gold');
    }
  });

  // Mise à jour de l'état actif dans les menus déroulants
  document.querySelectorAll('.rpg-dropdown-item').forEach((item) => {
    const isCurrent = item.getAttribute('data-map-tool') === toolName;
    if (isCurrent) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Mise en surbrillance du bouton déclencheur de la catégorie active
  document.querySelectorAll('.rpg-dropdown-container').forEach((container) => {
    const hasActiveTool = container.querySelector(`.rpg-dropdown-item[data-map-tool="${toolName}"]`);
    const trigger = container.querySelector('.rpg-dropdown-trigger');
    if (trigger) {
      if (hasActiveTool) {
        trigger.classList.add('rpg-btn-gold');
      } else {
        trigger.classList.remove('rpg-btn-gold');
      }
    }
  });

  // Badge d'outil actif dans la barre
  const activeToolName = document.getElementById('hud-active-tool-name');
  if (activeToolName) {
    const toolNames = {
      'select': 'Déplacer Pions',
      'pan': 'Vue Caméra',
      'measure': 'Réglette Tactique',
      'aoe-circle': 'Sphère AoE',
      'aoe-cone': 'Cône AoE',
      'aoe-line': 'Ligne AoE',
      'wall': 'Tracer Murs',
      'wall-delete': 'Démolir Mur',
      'fog-rect': 'Révéler Rect',
      'fog-circle': 'Révéler Cercle'
    };
    activeToolName.textContent = toolNames[toolName] || toolName;
  }

  const fogNotice = document.getElementById('hud-fog-drawing-notice');
  if (fogNotice) {
    if (toolName.startsWith('fog-') && CURRENT_ROLE === 'mj') {
      fogNotice.classList.remove('hidden');
    } else {
      fogNotice.classList.add('hidden');
    }
  }

  const measureNotice = document.getElementById('hud-measure-notice');
  if (measureNotice) {
    if (toolName === 'measure') {
      measureNotice.textContent = '✦ Réglette Tactique : Cliquez-glissez pour mesurer les portées ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'aoe-circle') {
      measureNotice.textContent = '✦ Sphère AoE (Boule de feu) : Cliquez-glissez pour ajuster le rayon d\'impact ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'aoe-cone') {
      measureNotice.textContent = '✦ Cône AoE (Souffle) : Cliquez à l\'origine et étirez pour orienter le souffle ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'aoe-line') {
      measureNotice.textContent = '✦ Ligne AoE (Foudre) : Cliquez et étirez pour tracer la trajectoire ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'wall') {
      measureNotice.textContent = '✦ Outil Murs (MJ) : Cliquez-glissez pour ériger un mur infranchissable (aimantation aux sommets) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'wall-delete') {
      measureNotice.textContent = '✦ Démolition de Mur (MJ) : Cliquez sur un segment de mur pour le démolir ✦';
      measureNotice.classList.remove('hidden');
    } else {
      measureNotice.classList.add('hidden');
    }
  }

  if (!mapCanvas) return;
  if (toolName === 'pan') {
    mapCanvas.style.cursor = 'grab';
  } else if (toolName.startsWith('fog-') || toolName === 'measure' || toolName.startsWith('aoe-') || toolName === 'wall') {
    mapCanvas.style.cursor = 'crosshair';
  } else if (toolName === 'wall-delete') {
    mapCanvas.style.cursor = 'pointer';
  } else {
    mapCanvas.style.cursor = 'default';
  }
  requestMapRender();
}

/**
 * Initialise l'ouverture, fermeture et interaction des menus déroulants tactiques
 */
function initDropdowns() {
  document.querySelectorAll('.rpg-dropdown-trigger').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const container = trigger.closest('.rpg-dropdown-container');
      if (!container) return;
      const wasOpen = container.classList.contains('open');

      // Fermer tous les menus déroulants ouverts
      document.querySelectorAll('.rpg-dropdown-container.open').forEach((c) => {
        c.classList.remove('open');
      });

      if (!wasOpen) {
        container.classList.add('open');
      }
    });
  });

  // Fermer le menu lors du clic sur un item
  document.querySelectorAll('.rpg-dropdown-item').forEach((item) => {
    item.addEventListener('click', () => {
      const container = item.closest('.rpg-dropdown-container');
      if (container) container.classList.remove('open');
    });
  });

  // Fermer les menus lors d'un clic en dehors
  window.addEventListener('click', (e) => {
    if (!e.target.closest('.rpg-dropdown-container')) {
      document.querySelectorAll('.rpg-dropdown-container.open').forEach((c) => {
        c.classList.remove('open');
      });
    }
  });
}

/**
 * Met à jour les libellés de paramètres HUD (brouillard)
 */
function updateMapSettingsUI() {
  const hudFog = document.getElementById('hud-fog-status');
  if (hudFog) {
    hudFog.textContent = tacticalMapState.fogEnabled
      ? (CURRENT_ROLE === 'mj' ? 'Brouillard Actif (MJ)' : 'Brouillard Actif')
      : 'Brouillard Inactif';
  }
}

/**
 * Initialise l'ensemble des interactions du moteur de carte et des modales
 */
function initTacticalMapUI() {
  mapCanvas = document.getElementById('tactical-map-canvas');
  mapContainer = document.getElementById('map-canvas-container');
  if (!mapCanvas || !mapContainer) return;
  mapCtx = mapCanvas.getContext('2d');

  resizeMapCanvas();
  window.addEventListener('resize', resizeMapCanvas);

  // Initialisation des menus déroulants par catégorie
  initDropdowns();

  // 1. Outils de la barre supérieure
  document.querySelectorAll('.map-tool-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tool = btn.getAttribute('data-map-tool');
      if (tool) setMapTool(tool);
    });
  });

  // Zoom buttons
  const btnZoomIn = document.getElementById('btn-map-zoom-in');
  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => setZoom(mapCamera.zoom + 0.25));
  }

  const btnZoomOut = document.getElementById('btn-map-zoom-out');
  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => setZoom(mapCamera.zoom - 0.25));
  }

  const btnCenter = document.getElementById('btn-map-center');
  if (btnCenter) {
    btnCenter.addEventListener('click', centerMapCamera);
  }

  // Réinitialiser le brouillard (MJ)
  const btnResetFog = document.getElementById('btn-reset-fog');
  if (btnResetFog) {
    btnResetFog.addEventListener('click', () => {
      if (CURRENT_ROLE !== 'mj' || !CURRENT_ROOM) return;
      if (confirm('Voulez-vous réinitialiser le brouillard de guerre ? Toute la carte redeviendra obscure pour les joueurs.')) {
        socket.emit('map:reset_fog', { roomId: CURRENT_ROOM, role: CURRENT_ROLE }, (res) => {
          if (res?.success) {
            tacticalMapState.revealedAreas = [];
            rebuildFogCanvas();
            requestMapRender();
          }
        });
      }
    });
  }

  // Réinitialiser les murs (MJ)
  const btnClearWalls = document.getElementById('btn-clear-walls');
  if (btnClearWalls) {
    btnClearWalls.addEventListener('click', () => {
      if (CURRENT_ROLE !== 'mj' || !CURRENT_ROOM) return;
      if (confirm('Voulez-vous abattre tous les murs de la carte ? Les déplacements redeviendront libres.')) {
        socket.emit('map:clear_walls', { roomId: CURRENT_ROOM, role: CURRENT_ROLE }, (res) => {
          if (res?.success) {
            tacticalMapState.walls = [];
            hoveredWall = null;
            requestMapRender();
          }
        });
      }
    });
  }

  // 2. Événements Souris sur le Canvas
  mapCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (CURRENT_ROLE === 'mj') {
      const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

      // Clic droit par le MJ sur n'importe quel pion : proposition de suppression rapide
      if (hoveredToken) {
        const isPlayer = hoveredToken.type === 'player';
        const promptMsg = isPlayer
          ? `Voulez-vous retirer le pion de ${hoveredToken.name} de la carte ?\n(Vous pourrez le ré-invoquer à tout moment via le bouton "+ Pion Joueur")`
          : `Voulez-vous retirer le monstre "${hoveredToken.name}" de la carte ?`;

        if (confirm(promptMsg)) {
          const tokenId = hoveredToken.id;
          socket.emit('map:remove_token', { roomId: CURRENT_ROOM, tokenId, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.tokens = (tacticalMapState.tokens || []).filter((t) => t.id !== tokenId);
              hoveredToken = null;
              hideMapTooltip();
              requestMapRender();
            }
          });
        }
        return;
      }

      // Clic droit par le MJ sur un mur : démolition rapide
      const clickedWall = findWallAtPoint(worldX, worldY);
      if (clickedWall) {
        if (confirm('Voulez-vous abattre ce segment de mur ?')) {
          socket.emit('map:remove_wall', { roomId: CURRENT_ROOM, wallId: clickedWall.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.walls = (tacticalMapState.walls || []).filter((w) => w.id !== clickedWall.id);
              hoveredWall = null;
              requestMapRender();
            }
          });
        }
        return;
      }
    }
  });

  mapCanvas.addEventListener('mousedown', (e) => {
    const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

    // Pan caméra : Clic molette (1), clic droit (2), ou outil 'pan' avec clic gauche (0)
    if (e.button === 1 || e.button === 2 || (e.button === 0 && mapActiveTool === 'pan')) {
      isMapPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
      cameraStart = { x: mapCamera.x, y: mapCamera.y };
      mapCanvas.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0) {
      // Outils de tracé de murs (MJ uniquement)
      if (mapActiveTool === 'wall' && CURRENT_ROLE === 'mj') {
        const snap = findSnapEndpoint(worldX, worldY);
        wallDrawState.isDrawing = true;
        wallDrawState.startX = snap.x;
        wallDrawState.startY = snap.y;
        wallDrawState.currentX = snap.x;
        wallDrawState.currentY = snap.y;
        requestMapRender();
        return;
      }

      // Outil de démolition de mur (MJ uniquement)
      if (mapActiveTool === 'wall-delete' && CURRENT_ROLE === 'mj') {
        const targetWall = findWallAtPoint(worldX, worldY);
        if (targetWall && CURRENT_ROOM) {
          socket.emit('map:remove_wall', { roomId: CURRENT_ROOM, wallId: targetWall.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.walls = (tacticalMapState.walls || []).filter((w) => w.id !== targetWall.id);
              hoveredWall = null;
              requestMapRender();
            }
          });
        }
        return;
      }

      // Outils de mesure et de gabarits de sorts AoE
      if (mapActiveTool === 'measure' || mapActiveTool === 'aoe-circle' || mapActiveTool === 'aoe-cone' || mapActiveTool === 'aoe-line') {
        measureState.isMeasuring = true;
        measureState.type = mapActiveTool;
        measureState.startX = worldX;
        measureState.startY = worldY;
        measureState.currentX = worldX;
        measureState.currentY = worldY;

        // Aimantation au centre d'un pion proche
        const tokens = tacticalMapState.tokens || [];
        for (let i = tokens.length - 1; i >= 0; i--) {
          const t = tokens[i];
          const radius = (t.size || 40) / 2;
          if (Math.hypot(worldX - t.x, worldY - t.y) <= radius + 12) {
            measureState.startX = t.x;
            measureState.startY = t.y;
            break;
          }
        }
        requestMapRender();
        return;
      }

      // Outil Sélection / Déplacement de pions
      if (mapActiveTool === 'select') {
        const tokens = tacticalMapState.tokens || [];
        let clickedToken = null;

        // Détection du pion sous le curseur (recherche inverse pour prendre le pion au-dessus)
        for (let i = tokens.length - 1; i >= 0; i--) {
          const t = tokens[i];
          const radius = (t.size || 40) / 2;
          const dist = Math.hypot(worldX - t.x, worldY - t.y);
          if (dist <= radius + 6) {
            clickedToken = t;
            break;
          }
        }

        if (clickedToken) {
          if (CURRENT_ROLE !== 'mj' && tacticalMapState.fogEnabled && clickedToken.type === 'monster') {
            if (!isTokenVisibleToPlayers(clickedToken)) {
              return;
            }
          }
          if (canUserMoveToken(clickedToken)) {
            draggedToken = clickedToken;
            dragTokenInitialPos = { x: clickedToken.x, y: clickedToken.y };
            dragOffset = { x: worldX - clickedToken.x, y: worldY - clickedToken.y };
            mapCanvas.style.cursor = 'grabbing';
            hideMapTooltip();
          } else {
            alert('Action refusée : vous ne pouvez déplacer que votre propre pion.');
          }
          return;
        }
      }

      // Outils Révélation du Brouillard (MJ uniquement)
      if ((mapActiveTool === 'fog-rect' || mapActiveTool === 'fog-circle') && CURRENT_ROLE === 'mj') {
        fogDrawState.isDrawing = true;
        fogDrawState.startX = worldX;
        fogDrawState.startY = worldY;
        fogDrawState.currentX = worldX;
        fogDrawState.currentY = worldY;
        requestMapRender();
      }
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!mapCanvas) return;
    const { x: worldX, y: worldY } = screenToWorld(e.clientX, e.clientY);

    // Mise à jour des coordonnées HUD
    const hudCoords = document.getElementById('hud-coordinates');
    if (hudCoords) {
      hudCoords.textContent = `X: ${Math.round(worldX)} | Y: ${Math.round(worldY)}`;
    }

    // 1. Pan de caméra actif
    if (isMapPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      mapCamera.x = cameraStart.x + dx;
      mapCamera.y = cameraStart.y + dy;
      requestMapRender();
      return;
    }

    // 2. Déplacement d'un pion actif avec détection physique de collision contre les murs
    if (draggedToken) {
      const targetX = worldX - dragOffset.x;
      const targetY = worldY - dragOffset.y;
      const tokenRadius = (draggedToken.size || 40) / 2;

      // Détection de collision physique contre les murs (joueurs ET monstres bloqués)
      const collision = checkWallCollision(draggedToken.x, draggedToken.y, targetX, targetY, tokenRadius);

      if (!collision.collided) {
        draggedToken.x = targetX;
        draggedToken.y = targetY;
      } else {
        // Glissement le long des parois (axe X)
        const slideX = checkWallCollision(draggedToken.x, draggedToken.y, targetX, draggedToken.y, tokenRadius);
        if (!slideX.collided) {
          draggedToken.x = targetX;
        } else {
          // Glissement le long des parois (axe Y)
          const slideY = checkWallCollision(draggedToken.x, draggedToken.y, draggedToken.x, targetY, tokenRadius);
          if (!slideY.collided) {
            draggedToken.y = targetY;
          } else {
            // Mouvement totalement bloqué par la paroi
            wallCollisionActive = { x: targetX, y: targetY, time: Date.now() };
          }
        }
      }

      // Émission throttled à ~30ms pour un suivi fluide côté clients distants sans saturer la bande passante
      const now = Date.now();
      if (now - lastMoveEmitTime > 30 && CURRENT_ROOM) {
        lastMoveEmitTime = now;
        socket.emit('map:move_token', {
          roomId: CURRENT_ROOM,
          tokenId: draggedToken.id,
          x: draggedToken.x,
          y: draggedToken.y,
          role: CURRENT_ROLE
        });
      }

      requestMapRender();
      return;
    }

    // 3. Mesure ou Gabarit AoE actif
    if (measureState.isMeasuring) {
      measureState.currentX = worldX;
      measureState.currentY = worldY;

      // Émission throttled à ~35ms pour le suivi en direct chez les autres joueurs
      const now = Date.now();
      if (now - lastMeasureEmitTime > 35 && CURRENT_ROOM) {
        lastMeasureEmitTime = now;
        socket.emit('map:measure', {
          roomId: CURRENT_ROOM,
          type: measureState.type,
          startX: measureState.startX,
          startY: measureState.startY,
          currentX: measureState.currentX,
          currentY: measureState.currentY,
          sender: CURRENT_USER_NAME || (CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : 'Joueur'),
          color: mySelectedColor || (CURRENT_ROLE === 'mj' ? '#f59e0b' : '#38bdf8'),
          isMJ: CURRENT_ROLE === 'mj'
        });
      }

      requestMapRender();
      return;
    }

    // 4. Tracé de brouillard actif (MJ)
    if (fogDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      fogDrawState.currentX = worldX;
      fogDrawState.currentY = worldY;
      requestMapRender();
      return;
    }

    // 4b. Tracé de mur actif (MJ)
    if (wallDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      const snap = findSnapEndpoint(worldX, worldY);
      wallDrawState.currentX = snap.x;
      wallDrawState.currentY = snap.y;
      requestMapRender();
      return;
    }

    // 5. Détection du survol d'éléments interactifs
    // A. Survol en mode Détection / Démolition de Mur (MJ)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'wall-delete') {
      const prevHover = hoveredWall;
      hoveredWall = findWallAtPoint(worldX, worldY);
      if (hoveredWall !== prevHover) requestMapRender();
      mapCanvas.style.cursor = hoveredWall ? 'pointer' : 'crosshair';
      return;
    }

    // B. Survol en mode Tracé de Mur (MJ avec aimantation)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'wall') {
      const snap = findSnapEndpoint(worldX, worldY);
      mapCanvas.style.cursor = snap.snapped ? 'copy' : 'crosshair';
    }

    // C. Détection du survol de pion
    const rect = mapCanvas.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const tokens = tacticalMapState.tokens || [];
      let foundToken = null;

      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i];
        const radius = (t.size || 40) / 2;
        const dist = Math.hypot(worldX - t.x, worldY - t.y);
        if (dist <= radius + 6) {
          foundToken = t;
          break;
        }
      }

      if (foundToken) {
        if (CURRENT_ROLE !== 'mj' && tacticalMapState.fogEnabled && foundToken.type === 'monster') {
          if (!isTokenVisibleToPlayers(foundToken)) {
            foundToken = null;
          }
        }
      }

      if (foundToken) {
        hoveredToken = foundToken;
        if (mapActiveTool === 'measure' || mapActiveTool.startsWith('aoe-') || mapActiveTool === 'wall') {
          mapCanvas.style.cursor = 'crosshair';
        } else {
          mapCanvas.style.cursor = canUserMoveToken(foundToken) ? 'grab' : 'pointer';
        }
        showMapTooltip(foundToken, e.clientX, e.clientY);
      } else {
        hoveredToken = null;
        hideMapTooltip();
        if (mapActiveTool === 'pan') {
          mapCanvas.style.cursor = 'grab';
        } else if (mapActiveTool.startsWith('fog-') || mapActiveTool === 'measure' || mapActiveTool.startsWith('aoe-') || mapActiveTool === 'wall') {
          mapCanvas.style.cursor = 'crosshair';
        } else if (mapActiveTool === 'wall-delete') {
          mapCanvas.style.cursor = 'pointer';
        } else {
          mapCanvas.style.cursor = 'default';
        }
      }
      requestMapRender();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isMapPanning) {
      isMapPanning = false;
      mapCanvas.style.cursor = mapActiveTool === 'pan' ? 'grab' : 'default';
    }

    // Fin du tracé de mesure ou de gabarit AoE
    if (measureState.isMeasuring) {
      measureState.isMeasuring = false;
      if (CURRENT_ROOM) {
        socket.emit('map:clear_measure', { roomId: CURRENT_ROOM });
      }
      requestMapRender();
    }

    // Fin du tracé de mur par le MJ
    if (wallDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      wallDrawState.isDrawing = false;
      const len = Math.hypot(wallDrawState.currentX - wallDrawState.startX, wallDrawState.currentY - wallDrawState.startY);
      if (len >= 15 && CURRENT_ROOM) {
        const wallData = {
          x1: Math.round(wallDrawState.startX),
          y1: Math.round(wallDrawState.startY),
          x2: Math.round(wallDrawState.currentX),
          y2: Math.round(wallDrawState.currentY),
          blocksMovement: true,
          blocksLight: true
        };
        socket.emit('map:add_wall', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, wall: wallData }, (res) => {
          if (res?.success && res.wall) {
            if (!Array.isArray(tacticalMapState.walls)) tacticalMapState.walls = [];
            if (!tacticalMapState.walls.some((w) => w.id === res.wall.id)) {
              tacticalMapState.walls.push(res.wall);
            }
            requestMapRender();
          }
        });
      }
      requestMapRender();
    }

    if (draggedToken) {
      if (CURRENT_ROOM) {
        socket.emit('map:move_token', {
          roomId: CURRENT_ROOM,
          tokenId: draggedToken.id,
          x: draggedToken.x,
          y: draggedToken.y,
          role: CURRENT_ROLE
        });
      }
      draggedToken = null;
      mapCanvas.style.cursor = 'default';
      requestMapRender();
    }

    if (fogDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      fogDrawState.isDrawing = false;
      let area = null;

      if (mapActiveTool === 'fog-rect') {
        const x = Math.min(fogDrawState.startX, fogDrawState.currentX);
        const y = Math.min(fogDrawState.startY, fogDrawState.currentY);
        const w = Math.abs(fogDrawState.currentX - fogDrawState.startX);
        const h = Math.abs(fogDrawState.currentY - fogDrawState.startY);
        if (w >= 10 && h >= 10) {
          area = { type: 'rect', x, y, w, h };
        }
      } else if (mapActiveTool === 'fog-circle') {
        const dx = fogDrawState.currentX - fogDrawState.startX;
        const dy = fogDrawState.currentY - fogDrawState.startY;
        const r = Math.round(Math.hypot(dx, dy));
        if (r >= 10) {
          area = { type: 'circle', x: fogDrawState.startX, y: fogDrawState.startY, r };
        }
      }

      if (area && CURRENT_ROOM) {
        socket.emit('map:reveal_fog', {
          roomId: CURRENT_ROOM,
          role: CURRENT_ROLE,
          area
        }, (res) => {
          if (res?.success && res.area) {
            tacticalMapState.revealedAreas.push(res.area);
            rebuildFogCanvas();
            requestMapRender();
          }
        });
      }
      requestMapRender();
    }
  });

  // Zoom via molette centré sur le curseur
  mapCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const rect = mapCanvas.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    setZoom(mapCamera.zoom * factor, cursorX, cursorY);
  }, { passive: false });

  // 3. Modale d'ajout de Monstre (MJ)
  initMonsterModalUI();

  // 4. Modale de changement de fond de Battlemap (MJ)
  initMapBgModalUI();

  // 5. Modale d'invocation des Pions Joueurs (MJ)
  initPlayerTokensModalUI();

  // 6. Contrôles de Tour de Jeu
  initTurnControlsUI();

  if (tacticalMapState.currentTurn) {
    updateTurnDisplay(tacticalMapState.currentTurn);
  }

  updateMapSettingsUI();
}

/**
 * Initialise la modale d'invocation de monstre
 */
function initMonsterModalUI() {
  const modalAddMonster = document.getElementById('modal-add-monster');
  const btnOpenModal = document.getElementById('btn-open-monster-modal');
  const btnCloseModal = document.getElementById('btn-close-monster-modal');
  const btnCancel = document.getElementById('btn-cancel-monster');
  const formAdd = document.getElementById('form-add-monster');
  const iconInput = document.getElementById('monster-icon-input');
  const colorInput = document.getElementById('monster-color-input');

  if (!modalAddMonster || !formAdd) return;

  const openModal = () => {
    modalAddMonster.classList.remove('hidden');
    const nameInput = document.getElementById('monster-name-input');
    if (nameInput) nameInput.focus();
  };

  const closeModal = () => {
    modalAddMonster.classList.add('hidden');
  };

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Sélecteur d'icônes prédéfinies
  document.querySelectorAll('#monster-icon-presets .btn-preset-icon').forEach((btn) => {
    btn.addEventListener('click', () => {
      const icon = btn.getAttribute('data-icon');
      if (icon && iconInput) {
        iconInput.value = icon;
      }
    });
  });

  // Sélecteur de couleurs de socle
  document.querySelectorAll('#monster-color-presets button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const color = btn.getAttribute('data-color');
      if (color && colorInput) {
        colorInput.value = color;
        document.querySelectorAll('#monster-color-presets button').forEach((b) => {
          b.classList.remove('ring-2', 'ring-red-500/50', 'border-white');
          b.classList.add('border-stone-800');
        });
        btn.classList.add('ring-2', 'ring-red-500/50', 'border-white');
        btn.classList.remove('border-stone-800');
      }
    });
  });

  // Soumission du formulaire
  formAdd.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

    const name = document.getElementById('monster-name-input')?.value.trim();
    const icon = iconInput?.value.trim() || '👹';
    const hp = parseInt(document.getElementById('monster-hp-input')?.value, 10) || 15;
    const maxHp = parseInt(document.getElementById('monster-max-hp-input')?.value, 10) || 15;
    const color = colorInput?.value || '#dc2626';

    if (!name) {
      alert('Veuillez renseigner un nom pour la créature.');
      return;
    }

    // Spawn du monstre au centre de la vue courante
    const rect = mapCanvas ? mapCanvas.getBoundingClientRect() : { width: 800, height: 600 };
    const spawnX = Math.round((rect.width / 2 - mapCamera.x) / mapCamera.zoom);
    const spawnY = Math.round((rect.height / 2 - mapCamera.y) / mapCamera.zoom);

    socket.emit('map:add_token', {
      roomId: CURRENT_ROOM,
      role: CURRENT_ROLE,
      token: {
        name,
        icon,
        hp,
        maxHp,
        color,
        x: spawnX,
        y: spawnY,
        size: 40
      }
    }, (res) => {
      if (res?.success) {
        closeModal();
        formAdd.reset();
      } else {
        alert(`Erreur : ${res?.error || 'Échec de l\'invocation du monstre'}`);
      }
    });
  });
}

/**
 * Initialise la modale de configuration du fond de Battlemap
 */
function initMapBgModalUI() {
  const modalMapBg = document.getElementById('modal-map-background');
  const btnOpenModal = document.getElementById('btn-open-bg-modal');
  const btnCloseModal = document.getElementById('btn-close-bg-modal');
  const btnCancel = document.getElementById('btn-cancel-bg-modal');
  const btnApply = document.getElementById('btn-apply-map-bg');
  const btnRemove = document.getElementById('btn-remove-map-bg');
  const fileInput = document.getElementById('map-bg-file-input');
  const btnTriggerFile = document.getElementById('btn-trigger-map-bg-file');
  const labelFileName = document.getElementById('label-map-bg-filename');
  const urlInput = document.getElementById('map-bg-url-input');

  let selectedMapFile = null;

  if (!modalMapBg) return;

  const openModal = () => {
    modalMapBg.classList.remove('hidden');
    if (urlInput) urlInput.value = tacticalMapState.backgroundUrl || '';
    selectedMapFile = null;
    if (labelFileName) labelFileName.textContent = 'Choisir un fichier image de map...';
  };

  const closeModal = () => {
    modalMapBg.classList.add('hidden');
    selectedMapFile = null;
  };

  if (btnOpenModal) btnOpenModal.addEventListener('click', openModal);
  if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnTriggerFile && fileInput) {
    btnTriggerFile.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        selectedMapFile = fileInput.files[0];
        if (labelFileName) {
          labelFileName.textContent = `Fichier sélectionné : ${selectedMapFile.name} (${Math.round(selectedMapFile.size / 1024)} Ko)`;
        }
      }
    });
  }

  // Retirer le fond
  if (btnRemove) {
    btnRemove.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      socket.emit('map:set_background', {
        roomId: CURRENT_ROOM,
        backgroundUrl: null,
        role: CURRENT_ROLE
      }, (res) => {
        if (res?.success) closeModal();
      });
    });
  }

  // Appliquer le fond
  if (btnApply) {
    btnApply.addEventListener('click', async () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

      if (selectedMapFile) {
        btnApply.textContent = 'Envoi de l\'image...';
        btnApply.disabled = true;

        try {
          const formData = new FormData();
          formData.append('file', selectedMapFile);

          const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          const data = await response.json();

          if (!data.success || !data.url) {
            throw new Error(data.error || 'Erreur lors de l\'upload');
          }

          socket.emit('map:set_background', {
            roomId: CURRENT_ROOM,
            backgroundUrl: data.url,
            role: CURRENT_ROLE
          }, (res) => {
            btnApply.textContent = 'Appliquer le Fond';
            btnApply.disabled = false;
            if (res?.success) closeModal();
          });
        } catch (err) {
          console.error('[Battlemap Upload Error]', err);
          alert(`Erreur d'upload : ${err.message}`);
          btnApply.textContent = 'Appliquer le Fond';
          btnApply.disabled = false;
        }
      } else {
        const url = urlInput ? urlInput.value.trim() : '';
        socket.emit('map:set_background', {
          roomId: CURRENT_ROOM,
          backgroundUrl: url || null,
          role: CURRENT_ROLE
        }, (res) => {
          if (res?.success) closeModal();
        });
      }
    });
  }
}

/**
 * Joue un carillon fantastique clair via la Web Audio API sans aucun asset audio externe
 */
function playTurnChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Première note de cloche dorée (Mi 5 - 659 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.8);

    // Seconde note plus brillante (La 5 - 880 Hz, décalée de 120ms)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.28, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 1.2);
  } catch (err) {
    // Silencieux si l'audio est temporairement restreint par les règles de geste utilisateur du navigateur
  }
}

/**
 * Met à jour l'affichage du tour actif dans la barre d'outils
 */
function updateTurnDisplay(currentTurn) {
  const turnNameEl = document.getElementById('turn-active-name');
  if (turnNameEl) {
    if (currentTurn && currentTurn.name) {
      turnNameEl.textContent = `${currentTurn.icon || '👤'} ${currentTurn.name}`;
      turnNameEl.style.color = currentTurn.color || '#f59e0b';
    } else {
      turnNameEl.textContent = 'En attente';
      turnNameEl.style.color = '#a8a29e';
    }
  }

  // Mettre à jour l'aura arcanique dorée sur la fiche d'aventurier dans la vue Équipe
  document.querySelectorAll('article[data-slot]').forEach((card) => {
    const cardSlot = Number(card.getAttribute('data-slot'));
    const isCurrent = Boolean(
      currentTurn && (
        (typeof currentTurn.slot === 'number' && cardSlot === currentTurn.slot) ||
        (currentTurn.name && card.textContent && card.textContent.toLowerCase().includes(currentTurn.name.toLowerCase()))
      )
    );
    if (isCurrent) {
      card.classList.add('active-turn-card');
    } else {
      card.classList.remove('active-turn-card');
    }
  });
}

let turnAlertTimeout = null;

/**
 * Affiche une alerte visuelle au joueur quand c'est son tour
 */
function showTurnNotificationAlert(currentTurn) {
  const alertEl = document.getElementById('turn-player-alert');
  if (!alertEl) return;

  alertEl.classList.remove('hidden');

  if (turnAlertTimeout) {
    clearTimeout(turnAlertTimeout);
  }
  turnAlertTimeout = setTimeout(() => {
    hideTurnNotificationAlert();
  }, 6500);
}

/**
 * Masque l'alerte de tour
 */
function hideTurnNotificationAlert() {
  const alertEl = document.getElementById('turn-player-alert');
  if (alertEl) {
    alertEl.classList.add('hidden');
  }
  if (turnAlertTimeout) {
    clearTimeout(turnAlertTimeout);
    turnAlertTimeout = null;
  }
}

/**
 * Initialise les contrôles de Tour de Jeu
 */
function initTurnControlsUI() {
  const btnNext = document.getElementById('btn-next-turn');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      socket.emit('turn:next', {
        roomId: CURRENT_ROOM,
        role: CURRENT_ROLE
      }, (res) => {
        if (res?.success && res.currentTurn) {
          updateTurnDisplay(res.currentTurn);
          requestMapRender();
        } else if (res?.error) {
          alert(`Info : ${res.error}`);
        }
      });
    });
  }

  const btnAck = document.getElementById('btn-ack-turn');
  if (btnAck) {
    btnAck.addEventListener('click', hideTurnNotificationAlert);
  }

  const alertEl = document.getElementById('turn-player-alert');
  if (alertEl) {
    alertEl.addEventListener('click', (e) => {
      if (e.target !== btnAck) hideTurnNotificationAlert();
    });
  }
}

/**
 * Initialise la modale permettant au MJ de faire apparaître / téléporter les pions de joueurs
 */
function initPlayerTokensModalUI() {
  const modal = document.getElementById('modal-spawn-player-tokens');
  const btnOpen = document.getElementById('btn-open-player-tokens-modal');
  const btnClose = document.getElementById('btn-close-player-tokens-modal');
  const btnCancel = document.getElementById('btn-cancel-player-tokens-modal');
  const btnSpawnAll = document.getElementById('btn-spawn-all-players');
  const listContainer = document.getElementById('spawn-players-list');

  if (!modal) return;

  const renderPlayerList = () => {
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const allChars = [...charactersCache.values()].filter((c) => c && c.created);

    if (allChars.length === 0) {
      listContainer.innerHTML = `
        <div class="text-center py-6 text-stone-500 font-crimson italic text-sm">
          Aucun personnage créé par les joueurs pour le moment dans cette salle.
        </div>
      `;
      return;
    }

    allChars.forEach((char) => {
      const isOnMap = (tacticalMapState.tokens || []).some(
        (t) => t.type === 'player' && (t.slot === char.slot || (t.name && t.name.toLowerCase() === char.name.toLowerCase()))
      );

      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-3 bg-stone-950 rounded-xl border border-stone-800 hover:border-amber-900/60 transition gap-2';

      const icon = char.classIcon || char.raceIcon || '👤';
      const color = char.color || '#ef4444';

      row.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-lg border-2 shadow flex-shrink-0" style="background-color: ${color}; border-color: rgba(255,255,255,0.4);">
            ${icon}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h4 class="font-cinzel text-xs font-bold text-amber-300 leading-tight">${char.name}</h4>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${isOnMap ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-stone-900 text-stone-400 border border-stone-700'}">
                ${isOnMap ? '✓ Sur la carte' : 'Non placé'}
              </span>
            </div>
            <div class="text-[11px] font-crimson text-stone-400">
              ${char.race || 'Race'} • ${char.class || 'Classe'} (Slot #${char.slot})
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            data-slot="${char.slot}"
            class="btn-spawn-single px-3 py-1.5 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-cinzel text-xs font-bold rounded-lg shadow border border-blue-400/60 transition cursor-pointer flex items-center gap-1 active:scale-95"
            title="${isOnMap ? 'Téléporter au centre de l\'écran' : 'Faire apparaître sur la carte'}"
          >
            <span>${isOnMap ? '📍' : '➕'}</span>
            <span>${isOnMap ? 'Téléporter' : 'Invoquer'}</span>
          </button>
          ${isOnMap ? `
            <button
              type="button"
              data-slot="${char.slot}"
              class="btn-despawn-single px-2.5 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-300 font-cinzel text-xs rounded-lg border border-rose-800/80 transition cursor-pointer"
              title="Retirer temporairement ce pion de la carte"
            >
              ✕
            </button>
          ` : ''}
        </div>
      `;

      listContainer.appendChild(row);
    });

    // Attacher les écouteurs sur les boutons individuels
    listContainer.querySelectorAll('.btn-spawn-single').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = btn.getAttribute('data-slot');
        if (slot === null || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

        const rect = mapCanvas ? mapCanvas.getBoundingClientRect() : { width: 800, height: 600 };
        const spawnX = Math.round((rect.width / 2 - mapCamera.x) / mapCamera.zoom);
        const spawnY = Math.round((rect.height / 2 - mapCamera.y) / mapCamera.zoom);

        socket.emit('map:spawn_player_token', {
          roomId: CURRENT_ROOM,
          slot: Number(slot),
          x: spawnX,
          y: spawnY,
          role: CURRENT_ROLE
        }, (res) => {
          if (res?.success) {
            renderPlayerList();
            requestMapRender();
          } else {
            alert(`Erreur : ${res?.error || 'Échec de l\'invocation'}`);
          }
        });
      });
    });

    listContainer.querySelectorAll('.btn-despawn-single').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slot = Number(btn.getAttribute('data-slot'));
        const token = (tacticalMapState.tokens || []).find((t) => t.type === 'player' && t.slot === slot);
        if (!token || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

        socket.emit('map:remove_token', {
          roomId: CURRENT_ROOM,
          tokenId: token.id,
          role: CURRENT_ROLE
        }, (res) => {
          if (res?.success) {
            tacticalMapState.tokens = tacticalMapState.tokens.filter((t) => t.id !== token.id);
            renderPlayerList();
            requestMapRender();
          }
        });
      });
    });
  };

  const openModal = () => {
    modal.classList.remove('hidden');
    renderPlayerList();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnSpawnAll) {
    btnSpawnAll.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

      const rect = mapCanvas ? mapCanvas.getBoundingClientRect() : { width: 800, height: 600 };
      const startX = Math.round((rect.width / 2 - mapCamera.x) / mapCamera.zoom) - 90;
      const startY = Math.round((rect.height / 2 - mapCamera.y) / mapCamera.zoom);

      socket.emit('map:spawn_all_players', {
        roomId: CURRENT_ROOM,
        startX,
        startY,
        role: CURRENT_ROLE
      }, (res) => {
        if (res?.success) {
          closeModal();
          requestMapRender();
        } else {
          alert(`Erreur : ${res?.error || 'Échec de l\'invocation'}`);
        }
      });
    });
  }
}
