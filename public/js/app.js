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

  // Si on passe sur le Carnet d'Enquête, rafraîchir le tableau de détective
  if (tabId === 'investigation') {
    if (typeof refreshInvestigationBoardUI === 'function') {
      refreshInvestigationBoardUI();
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
  const mjZoneTools = document.getElementById('mj-zone-tools');
  const mjTrapTools = document.getElementById('mj-trap-tools');
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
  if (mjZoneTools) {
    if (isJoined && isMJ) {
      mjZoneTools.classList.remove('hidden');
      mjZoneTools.classList.add('flex');
    } else {
      mjZoneTools.classList.remove('flex');
      mjZoneTools.classList.add('hidden');
    }
  }
  if (mjTrapTools) {
    if (isJoined && isMJ) {
      mjTrapTools.classList.remove('hidden');
      mjTrapTools.classList.add('flex');
    } else {
      mjTrapTools.classList.remove('flex');
      mjTrapTools.classList.add('hidden');
    }
  }
  const mjSceneTools = document.getElementById('mj-scene-tools');
  if (mjSceneTools) {
    if (isJoined && isMJ) {
      mjSceneTools.classList.remove('hidden');
      mjSceneTools.classList.add('flex');
    } else {
      mjSceneTools.classList.remove('flex');
      mjSceneTools.classList.add('hidden');
    }
  }
  const mjPropTools = document.getElementById('mj-prop-tools');
  if (mjPropTools) {
    if (isJoined && isMJ) {
      mjPropTools.classList.remove('hidden');
      mjPropTools.classList.add('flex');
    } else {
      mjPropTools.classList.remove('flex');
      mjPropTools.classList.add('hidden');
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
    if (CURRENT_ROLE !== 'mj') {
      const myToken = getMyPlayerToken();
      if (myToken && myToken.id === tokenId) {
        exploreCurrentPosition();
      }
    }
    requestMapRender();
  }
});

// Ajout d'un nouveau pion (Monstre ou PNJ) par le MJ
socket.on('map:token_added', ({ token }) => {
  if (token && !tacticalMapState.tokens.some((t) => t.id === token.id)) {
    tacticalMapState.tokens.push(token);
    if (CURRENT_ROLE !== 'mj') {
      const myToken = getMyPlayerToken();
      if (myToken && myToken.id === token.id) {
        exploreCurrentPosition();
      }
    }
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

// Réception du changement de tour de jeu (MJ ou système d'initiative autonome)
socket.on('turn:changed', ({ currentTurn, round, turnOrder, isNewRound }) => {
  if (currentTurn) {
    tacticalMapState.currentTurn = currentTurn;
    if (typeof round === 'number') tacticalMapState.turnRound = round;
    if (Array.isArray(turnOrder)) tacticalMapState.turnOrder = turnOrder;

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
    } else {
      if (typeof hideTurnNotificationAlert === 'function') hideTurnNotificationAlert();
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

// Synchronisation dynamique d'une porte (ouverture / fermeture / verrouillage)
socket.on('map:door_updated', ({ door, action, isLocked }) => {
  if (door && Array.isArray(tacticalMapState.walls)) {
    const idx = tacticalMapState.walls.findIndex((w) => w.id === door.id);
    if (idx !== -1) {
      tacticalMapState.walls[idx] = door;
    } else {
      tacticalMapState.walls.push(door);
    }
    if (hoveredWall && hoveredWall.id === door.id) {
      hoveredWall = door;
    }
    if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

// Synchronisation de l'ambiance lumineuse (Mode Jour / Nuit)
socket.on('map:lighting_updated', ({ lightingMode }) => {
  if (lightingMode) {
    tacticalMapState.lightingMode = lightingMode;
    if (typeof updateMapSettingsUI === 'function') updateMapSettingsUI();
    if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

// Synchronisation des sources de lumière fixes (Braseros)
socket.on('map:light_added', ({ light }) => {
  if (light) {
    if (!Array.isArray(tacticalMapState.lights)) tacticalMapState.lights = [];
    tacticalMapState.lights.push(light);
    if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

socket.on('map:light_removed', ({ lightId }) => {
  if (lightId && Array.isArray(tacticalMapState.lights)) {
    tacticalMapState.lights = tacticalMapState.lights.filter((l) => l.id !== lightId);
    if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

socket.on('map:lights_cleared', () => {
  tacticalMapState.lights = [];
  if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Synchronisation de l'état de la torche d'un pion
socket.on('map:torch_toggled', ({ tokenId, hasTorch, torchRadius }) => {
  const token = (tacticalMapState.tokens || []).find((t) => t.id === tokenId);
  if (token) {
    token.hasTorch = Boolean(hasTorch);
    if (typeof torchRadius === 'number') token.torchRadius = torchRadius;
    if (typeof updateMapSettingsUI === 'function') updateMapSettingsUI();
    if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

socket.on('token:conditions_updated', ({ tokenId, token, condition, removedCondition, action }) => {
  const localTok = (tacticalMapState.tokens || []).find((t) => t.id === tokenId);
  if (localTok) {
    if (token && Array.isArray(token.conditions)) {
      localTok.conditions = token.conditions;
    }
    if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
    if (typeof requestMapRender === 'function') requestMapRender();
    if (typeof refreshConditionsModalUI === 'function') refreshConditionsModalUI();
  }
});

// Synchronisation des surfaces et zones d'effet permanentes
socket.on('map:zone_added', ({ zone }) => {
  if (!zone) return;
  if (!Array.isArray(tacticalMapState.zones)) tacticalMapState.zones = [];
  const idx = tacticalMapState.zones.findIndex((z) => z.id === zone.id);
  if (idx !== -1) {
    tacticalMapState.zones[idx] = zone;
  } else {
    tacticalMapState.zones.push(zone);
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

socket.on('map:zone_removed', ({ zoneId }) => {
  if (!Array.isArray(tacticalMapState.zones)) return;
  tacticalMapState.zones = tacticalMapState.zones.filter((z) => z.id !== zoneId);
  if (typeof requestMapRender === 'function') requestMapRender();
});

socket.on('map:zones_cleared', () => {
  tacticalMapState.zones = [];
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Synchronisation des pièges et mécanismes dissimulés
socket.on('map:trap_added', ({ trap }) => {
  if (!trap) return;
  if (!Array.isArray(tacticalMapState.traps)) tacticalMapState.traps = [];
  const idx = tacticalMapState.traps.findIndex((t) => t.id === trap.id);
  if (idx !== -1) {
    tacticalMapState.traps[idx] = trap;
  } else {
    tacticalMapState.traps.push(trap);
  }
  if (typeof requestMapRender === 'function') requestMapRender();
  if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
});

socket.on('map:trap_removed', ({ trapId }) => {
  if (!Array.isArray(tacticalMapState.traps)) return;
  tacticalMapState.traps = tacticalMapState.traps.filter((t) => t.id !== trapId);
  if (typeof requestMapRender === 'function') requestMapRender();
  if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
});

socket.on('map:traps_cleared', () => {
  tacticalMapState.traps = [];
  if (typeof requestMapRender === 'function') requestMapRender();
  if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
});

socket.on('map:trap_triggered', ({ trapId, trap, token, damage, condition }) => {
  if (Array.isArray(tacticalMapState.traps)) {
    const localTrap = tacticalMapState.traps.find((t) => t.id === trapId);
    if (localTrap) {
      localTrap.triggered = true;
      localTrap.revealed = true;
    }
  }
  if (token) {
    const localTok = (tacticalMapState.tokens || []).find((t) => t.id === token.id);
    if (localTok) {
      localTok.x = token.x;
      localTok.y = token.y;
      localTok.hp = token.hp;
      if (Array.isArray(token.conditions)) localTok.conditions = token.conditions;
    }
  }
  if (typeof requestMapRender === 'function') requestMapRender();
  if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
});

socket.on('map:trap_revealed', ({ trapId, trap, characterName, score, dc }) => {
  if (Array.isArray(tacticalMapState.traps)) {
    const localTrap = tacticalMapState.traps.find((t) => t.id === trapId);
    if (localTrap) {
      localTrap.revealed = true;
    }
  }
  if (typeof requestMapRender === 'function') requestMapRender();
  if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
});

socket.on('map:trap_disarmed', ({ trapId, trap }) => {
  if (Array.isArray(tacticalMapState.traps)) {
    const localTrap = tacticalMapState.traps.find((t) => t.id === trapId);
    if (localTrap) {
      localTrap.disarmed = trap.disarmed;
      localTrap.revealed = true;
    }
  }
  if (typeof requestMapRender === 'function') requestMapRender();
  if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
});

socket.on('map:hazard_triggered', ({ zoneId, tokenId, zone, token, damage, condition }) => {
  if (token) {
    const localTok = (tacticalMapState.tokens || []).find((t) => t.id === tokenId);
    if (localTok) {
      localTok.hp = token.hp;
      if (Array.isArray(token.conditions)) localTok.conditions = token.conditions;
    }
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

// ============================================================
// CRAIE TACTIQUE & SIGNAUX D'ATTENTION (PINGS) (FEATURE 2)
// ============================================================

// Réception d'un tracé de craie émis par un participant
socket.on('draw:stroke', ({ stroke }) => {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return;

  if (stroke.isEphemeral) {
    ephemeralDrawings.push({
      ...stroke,
      createdAt: stroke.createdAt || Date.now(),
      maxAge: 5000
    });
  } else {
    if (!Array.isArray(tacticalMapState.drawings)) tacticalMapState.drawings = [];
    const idx = tacticalMapState.drawings.findIndex((d) => d.id === stroke.id);
    if (idx !== -1) {
      tacticalMapState.drawings[idx] = stroke;
    } else {
      tacticalMapState.drawings.push(stroke);
    }
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Effacement d'un tracé permanent spécifique
socket.on('draw:erased', ({ drawingId }) => {
  if (!drawingId || !Array.isArray(tacticalMapState.drawings)) return;
  tacticalMapState.drawings = tacticalMapState.drawings.filter((d) => d.id !== drawingId);
  if (hoveredDrawing && hoveredDrawing.id === drawingId) hoveredDrawing = null;
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Effacement groupé des tracés (par auteur ou global)
socket.on('draw:cleared', ({ author, all }) => {
  if (!Array.isArray(tacticalMapState.drawings)) return;
  if (all) {
    tacticalMapState.drawings = [];
    ephemeralDrawings = [];
  } else if (author) {
    tacticalMapState.drawings = tacticalMapState.drawings.filter((d) => d.author !== author);
    ephemeralDrawings = ephemeralDrawings.filter((d) => d.author !== author);
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Réception d'un signal d'attention lumineux (Ping animé)
socket.on('map:ping', ({ ping }) => {
  if (!ping) return;
  activePings.push({
    id: ping.id || `ping_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    x: Number(ping.x) || 0,
    y: Number(ping.y) || 0,
    color: ping.color || '#f59e0b',
    author: ping.author || 'Aventurier',
    createdAt: Date.now(),
    maxAge: 3500
  });
  if (typeof requestMapRender === 'function') requestMapRender();
});

// ============================================================
// OBJETS & ÉLÉMENTS INTERACTIFS BAC À SABLE (FEATURE 3)
// ============================================================

// Ajout d'un objet interactif
socket.on('prop:added', ({ prop }) => {
  if (!prop) return;
  if (!Array.isArray(tacticalMapState.props)) tacticalMapState.props = [];
  const idx = tacticalMapState.props.findIndex((p) => p.id === prop.id);
  if (idx !== -1) {
    tacticalMapState.props[idx] = prop;
  } else {
    tacticalMapState.props.push(prop);
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Mise à jour d'un objet interactif
socket.on('prop:updated', ({ prop }) => {
  if (!prop || !Array.isArray(tacticalMapState.props)) return;
  const idx = tacticalMapState.props.findIndex((p) => p.id === prop.id);
  if (idx !== -1) {
    tacticalMapState.props[idx] = prop;
    if (selectedPropForDetail && selectedPropForDetail.id === prop.id) {
      selectedPropForDetail = prop;
      openPropDetailModal(prop);
    }
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

// Déplacement d'un objet
socket.on('prop:moved', ({ propId, x, y }) => {
  if (!propId || !Array.isArray(tacticalMapState.props)) return;
  const prop = tacticalMapState.props.find((p) => p.id === propId);
  if (prop) {
    prop.x = x;
    prop.y = y;
    if (typeof requestMapRender === 'function') requestMapRender();
  }
});

// Suppression d'un objet
socket.on('prop:removed', ({ propId }) => {
  if (!propId || !Array.isArray(tacticalMapState.props)) return;
  tacticalMapState.props = tacticalMapState.props.filter((p) => p.id !== propId);
  if (hoveredProp && hoveredProp.id === propId) hoveredProp = null;
  if (selectedPropForDetail && selectedPropForDetail.id === propId) {
    document.getElementById('modal-prop-detail')?.classList.add('hidden');
    selectedPropForDetail = null;
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

// ------------------------------------------------------------
// GESTIONNAIRE DE SCÈNES ET DONJONS MULTI-NIVEAUX (FEATURE 6)
// ------------------------------------------------------------

socket.on('scene:switched', ({ scene, scenes, activeSceneId, transportedTokens }) => {
  if (scene) {
    updateTacticalMapState(scene);
    tacticalMapState.activeSceneId = activeSceneId || scene.id;
    tacticalMapState.sceneName = scene.name;
  }
  if (Array.isArray(scenes)) {
    tacticalMapState.scenes = scenes;
  }

  // Préchargement automatique en tâche de fond des cartes en RAM
  if (typeof preloadAllScenes === 'function') {
    preloadAllScenes(false);
  }

  const hudSceneName = document.getElementById('hud-scene-name');
  if (hudSceneName && scene?.name) {
    hudSceneName.textContent = scene.name;
  }

  if (typeof rebuildFogCanvas === 'function') rebuildFogCanvas();
  if (CURRENT_ROLE !== 'mj') {
    if (typeof exploreCurrentPosition === 'function') exploreCurrentPosition();
    const myTok = (tacticalMapState.tokens || []).find((t) => t.slot === myAssignedSlot && t.type === 'player');
    if (myTok && typeof centerCameraOnToken === 'function') {
      centerCameraOnToken(myTok);
    } else if (typeof centerMapCamera === 'function') {
      centerMapCamera();
    }
  } else {
    if (typeof centerMapCamera === 'function') {
      centerMapCamera();
    }
  }

  if (typeof refreshSceneManagerModalUI === 'function') refreshSceneManagerModalUI();
  if (typeof requestMapRender === 'function') requestMapRender();
});

socket.on('scene:created', ({ scene, scenes }) => {
  if (Array.isArray(scenes)) {
    tacticalMapState.scenes = scenes;
  }
  if (typeof preloadAllScenes === 'function') {
    preloadAllScenes(false);
  }
  if (typeof refreshSceneManagerModalUI === 'function') refreshSceneManagerModalUI();
});

socket.on('scene:updated', ({ scene, scenes }) => {
  if (Array.isArray(scenes)) {
    tacticalMapState.scenes = scenes;
  }
  if (typeof preloadAllScenes === 'function') {
    preloadAllScenes(false);
  }
  if (scene && scene.id === tacticalMapState.activeSceneId) {
    if (scene.name) {
      tacticalMapState.sceneName = scene.name;
      const hudSceneName = document.getElementById('hud-scene-name');
      if (hudSceneName) hudSceneName.textContent = scene.name;
    }
    if (scene.backgroundUrl !== undefined) {
      tacticalMapState.backgroundUrl = scene.backgroundUrl;
      loadBackgroundImage(scene.backgroundUrl);
    }
  }
  if (typeof refreshSceneManagerModalUI === 'function') refreshSceneManagerModalUI();
  if (typeof requestMapRender === 'function') requestMapRender();
});

socket.on('scene:deleted', ({ sceneId, scenes }) => {
  if (Array.isArray(scenes)) {
    tacticalMapState.scenes = scenes;
  }
  if (preloadedScenesCache && preloadedScenesCache.has(sceneId)) {
    preloadedScenesCache.delete(sceneId);
  }
  if (typeof refreshSceneManagerModalUI === 'function') refreshSceneManagerModalUI();
});

socket.on('scene:teleporter_added', ({ teleporter }) => {
  if (!teleporter) return;
  if (!Array.isArray(tacticalMapState.teleporters)) tacticalMapState.teleporters = [];
  const existingIdx = tacticalMapState.teleporters.findIndex((t) => t.id === teleporter.id);
  if (existingIdx >= 0) {
    tacticalMapState.teleporters[existingIdx] = teleporter;
  } else {
    tacticalMapState.teleporters.push(teleporter);
  }
  if (typeof requestMapRender === 'function') requestMapRender();
});

socket.on('scene:teleporter_removed', ({ teleporterId }) => {
  if (!teleporterId) return;
  tacticalMapState.teleporters = (tacticalMapState.teleporters || []).filter((t) => t.id !== teleporterId);
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
  lightingMode: 'day', // 'day' ou 'night'
  lights: [],          // Sources de lumière fixes [{ id, x, y, radius, color, type, label, enabled }]
  tokens: [],
  revealedAreas: [],
  walls: [],
  zones: [],           // Terrains difficiles et zones de danger [{ id, name, type, subType, shape, x, y, w, h, r, color, effect }]
  traps: [],           // Pièges et découvertes dissimulées [{ id, name, type, subType, x, y, r, dc, damage, condition, revealed, triggered, disarmed }]
  teleporters: [],     // Téléporteurs et points de transition de scène [{ id, name, type, x, y, r, targetSceneId, targetX, targetY }]
  activeSceneId: 'scene_main',
  sceneName: 'Rez-de-chaussée',
  scenes: [],
  currentTurn: null
};

let mapCamera = {
  x: 0,
  y: 0,
  zoom: 1.0,
  minZoom: 0.5,
  maxZoom: 3.0
};

let mapActiveTool = 'select'; // 'select' | 'pan' | 'fog-rect' | 'fog-circle' | 'measure' | 'aoe-*' | 'wall' | 'wall-delete' | 'zone-*' | 'trap-*' | 'teleport' | 'teleport-delete'
let isMapPanning = false;
let panStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

let draggedToken = null;
let dragOffset = { x: 0, y: 0 };
let dragTokenInitialPos = { x: 0, y: 0 };
let dragWaypoints = []; // Points de passage pour le tracé du chemin (Ghost Pathing)
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

// Variables pour le tracé des Terrains difficiles et Zones de danger (Feature 3)
let zoneDrawState = {
  isDrawing: false,
  subType: 'swamp',
  shape: 'rect', // 'rect' ou 'circle'
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};
let hoveredZone = null;

// Variables pour les Pièges et Découvertes dissimulées (Feature 4)
let hoveredTrap = null;

// Variables pour les Téléporteurs et Transitions de scène (Feature 6)
let hoveredTeleport = null;
let pendingTeleportCoords = { x: 500, y: 500 };

// Variables pour la Craie tactique et les Pings animés (Feature 2)
let chalkState = {
  isDrawing: false,
  color: '#f8fafc',
  width: 6,
  isEphemeral: true, // true = disparaît au bout de 5s, false = permanent
  currentPoints: []
};
let ephemeralDrawings = []; // Tracés éphémères [{ id, author, color, width, points, createdAt, maxAge: 5000 }]
let activePings = [];       // Halos lumineux de ping [{ id, x, y, color, author, createdAt, maxAge: 3500 }]
let hoveredDrawing = null;  // Tracé survolé en mode gomme

// Variables pour les Objets & PNJ Bac à Sable (Feature 3)
let hoveredProp = null;
let draggedProp = null;
let dragPropOffset = { x: 0, y: 0 };
let dragPropInitialPos = { x: 0, y: 0 };
let propEditPendingCoords = { x: 1200, y: 800 };
let selectedPropForDetail = null;
let selectedPropForEdit = null;
const propImageCache = new Map();

let hoveredToken = null;
let mapCanvas = null;
let mapCtx = null;
let mapContainer = null;
let offscreenFogCanvas = null;
let offscreenFogCtx = null;
let offscreenShroudCanvas = null;
let offscreenShroudCtx = null;
let lastExploredPos = { x: -9999, y: -9999 };
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
  if (!Array.isArray(tacticalMapState.lights)) tacticalMapState.lights = [];
  if (!Array.isArray(tacticalMapState.zones)) tacticalMapState.zones = [];
  if (!Array.isArray(tacticalMapState.traps)) tacticalMapState.traps = [];
  if (!Array.isArray(tacticalMapState.teleporters)) tacticalMapState.teleporters = [];
  if (!Array.isArray(tacticalMapState.drawings)) tacticalMapState.drawings = [];
  if (!Array.isArray(tacticalMapState.props)) tacticalMapState.props = [];
  if (!Array.isArray(tacticalMapState.scenes)) tacticalMapState.scenes = [];
  if (newMap.activeSceneId) tacticalMapState.activeSceneId = newMap.activeSceneId;
  if (newMap.sceneName || newMap.name) tacticalMapState.sceneName = newMap.sceneName || newMap.name;
  if (!tacticalMapState.lightingMode) tacticalMapState.lightingMode = 'day';

  const hudSceneName = document.getElementById('hud-scene-name');
  if (hudSceneName && tacticalMapState.sceneName) {
    hudSceneName.textContent = tacticalMapState.sceneName;
  }

  if (tacticalMapState.backgroundUrl) {
    loadBackgroundImage(tacticalMapState.backgroundUrl);
  } else {
    bgImage = null;
  }

  if (newMap.turnSystem && typeof newMap.turnSystem.round === 'number') {
    tacticalMapState.turnRound = newMap.turnSystem.round;
  }
  if (typeof updateTurnDisplay === 'function') {
    updateTurnDisplay(tacticalMapState.currentTurn);
  }

  updateMapSettingsUI();
  rebuildFogCanvas();
  if (CURRENT_ROLE !== 'mj') {
    exploreCurrentPosition();
  }
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
 * Catalogue des 11 altérations d'état et bénédictions tactiques
 */
const RPG_CONDITIONS_CATALOGUE = [
  { id: 'blinded', name: 'Aveuglé', icon: '[x_x]', color: '#64748b', desc: 'Vision réduite à 0 case. Obscurité totale.' },
  { id: 'prone', name: 'À terre', icon: '[v]', color: '#78716c', desc: 'Vitesse de déplacement divisée par deux.' },
  { id: 'restrained', name: 'Entravé', icon: '[#]', color: '#a8a29e', desc: 'Vitesse de déplacement bloquée (0).' },
  { id: 'invisible', name: 'Invisible', icon: '[?]', color: '#38bdf8', desc: 'Invisible même avec ligne de vue directe.' },
  { id: 'burning', name: 'Brûlé', icon: '[♨]', color: '#f97316', desc: 'Flammes ardentes périodiques.' },
  { id: 'poisoned', name: 'Empoisonné', icon: '[☣]', color: '#22c55e', desc: 'Vapeurs et toxines affaiblissantes.' },
  { id: 'cursed', name: 'Maudit', icon: '[☠]', color: '#a855f7', desc: 'Affliction et runes nécrotiques.' },
  { id: 'blessed', name: 'Béni', icon: '[✦]', color: '#eab308', desc: 'Grâce et éclat divin protecteur.' },
  { id: 'asleep', name: 'Endormi', icon: '[Zz]', color: '#6366f1', desc: 'Sommeil magique profond. Incapable d\'agir.' },
  { id: 'charmed', name: 'Amoureux', icon: '[<3]', color: '#ec4899', desc: 'Envoûté et pacifié par le charme.' },
  { id: 'confused', name: 'Confus', icon: '[~?]', color: '#e11d48', desc: 'Vertige et désorientation mentale.' }
];

function hasTokenCondition(token, conditionId) {
  if (!token || !Array.isArray(token.conditions)) return false;
  return token.conditions.some((c) => c && c.id === conditionId);
}

function getTokenConditions(token) {
  if (!token || !Array.isArray(token.conditions)) return [];
  return token.conditions;
}

/**
 * Ajoute un point de passage au déplacement actif (Ghost Pathing)
 */
function addDragWaypoint(x, y) {
  if (!draggedToken) return;
  const prev = dragWaypoints.length > 0 ? dragWaypoints[dragWaypoints.length - 1] : dragTokenInitialPos;
  if (!prev) return;
  const d = Math.hypot(x - prev.x, y - prev.y);
  if (d < 15) return;
  dragWaypoints.push({ x: Math.round(x), y: Math.round(y) });
  requestMapRender();
}

/**
 * Retire le dernier point de passage du déplacement actif
 */
function removeLastDragWaypoint() {
  if (dragWaypoints.length > 0) {
    dragWaypoints.pop();
    requestMapRender();
  }
}

/**
 * Calcule la portée de vision d'un pion en pixels (en fonction de la race / vision dans le noir / altérations)
 */
function getTokenVisionRadius(token) {
  if (!token) return 600;

  // Feature 5 : Aveuglé -> Réduit immédiatement le rayon de vision à 0 case (obscurité totale)
  if (hasTokenCondition(token, 'blinded')) {
    return 0;
  }

  if (typeof token.visionRadius === 'number' && token.visionRadius > 0) {
    return token.visionRadius;
  }

  // 1. En Mode Jour : vision de jour panoramique (30 mètres = 1000 pixels)
  if (tacticalMapState.lightingMode !== 'night') {
    return 1000;
  }

  // 2. En Mode Nuit :
  // Si le pion porte une torche allumée : illumination de 12 mètres (400px / 8 cases)
  let radius = token.hasTorch ? (token.torchRadius || 400) : 0;

  if (token.type === 'player') {
    const char = [...charactersCache.values()].find(
      (c) => c && (c.slot === token.slot || (token.name && c.name && c.name.toLowerCase() === token.name.toLowerCase()))
    );
    if (char) {
      const race = (char.race || '').toLowerCase();
      // Vision dans le noir (Darkvision) : Un Elfe ou un Nain voit à 12 mètres (400px) dans l'obscurité
      if (
        race.includes('elfe') ||
        race.includes('nain') ||
        race.includes('orc') ||
        race.includes('tieffelin') ||
        race.includes('gnome') ||
        race.includes('gobelin')
      ) {
        radius = Math.max(radius, 400); // 12 mètres
      } else {
        // Un Humain (ou race sans darkvision) est aveugle dans le noir sans torche/lumière
        if (!token.hasTorch) {
          radius = 25; // Contact corporel immédiat uniquement pour voir son propre pion
        }
      }
    }
  } else if (token.type === 'monster') {
    // Les créatures nocturnes et monstres ont une vision dans le noir de 12 mètres par défaut
    radius = Math.max(radius, 400);
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
 * Récupère le pion correspondant au joueur connecté
 */
function getMyPlayerToken() {
  const tokens = tacticalMapState.tokens || [];
  if (typeof myAssignedSlot === 'number') {
    const found = tokens.find((t) => t.type === 'player' && t.slot === myAssignedSlot);
    if (found) return found;
  }
  if (CURRENT_USER_NAME) {
    const found = tokens.find((t) => t.type === 'player' && t.name && t.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase());
    if (found) return found;
  }
  const myChar = [...charactersCache.values()].find(
    (c) => c && (c.socketId === socket.id || (c.name && CURRENT_USER_NAME && c.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()))
  );
  if (myChar) {
    const found = tokens.find((t) => t.type === 'player' && t.slot === myChar.slot);
    if (found) return found;
  }
  return null;
}

/**
 * Vérifie si un point se trouve dans une zone éclairée par une source fixe ou une torche
 */
function isPointInAnyLight(px, py) {
  const walls = (tacticalMapState.walls || []).filter((w) => w.blocksLight !== false);

  // 1. Sources fixes (braseros, feux de camp...)
  const lights = tacticalMapState.lights || [];
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    if (l.enabled === false) continue;
    const r = l.radius || 400;
    const dist = Math.hypot(px - l.x, py - l.y);
    if (dist <= r) {
      let blocked = false;
      for (let j = 0; j < walls.length; j++) {
        if (doSegmentsIntersect(l.x, l.y, px, py, walls[j].x1, walls[j].y1, walls[j].x2, walls[j].y2)) {
          blocked = true;
          break;
        }
      }
      if (!blocked) return true;
    }
  }

  // 2. Torches portées par les pions
  const tokens = tacticalMapState.tokens || [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.hasTorch) {
      const r = t.torchRadius || 400;
      const dist = Math.hypot(px - t.x, py - t.y);
      if (dist <= r) {
        let blocked = false;
        for (let j = 0; j < walls.length; j++) {
          if (doSegmentsIntersect(t.x, t.y, px, py, walls[j].x1, walls[j].y1, walls[j].x2, walls[j].y2)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) return true;
      }
    }
  }

  return false;
}

/**
 * Vérifie si un point se trouve dans le champ de vision actif direct du joueur connecté
 */
function isPointInMyLiveVision(px, py) {
  if (CURRENT_ROLE === 'mj') return true;
  if (!tacticalMapState.fogEnabled) return true;

  const myToken = getMyPlayerToken();
  if (!myToken) return false;

  const walls = (tacticalMapState.walls || []).filter((w) => w.blocksLight !== false);

  // Vérifier si la ligne de vue directe est bloquée par un mur ou une porte fermée
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (doSegmentsIntersect(myToken.x, myToken.y, px, py, w.x1, w.y1, w.x2, w.y2)) {
      return false;
    }
  }

  // Si Mode Jour : vision panoramique (1000px)
  if (tacticalMapState.lightingMode !== 'night') {
    const dist = Math.hypot(px - myToken.x, py - myToken.y);
    return dist <= 1200;
  }

  // Si Mode Nuit :
  // A. Dans le rayon de vision nocturne (Darkvision) ou torche du joueur
  const visionRadius = getTokenVisionRadius(myToken);
  const dist = Math.hypot(px - myToken.x, py - myToken.y);
  if (visionRadius > 0 && dist <= visionRadius) {
    return true;
  }

  // B. Dans une zone éclairée par un brasero ou la torche d'un allié
  if (isPointInAnyLight(px, py)) {
    return true;
  }

  return false;
}

/**
 * Vérifie si un pion est visible pour le client actuellement connecté :
 * - Le MJ voit tous les pions sans restriction.
 * - Un joueur voit TOUJOURS son propre pion.
 * - Tout autre pion (monstre OU héros allié) n'est visible que s'il se trouve
 *   dans le champ de vision direct ou dans une zone éclairée par une torche / un brasero.
 */
function isTokenVisibleToCurrentClient(token) {
  if (!token) return false;

  const isInvis = hasTokenCondition(token, 'invisible');
  const isMyToken = token.type === 'player' && (
    (typeof myAssignedSlot === 'number' && token.slot === myAssignedSlot) ||
    (CURRENT_USER_NAME && token.name && token.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()) ||
    Boolean([...charactersCache.values()].find(
      (c) => c && c.slot === token.slot && (c.socketId === socket.id || (c.name && CURRENT_USER_NAME && c.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()))
    ))
  );

  // Feature 5 : Invisibilité
  // Le pion devient invisible même pour les ennemis ayant une ligne de vue directe.
  // Seuls le Maître du Jeu et le joueur propriétaire peuvent voir ce pion.
  if (isInvis) {
    if (CURRENT_ROLE === 'mj' || isMyToken) {
      return true;
    }
    return false;
  }

  if (CURRENT_ROLE === 'mj') return true;
  if (!tacticalMapState.fogEnabled) return true;
  if (isMyToken) return true;

  return isPointInMyLiveVision(token.x, token.y);
}

/**
 * Déclenche l'exploration automatique de la position courante du joueur connecté
 * et partage la zone révélée avec toute la table
 */
function exploreCurrentPosition() {
  if (CURRENT_ROLE === 'mj') return;
  if (!CURRENT_ROOM) return;

  const myToken = getMyPlayerToken();
  if (!myToken) return;

  const visionRadius = getTokenVisionRadius(myToken);
  if (visionRadius <= 30) return; // Un aventurier aveugle dans le noir n'explore pas la carte à distance

  const d = Math.hypot(myToken.x - lastExploredPos.x, myToken.y - lastExploredPos.y);
  if (d < 35) return;

  lastExploredPos = { x: myToken.x, y: myToken.y };

  const walls = tacticalMapState.walls || [];
  const poly = computeVisibilityPolygon(myToken.x, myToken.y, visionRadius, walls);
  if (!poly || poly.length < 3) return;

  const points = poly.map((pt) => ({ x: Math.round(pt.x), y: Math.round(pt.y) }));
  socket.emit('map:explore_fog', {
    roomId: CURRENT_ROOM,
    area: {
      type: 'polygon',
      points
    }
  });

  // Feature 4 : Détection automatique des pièges dissimulés lors de l'exploration
  checkPassivePerceptionForTraps();
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
 * L'obscurité totale couvre l'inconnu. Les zones visitées communes et le champ de vision individuel sont percés.
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
  offscreenFogCtx.fillStyle = isMJ ? 'rgba(10, 10, 18, 0.60)' : 'rgba(5, 5, 8, 1.0)';
  offscreenFogCtx.fillRect(0, 0, w, h);

  offscreenFogCtx.save();
  offscreenFogCtx.globalCompositeOperation = 'destination-out';
  offscreenFogCtx.fillStyle = '#000000';

  // 1. Découpe des zones explorées / révélées communes (sauvegardées sur le serveur)
  (tacticalMapState.revealedAreas || []).forEach((area) => {
    if (area.type === 'circle') {
      offscreenFogCtx.beginPath();
      offscreenFogCtx.arc(area.x, area.y, Math.max(5, area.r || 50), 0, Math.PI * 2);
      offscreenFogCtx.fill();
    } else if (area.type === 'polygon' && Array.isArray(area.points) && area.points.length >= 3) {
      offscreenFogCtx.beginPath();
      offscreenFogCtx.moveTo(area.points[0].x, area.points[0].y);
      for (let i = 1; i < area.points.length; i++) {
        offscreenFogCtx.lineTo(area.points[i].x, area.points[i].y);
      }
      offscreenFogCtx.closePath();
      offscreenFogCtx.fill();
    } else {
      offscreenFogCtx.fillRect(area.x, area.y, area.w, area.h);
    }
  });

  // 2. Découpe du champ de vision actif direct :
  // Le MJ voit la vision combinée ; un Joueur ne voit que SON PROPRE champ de vision
  const walls = tacticalMapState.walls || [];
  if (isMJ) {
    const playerTokens = (tacticalMapState.tokens || []).filter((t) => t.type === 'player');
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
  } else {
    const myToken = getMyPlayerToken();
    if (myToken) {
      const visionRadius = getTokenVisionRadius(myToken);
      const poly = computeVisibilityPolygon(myToken.x, myToken.y, visionRadius, walls);
      if (poly.length >= 3) {
        offscreenFogCtx.beginPath();
        offscreenFogCtx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          offscreenFogCtx.lineTo(poly[i].x, poly[i].y);
        }
        offscreenFogCtx.closePath();
        offscreenFogCtx.fill();
      }
    }
  }

  // 3. Découpe des sources de lumières fixes (braseros, feux de camp posés par le MJ perçant le brouillard)
  (tacticalMapState.lights || []).forEach((light) => {
    if (light.enabled === false) return;
    const r = light.radius || 400;
    const poly = computeVisibilityPolygon(light.x, light.y, r, walls);
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

  // 4. Découpe des torches portées par les héros (rayon 12 mètres pour tout le groupe)
  (tacticalMapState.tokens || []).forEach((t) => {
    if (t.hasTorch) {
      const r = t.torchRadius || 400;
      const poly = computeVisibilityPolygon(t.x, t.y, r, walls);
      if (poly.length >= 3) {
        offscreenFogCtx.beginPath();
        offscreenFogCtx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          offscreenFogCtx.lineTo(poly[i].x, poly[i].y);
        }
        offscreenFogCtx.closePath();
        offscreenFogCtx.fill();
      }
    }
  });

  offscreenFogCtx.restore();
}

/**
 * Dessine un voile d'obscurité semi-transparent (55%) sur les zones explorées mais non visibles actuellement
 */
function drawPlayerExplorationShroud(ctx, w, h) {
  if (!offscreenShroudCanvas) {
    offscreenShroudCanvas = document.createElement('canvas');
    offscreenShroudCtx = offscreenShroudCanvas.getContext('2d');
  }
  if (offscreenShroudCanvas.width !== w || offscreenShroudCanvas.height !== h) {
    offscreenShroudCanvas.width = w;
    offscreenShroudCanvas.height = h;
  }

  offscreenShroudCtx.clearRect(0, 0, w, h);

  // 1. Voile sombre posé sur chaque zone explorée
  (tacticalMapState.revealedAreas || []).forEach((area) => {
    offscreenShroudCtx.fillStyle = 'rgba(5, 5, 8, 0.55)';
    if (area.type === 'circle') {
      offscreenShroudCtx.beginPath();
      offscreenShroudCtx.arc(area.x, area.y, Math.max(5, area.r || 50), 0, Math.PI * 2);
      offscreenShroudCtx.fill();
    } else if (area.type === 'polygon' && Array.isArray(area.points) && area.points.length >= 3) {
      offscreenShroudCtx.beginPath();
      offscreenShroudCtx.moveTo(area.points[0].x, area.points[0].y);
      for (let i = 1; i < area.points.length; i++) {
        offscreenShroudCtx.lineTo(area.points[i].x, area.points[i].y);
      }
      offscreenShroudCtx.closePath();
      offscreenShroudCtx.fill();
    } else {
      offscreenShroudCtx.fillRect(area.x, area.y, area.w, area.h);
    }
  });

  // 2. Découpe complète du champ de vision actif direct (transparence à 100%)
  const walls = tacticalMapState.walls || [];
  const myToken = getMyPlayerToken();
  if (myToken) {
    const visionRadius = getTokenVisionRadius(myToken);
    const poly = computeVisibilityPolygon(myToken.x, myToken.y, visionRadius, walls);
    if (poly && poly.length >= 3) {
      offscreenShroudCtx.save();
      offscreenShroudCtx.globalCompositeOperation = 'destination-out';
      offscreenShroudCtx.fillStyle = '#000000';
      offscreenShroudCtx.beginPath();
      offscreenShroudCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        offscreenShroudCtx.lineTo(poly[i].x, poly[i].y);
      }
      offscreenShroudCtx.closePath();
      offscreenShroudCtx.fill();
      offscreenShroudCtx.restore();
    }
  }

  // 3. Découpe des sources fixes de lumière (braseros) et torches actives (clarté à 100%)
  (tacticalMapState.lights || []).forEach((light) => {
    if (light.enabled === false) return;
    const r = light.radius || 400;
    const poly = computeVisibilityPolygon(light.x, light.y, r, walls);
    if (poly && poly.length >= 3) {
      offscreenShroudCtx.save();
      offscreenShroudCtx.globalCompositeOperation = 'destination-out';
      offscreenShroudCtx.fillStyle = '#000000';
      offscreenShroudCtx.beginPath();
      offscreenShroudCtx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        offscreenShroudCtx.lineTo(poly[i].x, poly[i].y);
      }
      offscreenShroudCtx.closePath();
      offscreenShroudCtx.fill();
      offscreenShroudCtx.restore();
    }
  });

  (tacticalMapState.tokens || []).forEach((t) => {
    if (t.hasTorch) {
      const r = t.torchRadius || 400;
      const poly = computeVisibilityPolygon(t.x, t.y, r, walls);
      if (poly && poly.length >= 3) {
        offscreenShroudCtx.save();
        offscreenShroudCtx.globalCompositeOperation = 'destination-out';
        offscreenShroudCtx.fillStyle = '#000000';
        offscreenShroudCtx.beginPath();
        offscreenShroudCtx.moveTo(poly[0].x, poly[0].y);
        for (let i = 1; i < poly.length; i++) {
          offscreenShroudCtx.lineTo(poly[i].x, poly[i].y);
        }
        offscreenShroudCtx.closePath();
        offscreenShroudCtx.fill();
        offscreenShroudCtx.restore();
      }
    }
  });

  ctx.drawImage(offscreenShroudCanvas, 0, 0, w, h);
}

// Cache mémoire RAM des images de scènes préchargées (sceneId -> { url, img, loaded, error })
const preloadedScenesCache = new Map();

/**
 * Précharge en mémoire RAM l'image de fond d'une scène pour transition instantanée
 */
function preloadScene(scene) {
  if (!scene || !scene.backgroundUrl) return Promise.resolve(null);
  const sceneId = scene.id;
  const existing = preloadedScenesCache.get(sceneId);
  if (existing && existing.url === scene.backgroundUrl && existing.loaded && existing.img?.complete) {
    return Promise.resolve(existing.img);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const record = { url: scene.backgroundUrl, img, loaded: false, error: false };
    preloadedScenesCache.set(sceneId, record);

    img.onload = () => {
      record.loaded = true;
      resolve(img);
    };
    img.onerror = () => {
      record.error = true;
      console.warn('[Preload] Échec préchargement image pour la scène :', scene.name || sceneId);
      resolve(null);
    };
    img.src = scene.backgroundUrl;
  });
}

/**
 * Précharge l'ensemble des scènes enregistrées dans la salle
 */
async function preloadAllScenes(notify = false) {
  const scenes = tacticalMapState.scenes || [];
  const scenesWithBg = scenes.filter((s) => Boolean(s.backgroundUrl));
  const badge = document.getElementById('preload-scenes-badge');

  if (scenesWithBg.length === 0) {
    if (badge) {
      badge.textContent = '0 carte';
      badge.className = 'px-1.5 py-0.5 text-[9px] bg-stone-950 border border-stone-800 text-stone-400 font-mono';
    }
    if (notify) alert('Aucune scène ne comporte d\'image de fond à précharger.');
    return;
  }

  if (badge) {
    badge.textContent = 'Chargement...';
    badge.className = 'px-1.5 py-0.5 text-[9px] bg-indigo-950 border border-indigo-700 text-indigo-300 font-mono';
  }

  const promises = scenesWithBg.map((s) => preloadScene(s));
  await Promise.allSettled(promises);

  let readyCount = 0;
  scenesWithBg.forEach((s) => {
    const cached = preloadedScenesCache.get(s.id);
    if (cached && cached.loaded && cached.img?.complete) readyCount++;
  });

  if (badge) {
    badge.textContent = `${readyCount}/${scenesWithBg.length} prêts`;
    badge.className = readyCount === scenesWithBg.length
      ? 'px-1.5 py-0.5 text-[9px] bg-emerald-950 border border-emerald-600 text-emerald-300 font-mono'
      : 'px-1.5 py-0.5 text-[9px] bg-amber-950 border border-amber-600 text-amber-300 font-mono';
  }

  if (notify) {
    alert(`Préchargement terminé : ${readyCount}/${scenesWithBg.length} scènes sont stockées en mémoire RAM et prêtes pour des transitions instantanées !`);
  }
}

/**
 * Charge l'image d'arrière-plan de la carte (avec utilisation prioritaire du cache de préchargement)
 */
function loadBackgroundImage(url) {
  if (!url) {
    bgImage = null;
    bgImageLoading = false;
    rebuildFogCanvas();
    requestMapRender();
    return;
  }

  // 1. Vérifier si l'image est déjà disponible et prête dans le cache de préchargement
  const activeSceneId = tacticalMapState.activeSceneId;
  if (activeSceneId && preloadedScenesCache.has(activeSceneId)) {
    const cached = preloadedScenesCache.get(activeSceneId);
    if (cached && cached.url === url && cached.loaded && cached.img?.complete && cached.img.naturalWidth > 0) {
      bgImage = cached.img;
      bgImageLoading = false;
      rebuildFogCanvas();
      if (!cameraInitialized) {
        centerMapCamera();
      }
      requestMapRender();
      return;
    }
  }

  // 2. Recherche par URL dans le cache si l'ID ne correspondait pas
  for (const [, cached] of preloadedScenesCache.entries()) {
    if (cached && cached.url === url && cached.loaded && cached.img?.complete && cached.img.naturalWidth > 0) {
      bgImage = cached.img;
      bgImageLoading = false;
      if (activeSceneId) preloadedScenesCache.set(activeSceneId, cached);
      rebuildFogCanvas();
      if (!cameraInitialized) {
        centerMapCamera();
      }
      requestMapRender();
      return;
    }
  }

  // 3. Sinon, chargement asynchrone et mise en cache automatique
  bgImageLoading = true;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    bgImage = img;
    bgImageLoading = false;
    if (activeSceneId) {
      preloadedScenesCache.set(activeSceneId, { url, img, loaded: true, error: false });
    }
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
 * Recentre la caméra sur un pion spécifique
 */
function centerCameraOnToken(token) {
  if (!mapCanvas || !token) return;
  const rect = mapCanvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  mapCamera.x = (rect.width / 2) - (token.x * mapCamera.zoom);
  mapCamera.y = (rect.height / 2) - (token.y * mapCamera.zoom);
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

  // 2b. Murs et Portes tactiques
  drawWalls(mapCtx, tacticalMapState.walls, CURRENT_ROLE === 'mj');

  // 2c. Sources de lumière fixes (braseros, feux de camp...)
  drawLights(mapCtx, tacticalMapState.lights);

  // 2d. Terrains difficiles et zones de danger permanent (Feature 3)
  drawZones(mapCtx, tacticalMapState.zones);

  // 2e. Pièges et découvertes dissimulées (Feature 4)
  drawTraps(mapCtx, tacticalMapState.traps, CURRENT_ROLE === 'mj');

  // 2f. Téléporteurs et points de transition de scène (Feature 6)
  drawTeleporters(mapCtx, tacticalMapState.teleporters, CURRENT_ROLE === 'mj');

  // 2g. Objets et Éléments interactifs Bac à Sable (Feature 3)
  drawProps(mapCtx, tacticalMapState.props, CURRENT_ROLE === 'mj');

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
    // Règle de visibilité stricte : un joueur ne voit que son propre pion et les entités (monstres ET alliés) dans son champ de vision direct
    if (!isTokenVisibleToCurrentClient(token)) {
      return;
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
    // Pour les joueurs : voile d'exploration semi-transparent (55%) sur le terrain révélé hors vision active
    if (CURRENT_ROLE !== 'mj') {
      drawPlayerExplorationShroud(mapCtx, worldW, worldH);
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

  // 6b. Prévisualisation en direct lors du tracé d'un mur, gouffre ou porte par le MJ
  if (wallDrawState.isDrawing && CURRENT_ROLE === 'mj') {
    mapCtx.save();
    const isChasm = wallDrawState.toolType === 'chasm';
    const isDoor = wallDrawState.toolType === 'door';
    mapCtx.beginPath();
    mapCtx.moveTo(wallDrawState.startX, wallDrawState.startY);
    mapCtx.lineTo(wallDrawState.currentX, wallDrawState.currentY);
    mapCtx.strokeStyle = isDoor ? '#10b981' : (isChasm ? '#818cf8' : '#f59e0b');
    mapCtx.lineWidth = isDoor ? 5 : 3.5;
    mapCtx.setLineDash(isDoor ? [6, 4] : (isChasm ? [10, 5] : [8, 4]));
    mapCtx.shadowColor = isDoor ? '#059669' : (isChasm ? '#4f46e5' : '#d97706');
    mapCtx.shadowBlur = 10;
    mapCtx.stroke();
    mapCtx.setLineDash([]);

    // Rivets d'extrémité
    [ { x: wallDrawState.startX, y: wallDrawState.startY }, { x: wallDrawState.currentX, y: wallDrawState.currentY } ].forEach((pt) => {
      mapCtx.beginPath();
      mapCtx.arc(pt.x, pt.y, isDoor ? 6 : 5, 0, Math.PI * 2);
      mapCtx.fillStyle = isDoor ? '#34d399' : (isChasm ? '#c7d2fe' : '#fde047');
      mapCtx.strokeStyle = isDoor ? '#064e3b' : (isChasm ? '#3730a3' : '#78350f');
      mapCtx.lineWidth = 2;
      mapCtx.fill();
      mapCtx.stroke();
    });

    const wallLen = Math.hypot(wallDrawState.currentX - wallDrawState.startX, wallDrawState.currentY - wallDrawState.startY);
    const midX = (wallDrawState.startX + wallDrawState.currentX) / 2;
    const midY = (wallDrawState.startY + wallDrawState.currentY) / 2;
    const wallM = ((wallLen / 50) * 1.5).toFixed(1);
    const badgeTitle = isDoor ? `✦ Porte : ${wallM} m ✦` : (isChasm ? `✦ Gouffre : ${wallM} m ✦` : `✦ Mur : ${wallM} m ✦`);
    const badgeColor = isDoor ? '#10b981' : (isChasm ? '#818cf8' : '#f59e0b');
    const badgeText = isDoor ? '#d1fae5' : (isChasm ? '#e0e7ff' : '#fef08a');
    drawMapBadge(mapCtx, midX, midY - 14, badgeTitle, 'rgba(12, 10, 9, 0.94)', badgeColor, badgeText);
    mapCtx.restore();
  }

  // 6c. Prévisualisation en direct lors du tracé d'une surface ou zone de danger par le MJ
  if (zoneDrawState.isDrawing && CURRENT_ROLE === 'mj') {
    drawZonePreview(mapCtx, zoneDrawState);
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

  // 8. Tracés de Craie Tactique (Permanents, Éphémères et Aperçu) & Pings Animés (Feature 2)
  const now = Date.now();

  // A. Tracés permanents
  const permanentDrawings = tacticalMapState.drawings || [];
  permanentDrawings.forEach((stroke) => {
    drawChalkStroke(mapCtx, stroke, false, null);
  });

  // B. Tracés éphémères (décroissance d'opacité sur 5s)
  ephemeralDrawings = ephemeralDrawings.filter((s) => now - s.createdAt < (s.maxAge || 5000));
  ephemeralDrawings.forEach((stroke) => {
    const elapsed = now - stroke.createdAt;
    const maxAge = stroke.maxAge || 5000;
    const remaining = maxAge - elapsed;
    const alpha = remaining < 1500 ? Math.max(0, (remaining / 1500) * 0.95) : 0.95;
    drawChalkStroke(mapCtx, stroke, false, alpha);
  });

  // C. Tracé en cours par l'utilisateur
  if (chalkState.isDrawing && chalkState.currentPoints.length > 0) {
    drawChalkStroke(mapCtx, {
      points: chalkState.currentPoints,
      color: chalkState.color,
      width: chalkState.width,
      author: CURRENT_USER_NAME || (CURRENT_ROLE === 'mj' ? 'MJ' : 'Joueur')
    }, true, 0.9);
  }

  // D. Signaux d'attention animés (Pings)
  drawAnimatedPings(mapCtx, now);

  // Maintien de la boucle d'animation si des éléments visuels temporaires sont actifs
  if (ephemeralDrawings.length > 0 || activePings.length > 0) {
    requestMapRender();
  }

  mapCtx.restore();
}

/**
 * Rendu graphique d'un tracé de craie à main levée
 */
function drawChalkStroke(ctx, stroke, isPreview = false, alphaOverride = null) {
  if (!stroke || !Array.isArray(stroke.points) || stroke.points.length === 0) return;

  const points = stroke.points;
  const color = stroke.color || '#f8fafc';
  const width = Number(stroke.width) || 6;
  const isHovered = !isPreview && hoveredDrawing && hoveredDrawing.id === stroke.id;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;

  if (typeof alphaOverride === 'number') {
    ctx.globalAlpha = Math.max(0, Math.min(1, alphaOverride));
  } else {
    ctx.globalAlpha = isPreview ? 0.85 : 0.95;
  }

  // Effet craie texturée : discret halo de pigment
  ctx.shadowColor = color;
  ctx.shadowBlur = 2;

  if (isHovered) {
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 8;
  }

  ctx.strokeStyle = isHovered ? '#f43f5e' : color;
  ctx.fillStyle = isHovered ? '#f43f5e' : color;

  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
  } else {
    // Lissage par courbes de Bézier quadratiques entre points milieux
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  ctx.stroke();

  // Si survolé en mode gomme, afficher indicateur de gommage
  if (isHovered && points.length > 0) {
    const midPoint = points[Math.floor(points.length / 2)];
    drawMapBadge(ctx, midPoint.x, midPoint.y - 12, `[Gommer : ${stroke.author || 'Craie'}]`, 'rgba(15, 23, 42, 0.95)', '#f43f5e', '#fecdd3');
  }

  ctx.restore();
}

/**
 * Recherche le tracé permanent sous le curseur pour la gomme à craie
 */
function findDrawingAtPoint(worldX, worldY, threshold = 14) {
  const drawings = tacticalMapState.drawings || [];
  for (let i = drawings.length - 1; i >= 0; i--) {
    const d = drawings[i];
    const points = d.points || [];
    if (points.length === 0) continue;

    if (points.length === 1) {
      if (Math.hypot(worldX - points[0].x, worldY - points[0].y) <= (d.width || 6) + threshold) {
        return d;
      }
    } else {
      for (let j = 0; j < points.length - 1; j++) {
        const dist = distToSegment(worldX, worldY, points[j].x, points[j].y, points[j + 1].x, points[j + 1].y);
        if (dist <= ((d.width || 6) / 2) + threshold) {
          return d;
        }
      }
    }
  }
  return null;
}

/**
 * Rendu des signaux d'attention animés (Pings) avec ondes concentriques et balise
 */
function drawAnimatedPings(ctx, now) {
  if (!Array.isArray(activePings) || activePings.length === 0) return;

  activePings = activePings.filter((p) => now - p.createdAt < (p.maxAge || 3500));

  activePings.forEach((ping) => {
    const elapsed = now - ping.createdAt;
    const maxAge = ping.maxAge || 3500;
    const progress = Math.min(1, elapsed / maxAge);
    const globalAlpha = Math.max(0, 1 - progress);

    ctx.save();
    ctx.translate(ping.x, ping.y);

    const baseColor = ping.color || '#f59e0b';

    // 1. Ondes concentriques en expansion
    const numRings = 3;
    for (let rIdx = 0; rIdx < numRings; rIdx++) {
      const ringOffset = rIdx * 0.33;
      const ringProgress = (progress + ringOffset) % 1;
      const radius = 8 + ringProgress * 70;
      const ringAlpha = (1 - ringProgress) * globalAlpha;

      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 3 * (1 - ringProgress);
      ctx.globalAlpha = ringAlpha * 0.9;
      ctx.shadowColor = baseColor;
      ctx.shadowBlur = 10;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Balise centrale en losange clignotant
    const pulseScale = 1 + 0.25 * Math.sin(progress * Math.PI * 8);
    const diamondSize = 9 * pulseScale;

    ctx.save();
    ctx.globalAlpha = globalAlpha;
    ctx.beginPath();
    ctx.moveTo(0, -diamondSize);
    ctx.lineTo(diamondSize, 0);
    ctx.lineTo(0, diamondSize);
    ctx.lineTo(-diamondSize, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = baseColor;
    ctx.shadowBlur = 14;
    ctx.fill();

    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // 3. 4 rayons cardinaux de visée
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;
    const rayLen = 14 + 5 * Math.sin(progress * Math.PI * 6);
    ctx.beginPath(); ctx.moveTo(0, -diamondSize - 2); ctx.lineTo(0, -diamondSize - rayLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, diamondSize + 2); ctx.lineTo(0, diamondSize + rayLen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-diamondSize - 2, 0); ctx.lineTo(-diamondSize - rayLen, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(diamondSize + 2, 0); ctx.lineTo(diamondSize + rayLen, 0); ctx.stroke();
    ctx.restore();

    // 4. Pastille nominative avec l'auteur du signal
    const authorLabel = `[!] ${ping.author || 'Signal'}`;
    drawMapBadge(ctx, 0, -diamondSize - rayLen - 8, authorLabel, 'rgba(12, 10, 9, 0.94)', baseColor, '#fef3c7');

    ctx.restore();
  });
}

/**
 * Émet un signal d'attention (Ping) à des coordonnées mondiales
 */
function sendMapPing(worldX, worldY) {
  if (!CURRENT_ROOM) return;
  const authorName = CURRENT_USER_NAME || (CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : 'Aventurier');
  const pingColor = chalkState.color || (CURRENT_ROLE === 'mj' ? '#f59e0b' : '#38bdf8');

  // Affichage immédiat local
  activePings.push({
    id: `ping_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    x: Math.round(worldX),
    y: Math.round(worldY),
    color: pingColor,
    author: authorName,
    createdAt: Date.now(),
    maxAge: 3500
  });

  socket.emit('map:ping', {
    roomId: CURRENT_ROOM,
    x: Math.round(worldX),
    y: Math.round(worldY),
    color: pingColor,
    author: authorName,
    role: CURRENT_ROLE
  });

  requestMapRender();
}

/**
 * Calcule le score de Perception Passive d'un personnage (Base 10 + Modificateurs de caractéristiques, classe, race et conditions)
 */
function calculatePassivePerception(char, token) {
  let base = 10;
  if (char && char.attributes) {
    const intVal = Number(char.attributes.intelligence) || 10;
    const dexVal = Number(char.attributes.dexterite) || 10;
    const mod = Math.floor((Math.max(intVal, dexVal) - 10) / 2);
    base += mod;
  }

  // Bonus de classe (spécialistes de la détection et du pistage)
  if (char) {
    const vocation = (char.class || char.vocation || '').toLowerCase();
    if (vocation.includes('rodeur') || vocation.includes('rôdeur')) {
      base += 3; // Œil du Faucon & Pistage
    } else if (vocation.includes('voleur')) {
      base += 2; // Sens des pièges & embuscades
    } else if (vocation.includes('clerc')) {
      base += 2; // Vigilance sacrée
    }

    // Bonus de race (sens aiguisés)
    const race = (char.race || '').toLowerCase();
    if (race.includes('elfe')) {
      base += 2; // Sens elfiques affûtés
    } else if (race.includes('gnome')) {
      base += 1; // Curiosité observatrice
    }
  }

  // Impact des altérations tactiques
  if (token) {
    if (hasTokenCondition(token, 'blinded')) {
      return 0; // Obscurité totale : perception visuelle nulle
    }
    if (hasTokenCondition(token, 'confused')) {
      base -= 5;
    }
    if (hasTokenCondition(token, 'blessed')) {
      base += 2;
    }
  }

  return Math.max(0, base);
}

/**
 * Vérifie si un point (px, py) se trouve à l'intérieur d'une zone (rectangle ou cercle)
 */
function isPointInZone(px, py, zone) {
  if (!zone) return false;
  if (zone.shape === 'circle') {
    return Math.hypot(px - zone.x, py - zone.y) <= (zone.r || 50);
  }
  const minX = Math.min(zone.x, zone.x + zone.w);
  const maxX = Math.max(zone.x, zone.x + zone.w);
  const minY = Math.min(zone.y, zone.y + zone.h);
  const maxY = Math.max(zone.y, zone.y + zone.h);
  return px >= minX && px <= maxX && py >= minY && py <= maxY;
}

/**
 * Vérifie si un segment de déplacement (p1 -> p2) traverse ou touche une zone
 */
function doesSegmentIntersectZone(p1, p2, zone) {
  if (!zone) return false;
  if (isPointInZone(p1.x, p1.y, zone) || isPointInZone(p2.x, p2.y, zone)) return true;

  if (zone.shape === 'circle') {
    return distToSegment(zone.x, zone.y, p1.x, p1.y, p2.x, p2.y) <= (zone.r || 50);
  }

  const minX = Math.min(zone.x, zone.x + zone.w);
  const maxX = Math.max(zone.x, zone.x + zone.w);
  const minY = Math.min(zone.y, zone.y + zone.h);
  const maxY = Math.max(zone.y, zone.y + zone.h);

  // Test avec les 4 segments du rectangle
  if (doSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, minX, minY, maxX, minY)) return true;
  if (doSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, maxX, minY, maxX, maxY)) return true;
  if (doSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, maxX, maxY, minX, maxY)) return true;
  if (doSegmentsIntersect(p1.x, p1.y, p2.x, p2.y, minX, maxY, minX, minY)) return true;

  return false;
}

/**
 * Vérifie si une trajectoire complète traverse au moins une zone de terrain difficile
 */
function isPathCrossingDifficultTerrain(path) {
  if (!Array.isArray(path) || path.length < 1) return false;
  const diffZones = (tacticalMapState.zones || []).filter((z) => z.type === 'difficult');
  if (diffZones.length === 0) return false;

  for (const zone of diffZones) {
    for (let i = 0; i < path.length; i++) {
      if (isPointInZone(path[i].x, path[i].y, zone)) return true;
      if (i < path.length - 1) {
        if (doesSegmentIntersectZone(path[i], path[i + 1], zone)) return true;
      }
    }
  }
  return false;
}

/**
 * Recherche une zone située sous le curseur (x, y)
 */
function findZoneAtPoint(x, y) {
  const zones = tacticalMapState.zones || [];
  for (let i = zones.length - 1; i >= 0; i--) {
    if (isPointInZone(x, y, zones[i])) return zones[i];
  }
  return null;
}

/**
 * Recherche une zone de danger actif sous le point (x, y)
 */
function findHazardZoneAtPoint(x, y) {
  const hazards = (tacticalMapState.zones || []).filter((z) => z.type === 'hazard');
  for (let i = hazards.length - 1; i >= 0; i--) {
    if (isPointInZone(x, y, hazards[i])) return hazards[i];
  }
  return null;
}

/**
 * Recherche un piège sous le point (x, y)
 */
function findTrapAtPoint(x, y, radius = 25) {
  const traps = tacticalMapState.traps || [];
  for (let i = traps.length - 1; i >= 0; i--) {
    const t = traps[i];
    const d = Math.hypot(x - t.x, y - t.y);
    if (d <= (t.r || radius)) return t;
  }
  return null;
}

/**
 * Recherche si un segment ou une trajectoire de pion marche sur un piège actif
 */
function findTriggeredTrapAlongPath(path, tokenRadius = 20) {
  if (!Array.isArray(path) || path.length < 2) return null;
  const traps = (tacticalMapState.traps || []).filter((t) => !t.triggered && !t.disarmed);
  if (traps.length === 0) return null;

  for (let i = 0; i < path.length - 1; i++) {
    const p1 = path[i];
    const p2 = path[i + 1];
    for (const trap of traps) {
      const triggerRadius = (trap.r || 25) + tokenRadius * 0.4;
      const d = distToSegment(trap.x, trap.y, p1.x, p1.y, p2.x, p2.y);
      if (d <= triggerRadius) {
        return trap;
      }
    }
  }
  return null;
}

/**
 * Vérifie automatiquement si le score de Perception Passive du joueur connecté
 * permet de déceler des pièges dissimulés dans son champ de vision
 */
function checkPassivePerceptionForTraps() {
  if (CURRENT_ROLE === 'mj') return;
  const myToken = getMyPlayerToken();
  if (!myToken) return;

  const char = [...charactersCache.values()].find(
    (c) => c && (c.slot === myToken.slot || (myToken.name && c.name && c.name.toLowerCase() === myToken.name.toLowerCase()))
  );
  const passiveScore = calculatePassivePerception(char, myToken);
  const visionRadius = getTokenVisionRadius(myToken);
  const walls = (tacticalMapState.walls || []).filter((w) => w.blocksLight !== false);
  const unrevealedTraps = (tacticalMapState.traps || []).filter((t) => !t.revealed && !t.triggered && !t.disarmed);

  unrevealedTraps.forEach((trap) => {
    const d = Math.hypot(trap.x - myToken.x, trap.y - myToken.y);
    // Portée de détection : dans la limite de la vision ou 200px (4 cases)
    if (d <= Math.min(visionRadius, 200)) {
      let lineBlocked = false;
      for (let i = 0; i < walls.length; i++) {
        const w = walls[i];
        if (doSegmentsIntersect(myToken.x, myToken.y, trap.x, trap.y, w.x1, w.y1, w.x2, w.y2)) {
          lineBlocked = true;
          break;
        }
      }
      if (!lineBlocked) {
        if (passiveScore >= (trap.dc || 12)) {
          // Révélation automatique du piège
          trap.revealed = true;
          if (CURRENT_ROOM) {
            socket.emit('map:reveal_trap', {
              roomId: CURRENT_ROOM,
              trapId: trap.id,
              characterName: char ? char.name : myToken.name,
              score: passiveScore,
              dc: trap.dc || 12
            });
          }
          requestMapRender();
        }
      }
    }
  });
}

/**
 * Calcule la vitesse tactique d'un pion en pixels, mètres et cases
 * Intègre la réduction automatique de 50% si le pion démarre ou traverse un terrain difficile (Feature 3)
 */
function getTokenSpeed(token, checkPath = null) {
  if (!token) return { standardPx: 300, dashPx: 600, standardM: 9.0, dashM: 18.0, cases: 6, isSlowed: false };
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

  // Feature 5 : Entravé ou Endormi -> Déplacement bloqué (0)
  if (hasTokenCondition(token, 'restrained') || hasTokenCondition(token, 'asleep')) {
    standardPx = 0;
  } else if (hasTokenCondition(token, 'prone')) {
    // Feature 5 : À terre (Prone) -> Vitesse divisée par deux
    standardPx = Math.floor(standardPx / 2);
  }

  // Feature 3 : Surfaces ralentissantes (Marais, Eau profonde, Gravats, Toiles d'araignée)
  // Réduction automatique de 50% de la vitesse quand le pion démarre ou traverse la zone
  let isSlowed = false;
  const pathToCheck = Array.isArray(checkPath) && checkPath.length > 0
    ? checkPath
    : [{ x: token.x, y: token.y }];

  if (isPathCrossingDifficultTerrain(pathToCheck)) {
    isSlowed = true;
    standardPx = Math.floor(standardPx * 0.5);
  }

  const standardM = (standardPx / 50) * 1.5;
  const dashPx = standardPx * 2;
  const dashM = standardM * 2;
  const cases = standardPx / 50;
  return { standardPx, dashPx, standardM, dashM, cases, isSlowed };
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
  const fullPath = isDrag && dragStart ? [dragStart, { x: token.x, y: token.y }] : [{ x: token.x, y: token.y }];
  const speed = getTokenSpeed(token, fullPath);
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
    const tokenRadius = (token.size || 40) / 2;

    // 1. Cercle fantôme de départ
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, tokenRadius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Cercle de mouvement standard (Zone Bleue - ex. 9m / 300px)
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, speed.standardPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]);
    ctx.stroke();

    // 3. Cercle d'action Course / Dash (Cercle Jaune - Limite stricte de déplacement, ex. 18m / 600px)
    ctx.beginPath();
    ctx.arc(dragStart.x, dragStart.y, speed.dashPx, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(234, 179, 8, 0.06)';
    ctx.fill();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 6]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Tracé du Chemin direct de déplacement
    const p1 = dragStart;
    const p2 = { x: token.x, y: token.y };
    const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    let anyCollision = false;
    let blockingWall = null;

    if (segDist >= 1) {
      // Détection d'obstacle (mur ou gouffre) sur ce déplacement
      const col = checkWallCollision(p1.x, p1.y, p2.x, p2.y, tokenRadius);
      if (col.collided) {
        anyCollision = true;
        blockingWall = col.wall;
      }

      // Couleur de trajectoire contextuelle
      let segColor = '#38bdf8';
      let segWidth = 2.5;
      if (col.collided) {
        segColor = '#ef4444'; // Alerte collision rouge vive
        segWidth = 3.5;
      } else if (segDist > speed.standardPx) {
        segColor = '#eab308'; // Zone de Course (Dash)
      }

      // Ligne pointillée
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = segColor;
      ctx.lineWidth = segWidth;
      ctx.setLineDash([7, 5]);
      if (col.collided) {
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.shadowBlur = 0;

      // Graduations tactiques case par case (1 case = 50px = 1.5m)
      if (segDist >= 25) {
        const ux = (p2.x - p1.x) / segDist;
        const uy = (p2.y - p1.y) / segDist;
        const nx = -uy;
        const ny = ux;

        for (let d = 50; d < segDist; d += 50) {
          const tx = p1.x + ux * d;
          const ty = p1.y + uy * d;
          ctx.beginPath();
          ctx.moveTo(tx - nx * 6, ty - ny * 6);
          ctx.lineTo(tx + nx * 6, ty + ny * 6);
          ctx.strokeStyle = col.collided ? '#ef4444' : (segDist > speed.standardPx ? '#fde047' : '#7dd3fc');
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    // C. Silhouette du Pion Fantôme (Ghost Token) au point de destination
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y, tokenRadius + 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(212, 175, 55, 0.18)';
    ctx.fill();
    ctx.strokeStyle = anyCollision ? '#ef4444' : '#fde047';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();

    // D. Badge récapitulatif global au-dessus du point d'arrivée
    const totalDistM = (cumulativeDistPx / 50) * 1.5;
    const totalCases = cumulativeDistPx / 50;

    let trajColor = '#38bdf8';
    let trajBorder = '#0284c7';
    let trajText = speed.isSlowed
      ? `✦ Mouvement Ralenti (50%) : ${totalDistM.toFixed(1)} m / ${speed.standardM.toFixed(1)} m (${totalCases.toFixed(1)} c) ✦`
      : `✦ Mouvement Normal : ${totalDistM.toFixed(1)} m / ${speed.standardM.toFixed(1)} m (${totalCases.toFixed(1)} c) ✦`;

    if (anyCollision) {
      const isChasm = blockingWall?.wallType === 'chasm' || blockingWall?.blocksLight === false;
      trajColor = '#ef4444';
      trajBorder = '#dc2626';
      trajText = isChasm
        ? `✕ Trajectoire Obstruée : Gouffre Infranchissable Détecté ! ✕`
        : `✕ Trajectoire Obstruée : Mur de Pierre Détecté ! ✕`;
    } else if (cumulativeDistPx > speed.standardPx) {
      trajColor = '#eab308';
      trajBorder = '#ca8a04';
      trajText = speed.isSlowed
        ? `[>>] Course Ralentie (Dash -50%) : ${totalDistM.toFixed(1)} m / ${speed.dashM.toFixed(1)} m (${totalCases.toFixed(1)} c) - Fin de tour auto ! [>>]`
        : `[>>] Course (Dash) : ${totalDistM.toFixed(1)} m / ${speed.dashM.toFixed(1)} m (${totalCases.toFixed(1)} c) - Fin de tour auto ! [>>]`;
    }

    drawMapBadge(
      ctx,
      token.x,
      token.y - tokenRadius - 20,
      trajText,
      anyCollision ? 'rgba(69, 10, 10, 0.96)' : 'rgba(12, 10, 9, 0.94)',
      trajBorder,
      '#ffffff'
    );

    // E. Indication des touches raccourcis de point de passage
    drawMapBadge(
      ctx,
      token.x,
      token.y + tokenRadius + 28,
      `[Shift / Clic Molette: +Étape | Retour: -Étape]`,
      'rgba(12, 10, 9, 0.88)',
      '#78350f',
      '#d6d3d1'
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
      if (!isTokenVisibleToCurrentClient(t)) return;
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
      if (!isTokenVisibleToCurrentClient(t)) return;
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
      if (!isTokenVisibleToCurrentClient(t)) return;
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

  // Feature 5 : Effet d'Invisibilité (semi-transparence éthérée pour MJ et propriétaire)
  const isInvisible = hasTokenCondition(token, 'invisible');
  if (isInvisible) {
    ctx.globalAlpha = 0.45;
  }

  // Feature 5 : Auras et Effets Visuels des Altérations d'État
  const now = Date.now();

  // A. Brûlé (Flammes ardentes et braises)
  if (hasTokenCondition(token, 'burning')) {
    ctx.save();
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2 + Math.sin(now / 180 + f) * 0.35;
      const dist = radius + 4 + Math.sin(now / 140 + f * 2) * 3;
      const fx = token.x + Math.cos(angle) * dist;
      const fy = token.y + Math.sin(angle) * dist - 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = f % 2 === 0 ? '#f97316' : '#ea580c';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 8;
      ctx.fill();
    }
    ctx.restore();
  }

  // B. Empoisonné (Gouttelettes et vapeurs toxiques émeraudes)
  if (hasTokenCondition(token, 'poisoned')) {
    ctx.save();
    for (let b = 0; b < 5; b++) {
      const angle = (b / 5) * Math.PI * 2 + now / 800;
      const dist = radius + 3 + (Math.sin(now / 220 + b) + 1) * 3;
      const bx = token.x + Math.cos(angle) * dist;
      const by = token.y + Math.sin(angle) * dist - 3;
      ctx.beginPath();
      ctx.arc(bx, by, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#22c55e';
      ctx.shadowColor = '#16a34a';
      ctx.shadowBlur = 7;
      ctx.fill();
    }
    ctx.restore();
  }

  // C. Maudit (Runes nécrotiques et halo spectral pourpre)
  if (hasTokenCondition(token, 'cursed')) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius + 6 + Math.sin(now / 350) * 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 4]);
    ctx.shadowColor = '#7e22ce';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
  }

  // D. Béni (Éclat sacré et rayons divins dorés)
  if (hasTokenCondition(token, 'blessed')) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius + 7 + Math.sin(now / 250) * 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2.2;
    ctx.shadowColor = '#fde047';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.restore();
  }

  // E. Endormi (Zzz flottants)
  if (hasTokenCondition(token, 'asleep')) {
    ctx.save();
    const zOff = (now / 350) % 18;
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#818cf8';
    ctx.shadowColor = '#4338ca';
    ctx.shadowBlur = 6;
    ctx.fillText('Zzz', token.x + radius * 0.7, token.y - radius - zOff);
    ctx.restore();
  }

  // F. Amoureux (Cœurs roses en orbite)
  if (hasTokenCondition(token, 'charmed')) {
    ctx.save();
    const hAngle = now / 400;
    const hx = token.x + Math.cos(hAngle) * (radius + 8);
    const hy = token.y + Math.sin(hAngle) * (radius + 8);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = '#ec4899';
    ctx.shadowColor = '#db2777';
    ctx.shadowBlur = 8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('<3', hx, hy);
    ctx.restore();
  }

  // G. Confus (Spirale / étourdissement au sommet du pion)
  if (hasTokenCondition(token, 'confused')) {
    ctx.save();
    const spin = now / 250;
    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#be123c';
    ctx.shadowBlur = 6;
    ctx.textAlign = 'center';
    ctx.fillText('~?~', token.x, token.y - radius - 5 + Math.sin(spin) * 3);
    ctx.restore();
  }

  // H. Entravé (Chaînes grises enserrant la base)
  if (hasTokenCondition(token, 'restrained')) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius + 2, 0, Math.PI * 2);
    ctx.strokeStyle = '#a8a29e';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.restore();
  }

  // I. À terre (Indicateur sous le pion)
  if (hasTokenCondition(token, 'prone')) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(token.x, token.y + radius * 0.65, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#57534e';
    ctx.fill();
    ctx.restore();
  }

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

  // J. Aveuglé : Masque d'obscurité / bandeau sur le pion
  if (hasTokenCondition(token, 'blinded')) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(token.x - radius * 0.8, token.y - 4, radius * 1.6, 8);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Icône ou Initiale au centre du pion
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(radius * 1.15)}px sans-serif`;
  const iconStr = token.icon || (token.name ? token.name[0].toUpperCase() : '[X]');
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

  // Badge [INVISIBLE] si le pion est invisible
  if (isInvisible) {
    ctx.save();
    ctx.font = 'bold 8px Cinzel, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.textAlign = 'center';
    ctx.fillText('[INVISIBLE]', token.x, token.y - radius - 5);
    ctx.restore();
  }

  // Feature 5 : Marqueurs visuels - Icônes de statut affichées sur la bordure du socle du pion
  const activeConditions = getTokenConditions(token);
  if (activeConditions.length > 0) {
    ctx.save();
    const badgeR = 7.5;
    const totalBadges = Math.min(activeConditions.length, 5);
    const startAng = -Math.PI * 0.8;
    const angStep = (Math.PI * 0.6) / Math.max(1, totalBadges - 1);

    for (let i = 0; i < totalBadges; i++) {
      const cond = activeConditions[i];
      const ang = totalBadges === 1 ? -Math.PI / 2 : startAng + i * angStep;
      const bx = token.x + Math.cos(ang) * (radius + 2);
      const by = token.y + Math.sin(ang) * (radius + 2);

      // Fond médaillon
      ctx.beginPath();
      ctx.arc(bx, by, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(12, 10, 9, 0.95)';
      ctx.fill();
      ctx.strokeStyle = cond.color || '#d4af37';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = cond.color || '#000';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Glyphe ASCII de statut
      ctx.font = 'bold 8px monospace';
      ctx.fillStyle = cond.color || '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const glyph = (cond.icon || '[?]').replace(/[\[\]]/g, '').slice(0, 2);
      ctx.fillText(glyph, bx, by);

      // Compte à rebours du nombre de tours restants
      if (typeof cond.duration === 'number' && cond.duration > 0) {
        ctx.font = 'bold 7px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(`${cond.duration}`, bx + 5, by - 5);
      }
    }
    ctx.restore();
  }

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

  // Torche allumée portée par le pion
  if (token.hasTorch) {
    ctx.save();
    const now = Date.now();
    const flicker = Math.sin(now / 140) * 2;
    const tx = token.x + radius * 0.7;
    const ty = token.y - radius * 0.7;

    // Halo doré autour du pion
    ctx.beginPath();
    ctx.arc(token.x, token.y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Hampe de la torche
    ctx.beginPath();
    ctx.moveTo(tx - 3, ty + 12);
    ctx.lineTo(tx + 3, ty + 12);
    ctx.lineTo(tx + 2, ty + 2);
    ctx.lineTo(tx - 2, ty + 2);
    ctx.closePath();
    ctx.fillStyle = '#78350f';
    ctx.fill();

    // Flamme ardente
    ctx.beginPath();
    ctx.arc(tx, ty, 5.5 + flicker, 0, Math.PI * 2);
    ctx.fillStyle = '#f59e0b';
    ctx.shadowColor = '#ea580c';
    ctx.shadowBlur = 12;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(tx, ty - 1, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();

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
 * Trouve la source de lumière fixe la plus proche d'un point (pour la détection / suppression par le MJ)
 */
function findLightAtPoint(x, y, threshold = 22) {
  const lights = tacticalMapState.lights || [];
  let closest = null;
  let minDist = threshold;
  for (let i = 0; i < lights.length; i++) {
    const l = lights[i];
    const d = Math.hypot(x - l.x, y - l.y);
    if (d < minDist) {
      minDist = d;
      closest = l;
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

  walls.forEach((w) => {
    const isHovered = hoveredWall && hoveredWall.id === w.id;
    const isDoor = w.wallType === 'door';
    const isChasm = !isDoor && (w.wallType === 'chasm' || w.blocksLight === false);

    if (isDoor) {
      const isOpen = Boolean(w.isOpen);
      const isLocked = Boolean(w.isLocked);

      // Calcul géométrique de la porte
      const dx = w.x2 - w.x1;
      const dy = w.y2 - w.y1;
      const len = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const midX = (w.x1 + w.x2) / 2;
      const midY = (w.y1 + w.y2) / 2;

      // 1. Poteaux et chambranles de pierre/fer à chaque extrémité
      [ { x: w.x1, y: w.y1 }, { x: w.x2, y: w.y2 } ].forEach((pt) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#292524';
        ctx.strokeStyle = isHovered ? '#ef4444' : '#78350f';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#d4af37';
        ctx.fill();
      });

      if (isOpen) {
        // --- PORTE OUVERTE ---
        // Vantail pivoté ouvert le long d'un montant (angle ~75 degrés)
        const openAngle = angle + Math.PI * 0.42;
        const leafLen = Math.min(len * 0.85, 45);
        const leafEndX = w.x1 + Math.cos(openAngle) * leafLen;
        const leafEndY = w.y1 + Math.sin(openAngle) * leafLen;

        ctx.save();
        // Arc de pivotement en pointillés
        ctx.beginPath();
        ctx.arc(w.x1, w.y1, leafLen, angle, openAngle, false);
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Vantail ouvert en chêne foncé
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(leafEndX, leafEndY);
        ctx.lineWidth = 5;
        ctx.strokeStyle = isHovered ? '#ef4444' : '#573318';
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(leafEndX, leafEndY);
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#d4af37';
        ctx.stroke();

        // Passage dégagé avec filet émeraude doux
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Badge informatif au survol
        if (isHovered) {
          const badgeText = isGM ? '✦ Porte Ouverte [Clic: Fermer | Clic Droit: Verrouiller] ✦' : '✦ Porte Ouverte (Cliquer pour fermer) ✦';
          drawMapBadge(ctx, midX, midY - 14, badgeText, 'rgba(6, 78, 59, 0.95)', '#10b981', '#a7f3d0');
        }

      } else {
        // --- PORTE FERMÉE ---
        ctx.save();

        // 1. Ombre portée sous le battant fermé
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.lineWidth = 9;
        ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 0, 0, 0.8)';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.stroke();

        // 2. Battant de bois noble massif (chêne / fer forgé)
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.lineWidth = 6;
        ctx.strokeStyle = isHovered ? '#b91c1c' : '#451a03';
        ctx.shadowBlur = 0;
        ctx.stroke();

        // 3. Bandes de renfort métalliques en bronze / laiton
        ctx.beginPath();
        ctx.moveTo(w.x1, w.y1);
        ctx.lineTo(w.x2, w.y2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = isLocked ? '#b91c1c' : (isHovered ? '#fca5a5' : '#b45309');
        ctx.stroke();

        // 4. Serrure / Cadenas central
        ctx.beginPath();
        ctx.arc(midX, midY, isLocked ? 5.5 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isLocked ? '#991b1b' : '#d4af37';
        ctx.strokeStyle = isLocked ? '#ef4444' : '#78350f';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        if (isLocked) {
          // Anneau supérieur du cadenas
          ctx.beginPath();
          ctx.arc(midX, midY - 4.5, 3, Math.PI, 0, false);
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        ctx.restore();

        // Badge au survol
        if (isHovered) {
          let badgeText = '';
          if (isLocked) {
            badgeText = isGM ? '✦ Porte Verrouillée [Clic: Ouvrir | Clic Droit: Déverrouiller] ✦' : '✦ Porte Verrouillée à Clé ✦';
            drawMapBadge(ctx, midX, midY - 16, badgeText, 'rgba(69, 10, 10, 0.95)', '#ef4444', '#fecaca');
          } else {
            badgeText = isGM ? '✦ Porte Fermée [Clic: Ouvrir | Clic Droit: Verrouiller] ✦' : '✦ Porte Fermée (Cliquer pour ouvrir) ✦';
            drawMapBadge(ctx, midX, midY - 16, badgeText, 'rgba(12, 10, 9, 0.95)', '#f59e0b', '#fef08a');
          }
        }
      }

    } else if (isChasm) {
      // 1. Fond d'abîme et néant ténébreux
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.lineWidth = 14;
      ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 0.6)' : 'rgba(2, 6, 23, 0.95)';
      ctx.shadowColor = isHovered ? '#ef4444' : '#000000';
      ctx.shadowBlur = isHovered ? 12 : 8;
      ctx.stroke();

      // 2. Cœur de faille abyssale indigo sombre
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.lineWidth = 7;
      ctx.strokeStyle = isHovered ? '#b91c1c' : '#1e1b4b';
      ctx.shadowBlur = 0;
      ctx.stroke();

      // 3. Fissure éthérée / bord de gouffre
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = isHovered ? '#fca5a5' : '#6366f1';
      ctx.stroke();

      // 4. Ligne centrale brisée
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isHovered ? '#ffffff' : '#c7d2fe';
      ctx.setLineDash([8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Mur en pierre taillée / fer forgé standard
      // 1. Ombre portée et fondation des murs
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.lineWidth = 10;
      ctx.strokeStyle = isHovered ? 'rgba(239, 68, 68, 0.5)' : 'rgba(0, 0, 0, 0.75)';
      ctx.shadowColor = isHovered ? '#ef4444' : '#000000';
      ctx.shadowBlur = isHovered ? 12 : 6;
      ctx.stroke();

      // 2. Corps du mur en pierre volcanique / fer forgé
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
    }
  });

  // 5. Piliers et rivets d'ancrage aux extrémités (Visibles pour le MJ)
  if (isGM) {
    walls.forEach((w) => {
      if (w.wallType === 'door') return; // Déjà pourvu de chambranles dédiés
      const isHovered = hoveredWall && hoveredWall.id === w.id;
      const isChasm = w.wallType === 'chasm' || w.blocksLight === false;
      const nodeColor = isHovered ? '#ef4444' : (isChasm ? '#818cf8' : '#d4af37');
      const nodeBorder = isHovered ? '#fee2e2' : (isChasm ? '#312e81' : '#78350f');

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
    const isChasm = wallCollisionActive.isChasm;
    const isDoor = wallCollisionActive.isDoor;

    ctx.save();
    ctx.beginPath();
    ctx.arc(wallCollisionActive.x, wallCollisionActive.y, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = isChasm ? `rgba(129, 140, 248, ${alpha})` : `rgba(239, 68, 68, ${alpha})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = isChasm ? '#4f46e5' : '#dc2626';
    ctx.shadowBlur = 12;
    ctx.stroke();

    ctx.font = 'bold 9px Cinzel, Georgia, serif';
    ctx.fillStyle = isChasm ? `rgba(224, 231, 255, ${alpha})` : `rgba(254, 226, 226, ${alpha})`;
    ctx.textAlign = 'center';
    const collText = isDoor ? '✦ PORTE FERMÉE ✦' : (isChasm ? '✦ GOUFFRE INFRANCHISSABLE ✦' : '✦ MUR INFRANCHISSABLE ✦');
    ctx.fillText(collText, wallCollisionActive.x, wallCollisionActive.y - pulseR - 4);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Dessine les sources de lumière fixes (braseros, feux de camp...) posées par le MJ
 */
function drawLights(ctx, lights) {
  if (!lights || !lights.length) return;

  const now = Date.now();
  const flicker = Math.sin(now / 160) * 3 + Math.cos(now / 90) * 1.5;

  lights.forEach((l) => {
    if (l.enabled === false) return;
    const r = (l.radius || 400) + flicker * 2;

    ctx.save();

    // 1. Halo d'illumination au sol
    const grad = ctx.createRadialGradient(l.x, l.y, 8, l.x, l.y, r);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.40)');
    grad.addColorStop(0.3, 'rgba(245, 158, 11, 0.22)');
    grad.addColorStop(0.7, 'rgba(217, 119, 6, 0.08)');
    grad.addColorStop(1, 'rgba(180, 83, 9, 0)');

    ctx.beginPath();
    ctx.arc(l.x, l.y, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Socle métallique / vasque du brasero
    ctx.beginPath();
    ctx.arc(l.x, l.y, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1917';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.stroke();

    // 3. Braises ardentes et flamme vacillante
    ctx.beginPath();
    ctx.arc(l.x, l.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(l.x, l.y, 4.5 + Math.sin(now / 120) * 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 14;
    ctx.fill();

    // 4. Cartouche descriptif pour le MJ
    if (CURRENT_ROLE === 'mj') {
      ctx.font = 'bold 8px Cinzel, Georgia, serif';
      ctx.fillStyle = '#fef08a';
      ctx.textAlign = 'center';
      ctx.fillText(l.label || 'Brasero 12m', l.x, l.y + 22);
    }

    ctx.restore();
  });
}

/**
 * Dessine les surfaces ralentissantes et zones de danger permanent sur la Battlemap (Feature 3)
 */
function drawZones(ctx, zones) {
  if (!Array.isArray(zones) || zones.length === 0) return;

  const now = Date.now();
  ctx.save();

  zones.forEach((z) => {
    const isHovered = hoveredZone && hoveredZone.id === z.id;
    const isHazard = z.type === 'hazard';
    const subType = z.subType || 'swamp';

    ctx.save();

    // 1. Définition des couleurs selon le sous-type
    let fillColor = 'rgba(77, 124, 15, 0.35)';
    let strokeColor = '#65a30d';
    let label = z.name || 'Terrain Difficile';

    if (subType === 'water') {
      fillColor = 'rgba(2, 132, 199, 0.35)';
      strokeColor = '#38bdf8';
    } else if (subType === 'rubble') {
      fillColor = 'rgba(120, 113, 108, 0.38)';
      strokeColor = '#a8a29e';
    } else if (subType === 'web') {
      fillColor = 'rgba(241, 245, 249, 0.14)';
      strokeColor = '#cbd5e1';
    } else if (subType === 'fire') {
      const pulse = Math.sin(now / 180) * 0.08;
      fillColor = `rgba(234, 88, 12, ${0.40 + pulse})`;
      strokeColor = '#f97316';
    } else if (subType === 'poison') {
      const pulse = Math.cos(now / 220) * 0.06;
      fillColor = `rgba(22, 163, 74, ${0.38 + pulse})`;
      strokeColor = '#22c55e';
    } else if (subType === 'acid') {
      const pulse = Math.sin(now / 150) * 0.07;
      fillColor = `rgba(132, 204, 22, ${0.38 + pulse})`;
      strokeColor = '#a3e635';
    }

    if (isHovered) {
      strokeColor = '#fef08a';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 10;
    }

    // 2. Tracé géométrique (Rectangle ou Cercle)
    if (z.shape === 'circle') {
      const r = z.r || 50;
      ctx.beginPath();
      ctx.arc(z.x, z.y, r, 0, Math.PI * 2);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash(isHazard ? [6, 4] : [8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Texture interne pour les toiles d'araignées
      if (subType === 'web') {
        ctx.strokeStyle = 'rgba(241, 245, 249, 0.45)';
        ctx.lineWidth = 1;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(z.x, z.y);
          ctx.lineTo(z.x + Math.cos(a) * r, z.y + Math.sin(a) * r);
          ctx.stroke();
        }
        [0.35, 0.65, 0.95].forEach((frac) => {
          ctx.beginPath();
          ctx.arc(z.x, z.y, r * frac, 0, Math.PI * 2);
          ctx.stroke();
        });
      }

      // Badge informatif au centre de la zone circulaire
      drawMapBadge(
        ctx,
        z.x,
        z.y,
        label,
        'rgba(12, 10, 9, 0.92)',
        strokeColor,
        isHazard ? '#fed7aa' : '#ecfccb'
      );
    } else {
      // Rectangle
      const minX = Math.min(z.x, z.x + (z.w || 100));
      const minY = Math.min(z.y, z.y + (z.h || 100));
      const w = Math.abs(z.w || 100);
      const h = Math.abs(z.h || 100);

      ctx.beginPath();
      ctx.rect(minX, minY, w, h);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.setLineDash(isHazard ? [6, 4] : [8, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ondulations d'eau pour l'eau profonde
      if (subType === 'water') {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1.5;
        const waveStep = 35;
        for (let wy = minY + 20; wy < minY + h - 10; wy += waveStep) {
          const shift = Math.sin((now / 300) + wy) * 6;
          ctx.beginPath();
          ctx.moveTo(minX + 15, wy);
          ctx.bezierCurveTo(
            minX + w * 0.33 + shift, wy - 5,
            minX + w * 0.66 - shift, wy + 5,
            minX + w - 15, wy
          );
          ctx.stroke();
        }
      }

      // Braises vacillantes pour les flammes
      if (subType === 'fire') {
        ctx.fillStyle = '#fef08a';
        for (let i = 0; i < 4; i++) {
          const sx = minX + 20 + ((i * 47 + Math.sin(now / 200 + i) * 15) % Math.max(10, w - 40));
          const sy = minY + 20 + ((i * 31 + Math.cos(now / 180 + i) * 10) % Math.max(10, h - 40));
          ctx.beginPath();
          ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Badge informatif au centre de la zone rectangulaire
      drawMapBadge(
        ctx,
        minX + w / 2,
        minY + h / 2,
        label,
        'rgba(12, 10, 9, 0.92)',
        strokeColor,
        isHazard ? '#fed7aa' : '#ecfccb'
      );
    }

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Prévisualisation en direct lors du tracé d'une surface ou zone de danger par le MJ
 */
function drawZonePreview(ctx, state) {
  if (!state || !state.isDrawing) return;

  const minX = Math.min(state.startX, state.currentX);
  const minY = Math.min(state.startY, state.currentY);
  const w = Math.abs(state.currentX - state.startX);
  const h = Math.abs(state.currentY - state.startY);

  const subType = state.subType || 'swamp';
  const isHazard = ['fire', 'poison', 'acid'].includes(subType);
  const color = isHazard ? '#ea580c' : '#84cc16';

  ctx.save();
  ctx.beginPath();
  ctx.rect(minX, minY, w, h);
  ctx.fillStyle = isHazard ? 'rgba(234, 88, 12, 0.25)' : 'rgba(132, 204, 22, 0.25)';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);

  const wM = ((w / 50) * 1.5).toFixed(1);
  const hM = ((h / 50) * 1.5).toFixed(1);
  const badgeText = `✦ Zone ${subType.toUpperCase()} : ${wM}m x ${hM}m ✦`;
  drawMapBadge(ctx, minX + w / 2, minY + h / 2, badgeText, 'rgba(12, 10, 9, 0.95)', color, '#ffffff');
  ctx.restore();
}

/**
 * Dessine les pièges et découvertes dissimulées sur la Battlemap (Feature 4)
 * - Masqué totalement pour les joueurs tant qu'il n'est pas révélé ou déclenché
 * - Visible pour le MJ avec contour translucide et seuil de perception passive (DD)
 */
function drawTraps(ctx, traps, isGM) {
  if (!Array.isArray(traps) || traps.length === 0) return;

  const now = Date.now();
  ctx.save();

  traps.forEach((t) => {
    // Règle d'invisibilité stricte pour les joueurs
    if (!isGM && !t.revealed && !t.triggered) {
      return;
    }

    const r = t.r || 25;
    const isSecretPassage = t.subType === 'secret_passage';
    const isHovered = hoveredTrap && hoveredTrap.id === t.id;

    ctx.save();

    if (t.triggered) {
      // --- PIÈGE DÉCLENCHÉ ---
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(127, 29, 29, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Croix de déflagration / mâchoires refermées
      ctx.beginPath();
      ctx.moveTo(t.x - 12, t.y - 12);
      ctx.lineTo(t.x + 12, t.y + 12);
      ctx.moveTo(t.x + 12, t.y - 12);
      ctx.lineTo(t.x - 12, t.y + 12);
      ctx.strokeStyle = '#fee2e2';
      ctx.lineWidth = 2;
      ctx.stroke();

      drawMapBadge(ctx, t.x, t.y - r - 10, `[DÉCLENCHÉ] ${t.name}`, 'rgba(69, 10, 10, 0.95)', '#ef4444', '#fecaca');

    } else if (t.disarmed) {
      // --- PIÈGE DÉSAMORCÉ ---
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 78, 59, 0.30)';
      ctx.fill();
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Symbole sécurisé
      ctx.font = 'bold 12px Cinzel, monospace';
      ctx.fillStyle = '#a7f3d0';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('[✓]', t.x, t.y);

      drawMapBadge(ctx, t.x, t.y - r - 10, `[DÉSAMORCÉ] ${t.name}`, 'rgba(6, 78, 59, 0.95)', '#10b981', '#d1fae5');

    } else if (t.revealed) {
      // --- PIÈGE RÉVÉLÉ (DÉCOUVERT PAR PERCEPTION PASSIVE) ---
      const pulse = Math.sin(now / 180) * 3;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r + pulse, 0, Math.PI * 2);
      ctx.fillStyle = isSecretPassage ? 'rgba(56, 189, 248, 0.25)' : 'rgba(245, 158, 11, 0.25)';
      ctx.fill();
      ctx.strokeStyle = isSecretPassage ? '#38bdf8' : '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = isSecretPassage ? '#0284c7' : '#d97706';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Symbole d'alerte runique
      ctx.font = 'bold 13px Cinzel, monospace';
      ctx.fillStyle = isSecretPassage ? '#e0f2fe' : '#fef08a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isSecretPassage ? '[⊓]' : '[!]', t.x, t.y);

      const badgeColor = isSecretPassage ? '#38bdf8' : '#f59e0b';
      const badgeText = isSecretPassage ? `[SECRET] ${t.name}` : `[RÉVÉLÉ: DD ${t.dc}] ${t.name}`;
      drawMapBadge(ctx, t.x, t.y - r - 12, badgeText, 'rgba(12, 10, 9, 0.95)', badgeColor, '#ffffff');

    } else if (isGM) {
      // --- PIÈGE DISSIMULÉ (VISIBLE POUR LE MJ AVEC CONTOUR TRANSLUCIDE) ---
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSecretPassage ? 'rgba(99, 102, 241, 0.15)' : 'rgba(239, 68, 68, 0.15)';
      ctx.fill();
      ctx.strokeStyle = isSecretPassage ? 'rgba(129, 140, 248, 0.70)' : 'rgba(248, 113, 113, 0.70)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Repère discret pour le MJ
      ctx.font = 'bold 11px Cinzel, monospace';
      ctx.fillStyle = isSecretPassage ? 'rgba(165, 180, 252, 0.90)' : 'rgba(252, 165, 165, 0.90)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(isSecretPassage ? '[⊓]' : '[?]', t.x, t.y);

      // Cartouche informatif pour le MJ
      const badgeBorder = isSecretPassage ? '#6366f1' : '#dc2626';
      drawMapBadge(
        ctx,
        t.x,
        t.y - r - 10,
        `[Dissimulé: DD ${t.dc}] ${t.name}`,
        'rgba(12, 10, 9, 0.90)',
        badgeBorder,
        '#fef08a'
      );
    }

    ctx.restore();
  });

  ctx.restore();
}

/**
 * Dessine les téléporteurs et points de transition de scène (Feature 6)
 */
function drawTeleporters(ctx, teleporters, isGM) {
  if (!Array.isArray(teleporters) || teleporters.length === 0) return;

  const now = Date.now();
  ctx.save();

  teleporters.forEach((tp) => {
    const r = tp.r || 30;
    const isHovered = hoveredTeleport && hoveredTeleport.id === tp.id;
    const type = tp.type || 'stairs_down';

    ctx.save();
    ctx.translate(tp.x, tp.y);

    // Halo d'aura externe pulsant
    const pulse = Math.sin(now / 220) * 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + pulse + (isHovered ? 4 : 0), 0, Math.PI * 2);

    if (type === 'portal') {
      ctx.fillStyle = isHovered ? 'rgba(99, 102, 241, 0.40)' : 'rgba(99, 102, 241, 0.25)';
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = isHovered ? 18 : 10;
    } else if (type === 'stairs_up') {
      ctx.fillStyle = isHovered ? 'rgba(14, 165, 233, 0.40)' : 'rgba(14, 165, 233, 0.25)';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur = isHovered ? 16 : 8;
    } else if (type === 'stairs_down') {
      ctx.fillStyle = isHovered ? 'rgba(6, 182, 212, 0.40)' : 'rgba(6, 182, 212, 0.25)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#0891b2';
      ctx.shadowBlur = isHovered ? 16 : 8;
    } else {
      ctx.fillStyle = isHovered ? 'rgba(217, 119, 6, 0.40)' : 'rgba(217, 119, 6, 0.25)';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#b45309';
      ctx.shadowBlur = isHovered ? 16 : 8;
    }

    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Motif intérieur selon le type
    if (type === 'portal') {
      const angle = (now / 600) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.55, 0, Math.PI * 1.5);
      ctx.strokeStyle = '#c7d2fe';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      ctx.font = 'bold 13px Cinzel, monospace';
      ctx.fillStyle = '#e0e7ff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('[◎]', 0, 0);

    } else if (type === 'stairs_down' || type === 'stairs_up') {
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = 'bold 13px Cinzel, monospace';
      ctx.fillStyle = '#ecfeff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type === 'stairs_down' ? '[▼]' : '[▲]', 0, 0);

    } else {
      ctx.beginPath();
      ctx.moveTo(-10, -12); ctx.lineTo(-10, 12);
      ctx.moveTo(10, -12); ctx.lineTo(10, 12);
      ctx.moveTo(-10, -6); ctx.lineTo(10, -6);
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.moveTo(-10, 6); ctx.lineTo(10, 6);
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.font = 'bold 11px Cinzel, monospace';
      ctx.fillStyle = '#fef3c7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('[H]', 0, 0);
    }

    ctx.restore();

    // Cartouche informatif au-dessus du téléporteur
    const typeIcons = {
      'stairs_down': '[▼]',
      'stairs_up': '[▲]',
      'portal': '[◎]',
      'ladder': '[H]'
    };
    const icon = typeIcons[type] || '[▼]';
    const badgeText = `${icon} ${tp.name || 'Transition'}`;
    const badgeColor = type === 'portal' ? '#818cf8' : (type === 'ladder' ? '#f59e0b' : '#06b6d4');
    drawMapBadge(ctx, tp.x, tp.y - r - 12, badgeText, 'rgba(12, 10, 9, 0.95)', badgeColor, '#ffffff');

    // Pour le MJ : afficher les coordonnées cibles
    if (isGM && tp.targetSceneId) {
      const coordText = `-> (${tp.targetX ?? 500}, ${tp.targetY ?? 500})`;
      drawMapBadge(ctx, tp.x, tp.y + r + 12, coordText, 'rgba(12, 10, 9, 0.85)', '#475569', '#cbd5e1');
    }
  });

  ctx.restore();
}

/**
 * Recherche un téléporteur à proximité d'un point
 */
function findTeleporterAtPoint(x, y, maxDist = 35) {
  const teleporters = tacticalMapState.teleporters || [];
  for (const tp of teleporters) {
    const dist = Math.hypot(x - tp.x, y - tp.y);
    const radius = tp.r || 30;
    if (dist <= Math.max(radius, maxDist)) {
      return tp;
    }
  }
  return null;
}

/**
 * Rendu des Objets et Éléments interactifs "Bac à Sable" (Props)
 */
function drawProps(ctx, props, isGM) {
  if (!Array.isArray(props) || props.length === 0) return;

  const now = Date.now();

  props.forEach((prop) => {
    if (!prop || typeof prop.x !== 'number' || typeof prop.y !== 'number') return;

    const x = prop.x;
    const y = prop.y;
    const size = prop.size || 44;
    const radius = size / 2;
    const isHovered = hoveredProp && hoveredProp.id === prop.id;
    const isDragged = draggedProp && draggedProp.id === prop.id;

    ctx.save();

    // 1. Cercle de portée d'interaction si survolé ou si MJ
    if (isHovered || isGM) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, prop.interactionRadius || 120, 0, Math.PI * 2);
      ctx.strokeStyle = isHovered ? 'rgba(245, 158, 11, 0.45)' : 'rgba(217, 119, 6, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Halo lumineux d'interactivité si survolé
    if (isHovered || isDragged) {
      const pulse = 1 + 0.1 * Math.sin(now / 150);
      ctx.beginPath();
      ctx.arc(x, y, radius * pulse + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 12;
      ctx.fill();
    }

    // 3. Ombre portée sous l'objet
    ctx.beginPath();
    ctx.arc(x + 2, y + 3, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fill();

    // 4. Fond du socle / pion
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1917';
    ctx.fill();

    // 5. Image de l'objet si présente
    let imageDrawn = false;
    if (prop.imageUrl) {
      let cachedImg = propImageCache.get(prop.imageUrl);
      if (!cachedImg) {
        cachedImg = new Image();
        cachedImg.src = prop.imageUrl;
        cachedImg.onload = () => {
          if (typeof requestMapRender === 'function') requestMapRender();
        };
        propImageCache.set(prop.imageUrl, cachedImg);
      }
      if (cachedImg.complete && cachedImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(cachedImg, x - radius + 2, y - radius + 2, size - 4, size - 4);
        ctx.restore();
        imageDrawn = true;
      }
    }

    // 6. Si pas d'image, affichage du symbole iconique
    if (!imageDrawn) {
      ctx.beginPath();
      ctx.arc(x, y, radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#292524';
      ctx.fill();

      ctx.fillStyle = isHovered ? '#fef08a' : '#f59e0b';
      ctx.font = `bold ${Math.round(size * 0.42)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prop.icon || '[■]', x, y);
    }

    // 7. Cerclage en bronze / or antique
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = isHovered ? '#fbbf24' : '#b45309';
    ctx.lineWidth = isHovered ? 2.5 : 2;
    ctx.stroke();

    // 8. Indicateur visuel si un document / secret est révélé
    if (prop.isDocRevealed || (isGM && prop.revealedDoc)) {
      const docAngle = -Math.PI / 4;
      const badgeX = x + Math.cos(docAngle) * radius;
      const badgeY = y + Math.sin(docAngle) * radius;
      ctx.beginPath();
      ctx.arc(badgeX, badgeY, 7, 0, Math.PI * 2);
      ctx.fillStyle = prop.isDocRevealed ? '#eab308' : '#78716c';
      ctx.strokeStyle = '#0c0a09';
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0c0a09';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(prop.isDocRevealed ? '!' : '?', badgeX, badgeY);
    }

    // 9. Pastille d'état au survol ou si l'objet a un nom/statut
    if (isHovered || isGM) {
      const statusText = prop.stateLabel ? ` • ${prop.stateLabel}` : '';
      const label = `${prop.name || 'Objet'}${statusText}`;
      drawMapBadge(ctx, x, y - radius - 10, label, 'rgba(12, 10, 9, 0.94)', isHovered ? '#f59e0b' : '#78350f', '#fef3c7');
    }

    ctx.restore();
  });
}

/**
 * Recherche l'objet interactif présent à des coordonnées précises
 */
function findPropAtPoint(worldX, worldY, padding = 8) {
  const props = tacticalMapState.props || [];
  for (let i = props.length - 1; i >= 0; i--) {
    const p = props[i];
    const radius = (p.size || 44) / 2 + padding;
    if (Math.hypot(worldX - p.x, worldY - p.y) <= radius) {
      return p;
    }
  }
  return null;
}

/**
 * Vérifie si le client connecté a le droit de déplacer ce pion
 */
function canUserMoveToken(token) {
  if (!token) return false;

  // Feature 5 : Entravé ou Endormi -> Incapable de se déplacer
  if (hasTokenCondition(token, 'restrained') || hasTokenCondition(token, 'asleep')) {
    return false;
  }

  // Le MJ a un contrôle absolu sur tous les pions
  if (CURRENT_ROLE === 'mj') return true;

  // Un joueur ne peut déplacer que son propre pion et UNIQUEMENT pendant son tour actif
  if (token.type === 'player') {
    const isOwner = (typeof myAssignedSlot === 'number' && token.slot === myAssignedSlot) ||
      (CURRENT_USER_NAME && token.name && token.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()) ||
      Boolean([...charactersCache.values()].find(
        (c) => c && c.slot === token.slot && (c.socketId === socket.id || (c.name && CURRENT_USER_NAME && c.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()))
      ));

    if (!isOwner) return false;

    // Vérification stricte du tour de jeu
    if (!tacticalMapState.currentTurn) return false;
    const isMyTurn = (typeof myAssignedSlot === 'number' && tacticalMapState.currentTurn.slot === myAssignedSlot) ||
      (CURRENT_USER_NAME && tacticalMapState.currentTurn.name && tacticalMapState.currentTurn.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()) ||
      (token.slot === tacticalMapState.currentTurn.slot);

    return Boolean(isMyTurn);
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

  if (iconEl) iconEl.textContent = token.icon || '[H]';
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

  // Feature 5 : Affichage des altérations d'état dans l'infobulle tactique
  const condContainer = document.getElementById('tooltip-token-conditions-container');
  const condList = document.getElementById('tooltip-token-conditions-list');
  if (condContainer && condList) {
    const activeConds = getTokenConditions(token);
    if (activeConds.length > 0) {
      condContainer.classList.remove('hidden');
      condList.innerHTML = activeConds.map((c) => {
        const durText = typeof c.duration === 'number' ? ` (${c.duration}t)` : '';
        return `<span class="px-1.5 py-0.5 text-[9px] font-mono border rounded-none font-bold" style="color: ${c.color || '#f59e0b'}; border-color: ${c.color || '#f59e0b'}66; background: ${c.color || '#f59e0b'}18">${c.icon || '[?]'} ${c.name}${durText}</span>`;
      }).join('');
    } else {
      condContainer.classList.add('hidden');
      condList.innerHTML = '';
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
      'chasm': 'Tracer Gouffre',
      'door': 'Poser Porte',
      'light': 'Poser Brasero',
      'wall-delete': 'Démolir Mur',
      'fog-rect': 'Révéler Rect',
      'fog-circle': 'Révéler Cercle',
      // Terrains et Dangers (Feature 3)
      'zone-swamp': 'Zone Marais (Vitesse / 2)',
      'zone-water': 'Zone Eau Profonde (Vitesse / 2)',
      'zone-rubble': 'Zone Gravats (Vitesse / 2)',
      'zone-web': 'Zone Toiles d\'Araignée (Vitesse / 2)',
      'zone-fire': 'Danger : Flammes (4 dégâts + Brûlé)',
      'zone-poison': 'Danger : Poison (3 dégâts + Empoisonné)',
      'zone-acid': 'Danger : Acide (5 dégâts corrosifs)',
      'zone-delete': 'Dissiper Zone',
      // Pièges et Secrets (Feature 4)
      'trap-pit': 'Poser Fosse (DD 12 | 5 dégâts + À terre)',
      'trap-snare': 'Poser Mâchoires (DD 13 | 6 dégâts + Entravé)',
      'trap-poison-dart': 'Poser Fléchettes (DD 14 | 4 dégâts + Empoisonné)',
      'trap-secret-passage': 'Poser Passage Secret (DD 13)',
      'trap-delete': 'Démanteler Piège',
      // Scènes et Téléporteurs (Feature 6)
      'teleport': 'Poser Téléporteur',
      'teleport-delete': 'Démanteler Téléporteur',
      // Objets et PNJ Bac à Sable (Feature 3)
      'prop': 'Poser Objet / PNJ',
      'prop-delete': 'Supprimer Objet',
      // Craie et Pings (Feature 2)
      'chalk': 'Craie Tactique',
      'ping': 'Signal d\'Attention (Ping)',
      'chalk-eraser': 'Gomme à Craie'
    };
    activeToolName.textContent = toolNames[toolName] || toolName;
  }

  // Affichage dynamique de la palette flottante de craie
  const chalkBar = document.getElementById('chalk-settings-bar');
  if (chalkBar) {
    if (toolName === 'chalk') {
      chalkBar.classList.remove('hidden');
    } else {
      chalkBar.classList.add('hidden');
    }
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
    } else if (toolName === 'chasm') {
      measureNotice.textContent = '✦ Outil Gouffre (MJ) : Cliquez-glissez pour creuser une faille infranchissable mais transparente à la vue ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'door') {
      measureNotice.textContent = '✦ Outil Porte (MJ) : Cliquez-glissez pour poser un passage interactif (ouvrable et verrouillable) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'light') {
      measureNotice.textContent = '✦ Outil Brasero (MJ) : Cliquez n\'importe où sur la carte pour déposer un foyer lumineux (12 m) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'wall-delete') {
      measureNotice.textContent = '✦ Démolition de Mur (MJ) : Cliquez sur un segment de mur ou une porte pour le détruire ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-swamp') {
      measureNotice.textContent = '✦ Outil Marais (MJ) : Cliquez-glissez pour tracer une zone de boue ralentissant de 50% ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-water') {
      measureNotice.textContent = '✦ Outil Eau Profonde (MJ) : Cliquez-glissez pour tracer un bassin ou rivière ralentissant de 50% ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-rubble') {
      measureNotice.textContent = '✦ Outil Gravats (MJ) : Cliquez-glissez pour tracer des décombres ralentissant de 50% ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-web') {
      measureNotice.textContent = '✦ Outil Toiles d\'Araignée (MJ) : Cliquez-glissez pour tracer des toiles collantes ralentissant de 50% ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-fire') {
      measureNotice.textContent = '✦ Danger Nappe de Flammes (MJ) : Cliquez-glissez pour tracer une zone de feu (4 dégâts + Brûlé) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-poison') {
      measureNotice.textContent = '✦ Danger Nappe de Poison (MJ) : Cliquez-glissez pour tracer une zone toxique (3 dégâts + Empoisonné) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-acid') {
      measureNotice.textContent = '✦ Danger Flaque d\'Acide (MJ) : Cliquez-glissez pour tracer une zone d\'acide corrosif (5 dégâts) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'zone-delete') {
      measureNotice.textContent = '✦ Dissipation de Zone (MJ) : Cliquez sur une zone d\'effet pour la dissiper ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'trap-pit') {
      measureNotice.textContent = '✦ Poser Fosse Dissimulée (MJ) : Cliquez pour placer une fosse secrète (DD 12 | 5 dégâts + À terre) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'trap-snare') {
      measureNotice.textContent = '✦ Poser Piège à Mâchoires (MJ) : Cliquez pour placer des mâchoires d\'acier (DD 13 | 6 dégâts + Entravé) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'trap-poison-dart') {
      measureNotice.textContent = '✦ Poser Fléchettes Empoisonnées (MJ) : Cliquez pour placer un mécanisme (DD 14 | 4 dégâts + Empoisonné) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'trap-secret-passage') {
      measureNotice.textContent = '✦ Poser Passage Secret (MJ) : Cliquez pour placer un passage dérobé secret (DD 13) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'trap-delete') {
      measureNotice.textContent = '✦ Démanteler un Piège (MJ) : Cliquez sur un mécanisme pour le supprimer ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'teleport') {
      measureNotice.textContent = '✦ Poser un Téléporteur (MJ) : Cliquez sur la carte pour définir l\'emplacement du point de transition ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'teleport-delete') {
      measureNotice.textContent = '✦ Démanteler Téléporteur (MJ) : Cliquez sur un escalier ou portail pour le retirer ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'prop') {
      measureNotice.textContent = '✦ Poser Objet / PNJ (MJ) : Cliquez sur la carte pour déposer un nouvel élément interactif ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'prop-delete') {
      measureNotice.textContent = '✦ Supprimer Objet (MJ) : Cliquez sur un objet ou PNJ interactif pour le retirer ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'chalk') {
      measureNotice.textContent = '✦ Craie Tactique : Dessinez librement à main levée sur la carte (Éphémère 5s ou Permanent) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'ping') {
      measureNotice.textContent = '✦ Signal d\'Attention (Ping) : Cliquez sur la carte pour émettre un halo lumineux animé (ou Alt + Clic à tout moment) ✦';
      measureNotice.classList.remove('hidden');
    } else if (toolName === 'chalk-eraser') {
      measureNotice.textContent = '✦ Gomme à Craie : Cliquez sur un trait permanent pour le gommer ✦';
      measureNotice.classList.remove('hidden');
    } else {
      measureNotice.classList.add('hidden');
    }
  }

  if (!mapCanvas) return;
  if (toolName === 'pan') {
    mapCanvas.style.cursor = 'grab';
  } else if (
    toolName.startsWith('fog-') ||
    toolName === 'measure' ||
    toolName.startsWith('aoe-') ||
    toolName === 'wall' ||
    toolName === 'chasm' ||
    toolName === 'door' ||
    toolName === 'light' ||
    toolName === 'teleport' ||
    toolName === 'prop' ||
    toolName === 'chalk' ||
    toolName === 'ping' ||
    (toolName.startsWith('zone-') && toolName !== 'zone-delete') ||
    (toolName.startsWith('trap-') && toolName !== 'trap-delete')
  ) {
    mapCanvas.style.cursor = 'crosshair';
  } else if (toolName === 'wall-delete' || toolName === 'zone-delete' || toolName === 'trap-delete' || toolName === 'teleport-delete' || toolName === 'prop-delete' || toolName === 'chalk-eraser') {
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
 * Met à jour les libellés de paramètres HUD (brouillard, éclairage jour/nuit, torche)
 */
function updateMapSettingsUI() {
  const hudFog = document.getElementById('hud-fog-status');
  if (hudFog) {
    hudFog.textContent = tacticalMapState.fogEnabled
      ? (CURRENT_ROLE === 'mj' ? 'Brouillard Actif (MJ)' : 'Brouillard Actif')
      : 'Brouillard Inactif';
  }

  // Statut de l'ambiance lumineuse (Mini HUD)
  const hudLighting = document.getElementById('hud-lighting-status');
  if (hudLighting) {
    const isNight = tacticalMapState.lightingMode === 'night';
    hudLighting.textContent = isNight ? 'Nuit Obscure' : 'Plein Jour';
    hudLighting.className = isNight ? 'text-indigo-400 font-bold' : 'text-sky-300';
  }

  // Libellé et icône du bouton Mode Jour / Nuit dans le menu Ambiance
  const labelDayNight = document.getElementById('label-day-night-btn');
  const iconDayNight = document.getElementById('icon-day-night-btn');
  if (labelDayNight && iconDayNight) {
    const isNight = tacticalMapState.lightingMode === 'night';
    labelDayNight.textContent = isNight ? 'Mode : Nuit Obscure' : 'Mode : Plein Jour';
    iconDayNight.textContent = isNight ? '[☽]' : '[☀]';
  }

  // Libellé et style du bouton Torche personnelle
  const myToken = getMyPlayerToken();
  const torchText = document.getElementById('torch-status-text');
  const torchBtn = document.getElementById('btn-toggle-my-torch');
  if (torchText && torchBtn) {
    const hasTorch = Boolean(myToken && myToken.hasTorch);
    torchText.textContent = hasTorch ? 'Torche : Allumée (12m)' : 'Torche : Éteinte';
    if (hasTorch) {
      torchBtn.classList.add('bg-amber-950', 'text-amber-200', 'border-amber-400');
    } else {
      torchBtn.classList.remove('bg-amber-950', 'text-amber-200', 'border-amber-400');
    }
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
            rebuildFogCanvas();
            requestMapRender();
          }
        });
      }
    });
  }

  // Basculer Mode Jour / Mode Nuit (MJ)
  const btnToggleDayNight = document.getElementById('btn-toggle-day-night');
  if (btnToggleDayNight) {
    btnToggleDayNight.addEventListener('click', () => {
      if (CURRENT_ROLE !== 'mj' || !CURRENT_ROOM) return;
      const nextMode = tacticalMapState.lightingMode === 'night' ? 'day' : 'night';
      socket.emit('map:set_lighting_mode', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, mode: nextMode }, (res) => {
        if (res?.success) {
          tacticalMapState.lightingMode = res.lightingMode;
          updateMapSettingsUI();
          rebuildFogCanvas();
          requestMapRender();
        }
      });
    });
  }

  // Effacer les lumières fixes (MJ)
  const btnClearLights = document.getElementById('btn-clear-lights');
  if (btnClearLights) {
    btnClearLights.addEventListener('click', () => {
      if (CURRENT_ROLE !== 'mj' || !CURRENT_ROOM) return;
      if (confirm('Voulez-vous supprimer tous les braseros et sources lumineuses fixes de la carte ?')) {
        socket.emit('map:clear_lights', { roomId: CURRENT_ROOM, role: CURRENT_ROLE }, (res) => {
          if (res?.success) {
            tacticalMapState.lights = [];
            rebuildFogCanvas();
            requestMapRender();
          }
        });
      }
    });
  }

  // Allumer / éteindre sa torche personnelle (Joueur ou MJ)
  const btnToggleTorch = document.getElementById('btn-toggle-my-torch');
  if (btnToggleTorch) {
    btnToggleTorch.addEventListener('click', () => {
      let targetToken = getMyPlayerToken();
      if (CURRENT_ROLE === 'mj' && hoveredToken) {
        targetToken = hoveredToken;
      }
      if (!targetToken) {
        if (CURRENT_ROLE === 'mj') {
          alert('Survolez un pion sur la carte avec votre curseur pour allumer ou éteindre sa torche.');
        } else {
          alert('Aucun pion de héros actif n\'a été trouvé sur la carte pour porter cette torche.');
        }
        return;
      }
      socket.emit('map:toggle_torch', { roomId: CURRENT_ROOM, tokenId: targetToken.id, role: CURRENT_ROLE }, (res) => {
        if (res?.success) {
          targetToken.hasTorch = res.hasTorch;
          updateMapSettingsUI();
          rebuildFogCanvas();
          requestMapRender();
        }
      });
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
              rebuildFogCanvas();
              requestMapRender();
            }
          });
        }
        return;
      }

      // Clic droit par le MJ sur un brasero / source lumineuse fixe : suppression rapide
      const clickedLight = findLightAtPoint(worldX, worldY, 22);
      if (clickedLight) {
        if (confirm('Voulez-vous retirer ce brasero / foyer lumineux ?')) {
          socket.emit('map:remove_light', { roomId: CURRENT_ROOM, lightId: clickedLight.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.lights = (tacticalMapState.lights || []).filter((l) => l.id !== clickedLight.id);
              rebuildFogCanvas();
              requestMapRender();
            }
          });
        }
        return;
      }

      // Clic droit par le MJ sur un mur ou une porte
      const clickedWall = findWallAtPoint(worldX, worldY);
      if (clickedWall) {
        if (clickedWall.wallType === 'door') {
          // Verrouiller / Déverrouiller la porte à clé
          socket.emit('map:lock_door', { roomId: CURRENT_ROOM, doorId: clickedWall.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success && res.door) {
              const idx = (tacticalMapState.walls || []).findIndex((w) => w.id === res.door.id);
              if (idx !== -1) tacticalMapState.walls[idx] = res.door;
              rebuildFogCanvas();
              requestMapRender();
            }
          });
          return;
        }

        if (confirm('Voulez-vous abattre ce segment de mur ?')) {
          socket.emit('map:remove_wall', { roomId: CURRENT_ROOM, wallId: clickedWall.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.walls = (tacticalMapState.walls || []).filter((w) => w.id !== clickedWall.id);
              hoveredWall = null;
              rebuildFogCanvas();
              requestMapRender();
            }
          });
        }
        return;
      }

      // Clic droit par le MJ sur un objet interactif : ouvrir l'édition rapide
      const clickedPropRight = findPropAtPoint(worldX, worldY, 12);
      if (clickedPropRight) {
        openPropEditModal(clickedPropRight);
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
      // Raccourci universel Alt + Clic gauche : Signal d'attention lumineux (Ping)
      if (e.altKey) {
        sendMapPing(worldX, worldY);
        return;
      }

      // Outil Signal d'Attention (Ping)
      if (mapActiveTool === 'ping') {
        sendMapPing(worldX, worldY);
        return;
      }

      // Outil Craie Tactique (Dessin libre)
      if (mapActiveTool === 'chalk') {
        chalkState.isDrawing = true;
        chalkState.currentPoints = [{ x: Math.round(worldX), y: Math.round(worldY) }];
        requestMapRender();
        return;
      }

      // Outil Gomme à Craie
      if (mapActiveTool === 'chalk-eraser') {
        const targetDrawing = findDrawingAtPoint(worldX, worldY, 15);
        if (targetDrawing && CURRENT_ROOM) {
          socket.emit('draw:erase', { roomId: CURRENT_ROOM, drawingId: targetDrawing.id });
          tacticalMapState.drawings = (tacticalMapState.drawings || []).filter((d) => d.id !== targetDrawing.id);
          hoveredDrawing = null;
          requestMapRender();
        }
        return;
      }

      // Outil de pose de Brasero / Source lumineuse fixe (MJ uniquement)
      if (mapActiveTool === 'light' && CURRENT_ROLE === 'mj') {
        const lightData = {
          x: Math.round(worldX),
          y: Math.round(worldY),
          radius: 400,
          label: 'Brasero 12m'
        };
        socket.emit('map:add_light', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, light: lightData }, (res) => {
          if (res?.success && res.light) {
            if (!Array.isArray(tacticalMapState.lights)) tacticalMapState.lights = [];
            tacticalMapState.lights.push(res.light);
            rebuildFogCanvas();
            requestMapRender();
          }
        });
        return;
      }

      // Outils de tracé de murs, gouffres et portes (MJ uniquement)
      if ((mapActiveTool === 'wall' || mapActiveTool === 'chasm' || mapActiveTool === 'door') && CURRENT_ROLE === 'mj') {
        const snap = findSnapEndpoint(worldX, worldY);
        wallDrawState.isDrawing = true;
        wallDrawState.toolType = mapActiveTool;
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
              rebuildFogCanvas();
              requestMapRender();
            }
          });
        }
        return;
      }

      // Outils de tracé de surfaces et zones de danger (MJ uniquement)
      if (mapActiveTool.startsWith('zone-') && mapActiveTool !== 'zone-delete' && CURRENT_ROLE === 'mj') {
        const subType = mapActiveTool.replace('zone-', '');
        zoneDrawState.isDrawing = true;
        zoneDrawState.subType = subType;
        zoneDrawState.shape = 'rect';
        zoneDrawState.startX = Math.round(worldX);
        zoneDrawState.startY = Math.round(worldY);
        zoneDrawState.currentX = Math.round(worldX);
        zoneDrawState.currentY = Math.round(worldY);
        requestMapRender();
        return;
      }

      // Outil de dissipation de zone (MJ uniquement)
      if (mapActiveTool === 'zone-delete' && CURRENT_ROLE === 'mj') {
        const targetZone = findZoneAtPoint(worldX, worldY);
        if (targetZone && CURRENT_ROOM) {
          socket.emit('map:remove_zone', { roomId: CURRENT_ROOM, zoneId: targetZone.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.zones = (tacticalMapState.zones || []).filter((z) => z.id !== targetZone.id);
              hoveredZone = null;
              requestMapRender();
            }
          });
        }
        return;
      }

      // Outils de pose de pièges et mécanismes dissimulés (MJ uniquement)
      if (mapActiveTool.startsWith('trap-') && mapActiveTool !== 'trap-delete' && CURRENT_ROLE === 'mj') {
        const rawType = mapActiveTool.replace('trap-', '');
        const trapType = rawType.replace(/-/g, '_');
        const trapConfigs = {
          'pit': { label: 'Fosse Dissimulée', dc: 12, damage: 5, condition: 'prone', r: 25 },
          'snare': { label: 'Piège à Mâchoires', dc: 13, damage: 6, condition: 'restrained', r: 25 },
          'poison_dart': { label: 'Fléchettes Empoisonnées', dc: 14, damage: 4, condition: 'poisoned', r: 25 },
          'secret_passage': { label: 'Passage Secret', dc: 13, damage: 0, condition: null, r: 30 }
        };
        const cfg = trapConfigs[trapType] || { label: 'Mécanisme Dissimulé', dc: 12, damage: 5, condition: null, r: 25 };
        const trapData = {
          x: Math.round(worldX),
          y: Math.round(worldY),
          r: cfg.r,
          subType: trapType,
          label: cfg.label,
          dc: cfg.dc,
          damage: cfg.damage,
          condition: cfg.condition,
          revealed: false,
          triggered: false,
          disarmed: false
        };
        socket.emit('map:add_trap', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, trap: trapData }, (res) => {
          if (res?.success && res.trap) {
            if (!Array.isArray(tacticalMapState.traps)) tacticalMapState.traps = [];
            if (!tacticalMapState.traps.some((t) => t.id === res.trap.id)) {
              tacticalMapState.traps.push(res.trap);
            }
            requestMapRender();
            if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
          }
        });
        return;
      }

      // Outil de démantèlement de piège (MJ uniquement)
      if (mapActiveTool === 'trap-delete' && CURRENT_ROLE === 'mj') {
        const targetTrap = findTrapAtPoint(worldX, worldY, 30);
        if (targetTrap && CURRENT_ROOM) {
          socket.emit('map:remove_trap', { roomId: CURRENT_ROOM, trapId: targetTrap.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success) {
              tacticalMapState.traps = (tacticalMapState.traps || []).filter((t) => t.id !== targetTrap.id);
              hoveredTrap = null;
              requestMapRender();
              if (typeof refreshTrapsModalUI === 'function') refreshTrapsModalUI();
            }
          });
        }
        return;
      }

      // Outil de pose de téléporteur / transition de scène (MJ uniquement)
      if (mapActiveTool === 'teleport' && CURRENT_ROLE === 'mj') {
        openTeleportConfigModal(Math.round(worldX), Math.round(worldY));
        return;
      }

      // Outil de démantèlement de téléporteur (MJ uniquement)
      if (mapActiveTool === 'teleport-delete' && CURRENT_ROLE === 'mj') {
        const targetTp = findTeleporterAtPoint(worldX, worldY, 35);
        if (targetTp && CURRENT_ROOM) {
          socket.emit('scene:remove_teleporter', { roomId: CURRENT_ROOM, teleporterId: targetTp.id, role: CURRENT_ROLE });
        }
        return;
      }

      // Outil de pose d'Objet / PNJ Bac à Sable (MJ uniquement)
      if (mapActiveTool === 'prop' && CURRENT_ROLE === 'mj') {
        openPropEditModal(null, { x: Math.round(worldX), y: Math.round(worldY) });
        return;
      }

      // Outil de suppression d'Objet / PNJ (MJ uniquement)
      if (mapActiveTool === 'prop-delete' && CURRENT_ROLE === 'mj') {
        const targetProp = findPropAtPoint(worldX, worldY, 15);
        if (targetProp && CURRENT_ROOM) {
          if (confirm(`Voulez-vous supprimer l'objet "${targetProp.name || 'Sans titre'}" de la carte ?`)) {
            socket.emit('prop:remove', { roomId: CURRENT_ROOM, propId: targetProp.id, role: CURRENT_ROLE });
            tacticalMapState.props = (tacticalMapState.props || []).filter((p) => p.id !== targetProp.id);
            hoveredProp = null;
            requestMapRender();
          }
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

      // Outil Sélection / Déplacement de pions et Interaction avec les Portes
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
          if (!isTokenVisibleToCurrentClient(clickedToken)) {
            return;
          }
          if (canUserMoveToken(clickedToken)) {
            draggedToken = clickedToken;
            dragTokenInitialPos = { x: clickedToken.x, y: clickedToken.y };
            dragOffset = { x: worldX - clickedToken.x, y: worldY - clickedToken.y };
            dragWaypoints = [];
            mapCanvas.style.cursor = 'grabbing';
            hideMapTooltip();
          } else {
            if (hasTokenCondition(clickedToken, 'restrained')) {
              alert('Action impossible : Ce pion est entravé et ne peut pas se déplacer !');
            } else if (hasTokenCondition(clickedToken, 'asleep')) {
              alert('Action impossible : Ce pion est plongé dans un profond sommeil magique !');
            } else {
              const isOwner = clickedToken.type === 'player' && (
                (typeof myAssignedSlot === 'number' && clickedToken.slot === myAssignedSlot) ||
                (CURRENT_USER_NAME && clickedToken.name && clickedToken.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()) ||
                Boolean([...charactersCache.values()].find(
                  (c) => c && c.slot === clickedToken.slot && (c.socketId === socket.id || (c.name && CURRENT_USER_NAME && c.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase()))
                ))
              );
              if (isOwner) {
                const activeTurnName = tacticalMapState.currentTurn?.name || 'En attente';
                alert(`Action impossible : Ce n'est pas votre tour d'agir ! (Tour actif : ${activeTurnName})`);
              } else {
                alert('Action refusée : vous ne pouvez déplacer que votre propre pion.');
              }
            }
          }
          return;
        }

        // Clic sur une porte interactive pour basculer Ouvert / Fermé
        const clickedDoor = findWallAtPoint(worldX, worldY, 18);
        if (clickedDoor && clickedDoor.wallType === 'door') {
          if (CURRENT_ROLE !== 'mj') {
            const myToken = getMyPlayerToken();
            if (myToken) {
              const distToDoor = distToSegment(myToken.x, myToken.y, clickedDoor.x1, clickedDoor.y1, clickedDoor.x2, clickedDoor.y2);
              if (distToDoor > 120) {
                alert('Action impossible : Vous devez être à moins de 2 mètres (120 px) de la porte pour pouvoir l\'actionner.');
                return;
              }
            }
          }

          socket.emit('map:toggle_door', { roomId: CURRENT_ROOM, doorId: clickedDoor.id, role: CURRENT_ROLE }, (res) => {
            if (res?.success && res.door) {
              const idx = (tacticalMapState.walls || []).findIndex((w) => w.id === res.door.id);
              if (idx !== -1) tacticalMapState.walls[idx] = res.door;
              rebuildFogCanvas();
              requestMapRender();
            } else if (res?.locked) {
              alert('La porte est fermée à double tour et verrouillée à clé !');
            }
          });
          return;
        }

        // Clic sur un objet ou PNJ interactif (Bac à sable)
        const clickedProp = findPropAtPoint(worldX, worldY, 12);
        if (clickedProp) {
          if (CURRENT_ROLE === 'mj') {
            draggedProp = clickedProp;
            dragPropInitialPos = { x: clickedProp.x, y: clickedProp.y };
            dragPropOffset = { x: worldX - clickedProp.x, y: worldY - clickedProp.y };
            mapCanvas.style.cursor = 'grabbing';
            hideMapTooltip();
          } else {
            const myToken = getMyPlayerToken();
            const maxDist = clickedProp.interactionRadius || 120;
            if (myToken) {
              const dist = Math.hypot(myToken.x - clickedProp.x, myToken.y - clickedProp.y);
              if (dist > maxDist) {
                const distM = ((dist / 50) * 1.5).toFixed(1);
                const maxM = ((maxDist / 50) * 1.5).toFixed(1);
                alert(`Trop loin pour interagir ! Vous êtes à ${distM} m de "${clickedProp.name || 'cet objet'}". Approchez-vous à moins de ${maxM} m.`);
                return;
              }
            }
            openPropDetailModal(clickedProp);
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

    // 1b. Tracé de Craie Tactique libre en cours
    if (chalkState.isDrawing) {
      const pts = chalkState.currentPoints;
      const lastPt = pts[pts.length - 1];
      if (!lastPt || Math.hypot(worldX - lastPt.x, worldY - lastPt.y) >= 4) {
        pts.push({ x: Math.round(worldX), y: Math.round(worldY) });
        requestMapRender();
      }
      return;
    }

    // 1c. Déplacement d'un objet interactif en cours (MJ)
    if (draggedProp && CURRENT_ROLE === 'mj') {
      draggedProp.x = Math.round(worldX - dragPropOffset.x);
      draggedProp.y = Math.round(worldY - dragPropOffset.y);

      const now = Date.now();
      if (now - lastMoveEmitTime > 35 && CURRENT_ROOM) {
        lastMoveEmitTime = now;
        socket.emit('prop:move', {
          roomId: CURRENT_ROOM,
          propId: draggedProp.id,
          x: draggedProp.x,
          y: draggedProp.y,
          role: CURRENT_ROLE
        });
      }
      requestMapRender();
      return;
    }

    // 2. Déplacement d'un pion actif avec détection physique de collision contre les murs
    if (draggedToken) {
      let targetX = worldX - dragOffset.x;
      let targetY = worldY - dragOffset.y;
      const tokenRadius = (draggedToken.size || 40) / 2;
      const currentPath = [dragTokenInitialPos, { x: targetX, y: targetY }];
      const speed = getTokenSpeed(draggedToken, currentPath);

      // Restriction du déplacement au cercle de Course (Dash) pour les joueurs
      if (CURRENT_ROLE !== 'mj') {
        const dX = targetX - dragTokenInitialPos.x;
        const dY = targetY - dragTokenInitialPos.y;
        const distFromStart = Math.hypot(dX, dY);
        if (distFromStart > speed.dashPx) {
          targetX = dragTokenInitialPos.x + (dX / distFromStart) * speed.dashPx;
          targetY = dragTokenInitialPos.y + (dY / distFromStart) * speed.dashPx;
        }
      }

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
            const isChasm = collision.wall?.wallType === 'chasm' || collision.wall?.blocksLight === false;
            const isDoor = collision.wall?.wallType === 'door';
            wallCollisionActive = { x: targetX, y: targetY, time: Date.now(), isChasm, isDoor };
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

    // 4b. Tracé de mur, gouffre ou porte actif (MJ)
    if (wallDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      const snap = findSnapEndpoint(worldX, worldY);
      wallDrawState.currentX = snap.x;
      wallDrawState.currentY = snap.y;
      requestMapRender();
      return;
    }

    // 4c. Tracé de surface ou zone de danger actif (MJ)
    if (zoneDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      zoneDrawState.currentX = worldX;
      zoneDrawState.currentY = worldY;
      requestMapRender();
      return;
    }

    // 5. Détection du survol d'éléments interactifs
    // A0. Survol en mode Gomme à Craie
    if (mapActiveTool === 'chalk-eraser') {
      const prevHoverDrawing = hoveredDrawing;
      hoveredDrawing = findDrawingAtPoint(worldX, worldY, 15);
      if (hoveredDrawing !== prevHoverDrawing) requestMapRender();
      mapCanvas.style.cursor = hoveredDrawing ? 'pointer' : 'crosshair';
      return;
    }

    // A. Survol en mode Détection / Démolition de Mur (MJ)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'wall-delete') {
      const prevHover = hoveredWall;
      hoveredWall = findWallAtPoint(worldX, worldY);
      if (hoveredWall !== prevHover) requestMapRender();
      mapCanvas.style.cursor = hoveredWall ? 'pointer' : 'crosshair';
      return;
    }

    // A2. Survol en mode Dissipation de Zone (MJ)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'zone-delete') {
      const prevHoverZone = hoveredZone;
      hoveredZone = findZoneAtPoint(worldX, worldY);
      if (hoveredZone !== prevHoverZone) requestMapRender();
      mapCanvas.style.cursor = hoveredZone ? 'pointer' : 'crosshair';
      return;
    }

    // A3. Survol en mode Démantèlement de Piège (MJ)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'trap-delete') {
      const prevHoverTrap = hoveredTrap;
      hoveredTrap = findTrapAtPoint(worldX, worldY, 30);
      if (hoveredTrap !== prevHoverTrap) requestMapRender();
      mapCanvas.style.cursor = hoveredTrap ? 'pointer' : 'crosshair';
      return;
    }

    // A4. Survol en mode Démantèlement de Téléporteur (MJ)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'teleport-delete') {
      const prevHoverTp = hoveredTeleport;
      hoveredTeleport = findTeleporterAtPoint(worldX, worldY, 35);
      if (hoveredTeleport !== prevHoverTp) requestMapRender();
      mapCanvas.style.cursor = hoveredTeleport ? 'pointer' : 'crosshair';
      return;
    }

    // A5. Survol en mode Suppression d'Objet (MJ)
    if (CURRENT_ROLE === 'mj' && mapActiveTool === 'prop-delete') {
      const prevHoverProp = hoveredProp;
      hoveredProp = findPropAtPoint(worldX, worldY, 15);
      if (hoveredProp !== prevHoverProp) requestMapRender();
      mapCanvas.style.cursor = hoveredProp ? 'pointer' : 'crosshair';
      return;
    }

    // Détection continue du survol d'un téléporteur
    const prevHoverTp = hoveredTeleport;
    hoveredTeleport = findTeleporterAtPoint(worldX, worldY, 35);
    if (hoveredTeleport !== prevHoverTp) requestMapRender();

    // B. Survol en mode Tracé de Mur, Gouffre ou Porte (MJ avec aimantation)
    if (CURRENT_ROLE === 'mj' && (mapActiveTool === 'wall' || mapActiveTool === 'chasm' || mapActiveTool === 'door')) {
      const snap = findSnapEndpoint(worldX, worldY);
      mapCanvas.style.cursor = snap.snapped ? 'copy' : 'crosshair';
    }

    // B2. Détection du survol de porte ou d'objet en mode Sélection (Joueurs et MJ)
    if (mapActiveTool === 'select') {
      const doorNear = findWallAtPoint(worldX, worldY, 18);
      if (doorNear && doorNear.wallType === 'door') {
        if (hoveredWall !== doorNear) {
          hoveredWall = doorNear;
          requestMapRender();
        }
        mapCanvas.style.cursor = 'pointer';
      } else if (hoveredWall && hoveredWall.wallType === 'door') {
        hoveredWall = null;
        requestMapRender();
      }

      // Détection continue du survol d'un objet interactif
      const propNear = findPropAtPoint(worldX, worldY, 12);
      if (propNear !== hoveredProp) {
        hoveredProp = propNear;
        requestMapRender();
      }
      if (hoveredProp) {
        mapCanvas.style.cursor = 'pointer';
      }
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
        if (!isTokenVisibleToCurrentClient(foundToken)) {
          foundToken = null;
        }
      }

      if (foundToken) {
        hoveredToken = foundToken;
        if (
          mapActiveTool === 'measure' ||
          mapActiveTool.startsWith('aoe-') ||
          mapActiveTool === 'wall' ||
          mapActiveTool === 'chasm' ||
          mapActiveTool === 'door' ||
          mapActiveTool === 'light' ||
          mapActiveTool === 'teleport' ||
          (mapActiveTool.startsWith('zone-') && mapActiveTool !== 'zone-delete') ||
          (mapActiveTool.startsWith('trap-') && mapActiveTool !== 'trap-delete')
        ) {
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
        } else if (
          mapActiveTool.startsWith('fog-') ||
          mapActiveTool === 'measure' ||
          mapActiveTool.startsWith('aoe-') ||
          mapActiveTool === 'wall' ||
          mapActiveTool === 'chasm' ||
          mapActiveTool === 'door' ||
          mapActiveTool === 'light' ||
          mapActiveTool === 'teleport' ||
          (mapActiveTool.startsWith('zone-') && mapActiveTool !== 'zone-delete') ||
          (mapActiveTool.startsWith('trap-') && mapActiveTool !== 'trap-delete')
        ) {
          mapCanvas.style.cursor = 'crosshair';
        } else if (mapActiveTool === 'wall-delete' || mapActiveTool === 'zone-delete' || mapActiveTool === 'trap-delete' || mapActiveTool === 'teleport-delete') {
          mapCanvas.style.cursor = 'pointer';
        } else {
          mapCanvas.style.cursor = hoveredTeleport ? 'pointer' : 'default';
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

    // Fin du tracé de Craie Tactique
    if (chalkState.isDrawing) {
      chalkState.isDrawing = false;
      const pts = chalkState.currentPoints;
      if (pts.length > 0 && CURRENT_ROOM) {
        const stroke = {
          id: `draw_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          author: CURRENT_USER_NAME || (CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : 'Aventurier'),
          color: chalkState.color,
          width: chalkState.width,
          isEphemeral: chalkState.isEphemeral,
          points: pts,
          createdAt: Date.now()
        };

        if (stroke.isEphemeral) {
          ephemeralDrawings.push({ ...stroke, maxAge: 5000 });
        } else {
          if (!Array.isArray(tacticalMapState.drawings)) tacticalMapState.drawings = [];
          tacticalMapState.drawings.push(stroke);
        }

        socket.emit('draw:stroke', { roomId: CURRENT_ROOM, stroke });
      }
      chalkState.currentPoints = [];
      requestMapRender();
    }

    // Fin du déplacement d'un objet interactif par le MJ
    if (draggedProp) {
      const movedDist = Math.hypot(draggedProp.x - dragPropInitialPos.x, draggedProp.y - dragPropInitialPos.y);
      if (CURRENT_ROOM) {
        socket.emit('prop:move', {
          roomId: CURRENT_ROOM,
          propId: draggedProp.id,
          x: draggedProp.x,
          y: draggedProp.y,
          role: CURRENT_ROLE
        });
      }
      // Si c'était un simple clic (< 5px), ouvrir la fiche d'inspection / interaction
      if (movedDist < 5) {
        openPropDetailModal(draggedProp);
      }
      draggedProp = null;
      mapCanvas.style.cursor = 'default';
      requestMapRender();
    }

    // Fin du tracé de mesure ou de gabarit AoE
    if (measureState.isMeasuring) {
      measureState.isMeasuring = false;
      if (CURRENT_ROOM) {
        socket.emit('map:clear_measure', { roomId: CURRENT_ROOM });
      }
      requestMapRender();
    }

    // Fin du tracé de mur, gouffre ou porte par le MJ
    if (wallDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      wallDrawState.isDrawing = false;
      const len = Math.hypot(wallDrawState.currentX - wallDrawState.startX, wallDrawState.currentY - wallDrawState.startY);
      if (len >= 15 && CURRENT_ROOM) {
        const isChasm = wallDrawState.toolType === 'chasm';
        const isDoor = wallDrawState.toolType === 'door';
        const wallData = {
          x1: Math.round(wallDrawState.startX),
          y1: Math.round(wallDrawState.startY),
          x2: Math.round(wallDrawState.currentX),
          y2: Math.round(wallDrawState.currentY),
          blocksMovement: !isDoor,
          blocksLight: !isChasm && !isDoor,
          wallType: isDoor ? 'door' : (isChasm ? 'chasm' : 'wall'),
          isOpen: false,
          isLocked: false
        };
        socket.emit('map:add_wall', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, wall: wallData }, (res) => {
          if (res?.success && res.wall) {
            if (!Array.isArray(tacticalMapState.walls)) tacticalMapState.walls = [];
            if (!tacticalMapState.walls.some((w) => w.id === res.wall.id)) {
              tacticalMapState.walls.push(res.wall);
            }
            rebuildFogCanvas();
            requestMapRender();
          }
        });
      }
      requestMapRender();
    }

    // Fin du tracé de surface ou zone de danger par le MJ
    if (zoneDrawState.isDrawing && CURRENT_ROLE === 'mj') {
      zoneDrawState.isDrawing = false;
      const minX = Math.min(zoneDrawState.startX, zoneDrawState.currentX);
      const minY = Math.min(zoneDrawState.startY, zoneDrawState.currentY);
      const w = Math.abs(zoneDrawState.currentX - zoneDrawState.startX);
      const h = Math.abs(zoneDrawState.currentY - zoneDrawState.startY);

      if (w >= 15 && h >= 15 && CURRENT_ROOM) {
        const subType = zoneDrawState.subType || 'swamp';
        const isHazard = ['fire', 'poison', 'acid'].includes(subType);
        const type = isHazard ? 'hazard' : 'difficult';
        const zoneLabels = {
          'swamp': 'Marais Boueux',
          'water': 'Eau Profonde',
          'rubble': 'Gravats & Pierres',
          'web': 'Toiles d\'Araignée',
          'fire': 'Nappe de Flammes',
          'poison': 'Nappe de Poison',
          'acid': 'Flaque d\'Acide'
        };
        const damages = { 'fire': 4, 'poison': 3, 'acid': 5 };
        const conditions = { 'fire': 'burning', 'poison': 'poisoned' };

        const zoneData = {
          type,
          subType,
          shape: 'rect',
          x: Math.round(minX),
          y: Math.round(minY),
          w: Math.round(w),
          h: Math.round(h),
          label: zoneLabels[subType] || 'Zone d\'effet',
          damage: damages[subType] || 0,
          condition: conditions[subType] || null,
          slowFactor: 0.5
        };

        socket.emit('map:add_zone', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, zone: zoneData }, (res) => {
          if (res?.success && res.zone) {
            if (!Array.isArray(tacticalMapState.zones)) tacticalMapState.zones = [];
            if (!tacticalMapState.zones.some((z) => z.id === res.zone.id)) {
              tacticalMapState.zones.push(res.zone);
            }
            requestMapRender();
          }
        });
      }
      requestMapRender();
    }

    if (draggedToken) {
      const tokenRadius = (draggedToken.size || 40) / 2;
      const fullPath = [dragTokenInitialPos, { x: draggedToken.x, y: draggedToken.y }];
      const speed = getTokenSpeed(draggedToken, fullPath);

      // Vérifier si la trajectoire franchit un mur ou un gouffre
      const col = checkWallCollision(dragTokenInitialPos.x, dragTokenInitialPos.y, draggedToken.x, draggedToken.y, tokenRadius);
      const hasWallCollision = col.collided;
      const collidedWall = col.wall;

      // Calculer la distance de déplacement direct
      const totalMovedDist = Math.hypot(draggedToken.x - dragTokenInitialPos.x, draggedToken.y - dragTokenInitialPos.y);

      if (hasWallCollision && CURRENT_ROLE !== 'mj') {
        // Bloquer et réinitialiser à la position initiale
        draggedToken.x = dragTokenInitialPos.x;
        draggedToken.y = dragTokenInitialPos.y;
        if (CURRENT_ROOM) {
          socket.emit('map:move_token', {
            roomId: CURRENT_ROOM,
            tokenId: draggedToken.id,
            x: draggedToken.x,
            y: draggedToken.y,
            role: CURRENT_ROLE
          });
        }
        const isChasm = collidedWall?.wallType === 'chasm' || collidedWall?.blocksLight === false;
        const msg = isChasm
          ? 'Trajectoire bloquée : votre chemin traverse un gouffre infranchissable !'
          : 'Trajectoire bloquée : votre chemin traverse un mur de pierre infranchissable !';
        alert(msg);
      } else {
        // Feature 4 : Détection du déclenchement d'un piège sur le trajet
        let trapTriggered = null;
        if (CURRENT_ROLE !== 'mj') {
          trapTriggered = findTriggeredTrapAlongPath(fullPath, tokenRadius);
        }

        if (trapTriggered && CURRENT_ROLE !== 'mj') {
          // Arrêt forcé immédiat du pion sur la case exacte du piège
          draggedToken.x = trapTriggered.x;
          draggedToken.y = trapTriggered.y;
          if (CURRENT_ROOM) {
            socket.emit('map:move_token', {
              roomId: CURRENT_ROOM,
              tokenId: draggedToken.id,
              x: draggedToken.x,
              y: draggedToken.y,
              role: CURRENT_ROLE
            });
            socket.emit('map:trigger_trap', {
              roomId: CURRENT_ROOM,
              trapId: trapTriggered.id,
              tokenId: draggedToken.id
            });
          }
          exploreCurrentPosition();
          checkPassivePerceptionForTraps();

          const isPassage = trapTriggered.subType === 'secret_passage';
          const alertMsg = isPassage
            ? `Découverte ! ${draggedToken.name || 'Un aventurier'} a révélé un passage secret dissimulé !`
            : `ALERTE PIÈGE DÉCLENCHÉ ! ${draggedToken.name || 'Le pion'} s'est pris dans : ${trapTriggered.label || 'un piège'} ! Déplacement interrompu immédiatement.`;
          alert(alertMsg);
        } else {
          // Pas de piège déclenché : position finale validée
          if (CURRENT_ROOM) {
            socket.emit('map:move_token', {
              roomId: CURRENT_ROOM,
              tokenId: draggedToken.id,
              x: draggedToken.x,
              y: draggedToken.y,
              role: CURRENT_ROLE
            });
          }

          if (CURRENT_ROLE !== 'mj') {
            exploreCurrentPosition();
            checkPassivePerceptionForTraps();

            // Feature 3 : Vérifier si le pion s'arrête sur une zone de danger actif
            const hazard = findHazardZoneAtPoint(draggedToken.x, draggedToken.y);
            if (hazard && CURRENT_ROOM) {
              socket.emit('map:hazard_damage', {
                roomId: CURRENT_ROOM,
                zoneId: hazard.id,
                tokenId: draggedToken.id
              });
            }
          }

          // Feature 6 : Vérifier si un pion joueur marche sur un téléporteur / escalier de transition
          const teleporter = findTeleporterAtPoint(draggedToken.x, draggedToken.y, 35);
          if (teleporter && CURRENT_ROOM && draggedToken.type === 'player') {
            socket.emit('scene:trigger_teleporter', {
              roomId: CURRENT_ROOM,
              teleporterId: teleporter.id,
              tokenId: draggedToken.id
            });
          }

          // Feature 2 & 6 : Si le joueur a déplacé son pion au-delà de la zone bleue (vers le cercle jaune Course/Dash),
          // son tour saute automatiquement !
          if (CURRENT_ROLE !== 'mj' && totalMovedDist > speed.standardPx) {
            const distM = (totalMovedDist / 50) * 1.5;
            socket.emit('turn:finish', {
              roomId: CURRENT_ROOM,
              slot: draggedToken.slot,
              reason: 'dash',
              dist: distM
            });
          }
        }
      }

      dragWaypoints = [];
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

  // 7. Modale des Altérations d'État & Conditions
  initConditionsModalUI();

  // 8. Modale de gestion des Pièges & Mécanismes (MJ)
  initTrapsModalUI();

  // 9. Modales de gestion des Scènes et Téléporteurs (MJ)
  initSceneManagerModalUI();
  initTeleportConfigModalUI();

  // 10. Panneau ancré des raccourcis clavier tactiques
  initTacticalShortcutsUI();

  // 11. Carnet d'Enquête & Mur de Détective Collaboratif
  initInvestigationUI();

  // 12. Craie Tactique & Signaux d'Attention (Pings)
  initChalkUI();

  // 13. Fiches de PNJ & Objets Personnalisables "Bac à Sable"
  initPropsUI();

  if (tacticalMapState.currentTurn) {
    updateTurnDisplay(tacticalMapState.currentTurn);
  }

  updateMapSettingsUI();
}

/**
 * Initialise les contrôles et boutons de la Craie Tactique et des Pings
 */
function initChalkUI() {
  const chalkBar = document.getElementById('chalk-settings-bar');
  const modeToggle = document.getElementById('chalk-mode-toggle');
  const btnClose = document.getElementById('btn-close-chalk-bar');
  const btnClearMy = document.getElementById('btn-clear-my-chalk');
  const btnClearAll = document.getElementById('btn-clear-all-chalk');

  // Empêcher les clics sur la palette flottante de déclencher des tracés sur le canvas
  if (chalkBar) {
    chalkBar.addEventListener('pointerdown', (e) => e.stopPropagation());
    chalkBar.addEventListener('mousedown', (e) => e.stopPropagation());
    chalkBar.addEventListener('click', (e) => e.stopPropagation());
  }

  // Bascule Éphémère (5s) vs Permanent
  if (modeToggle) {
    modeToggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      chalkState.isEphemeral = !chalkState.isEphemeral;
      if (chalkState.isEphemeral) {
        modeToggle.textContent = '[Éphémère ~5s]';
        modeToggle.className = 'px-2 py-0.5 text-[10px] font-mono font-bold border border-amber-500/70 bg-amber-950/80 text-amber-300 hover:bg-amber-900/80 transition cursor-pointer';
        modeToggle.title = 'Les tracés s\'effacent automatiquement au bout de 5 secondes';
      } else {
        modeToggle.textContent = '[Permanent]';
        modeToggle.className = 'px-2 py-0.5 text-[10px] font-mono font-bold border border-emerald-500/80 bg-emerald-950/90 text-emerald-300 hover:bg-emerald-900/80 transition cursor-pointer';
        modeToggle.title = 'Les tracés restent sauvegardés sur la carte jusqu\'à leur effacement manuel';
      }
    });
  }

  // Nuancier de sélection des couleurs
  const colorBtns = document.querySelectorAll('.chalk-color-btn');
  colorBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const col = btn.getAttribute('data-color') || '#f8fafc';
      chalkState.color = col;
      colorBtns.forEach((b) => {
        b.classList.remove('border-2', 'border-amber-300', 'scale-110');
        b.classList.add('border', 'border-stone-600');
      });
      btn.classList.add('border-2', 'border-amber-300', 'scale-110');
      btn.classList.remove('border-stone-600');
    });
  });

  // Sélecteur d'épaisseur de trait
  const widthBtns = document.querySelectorAll('.chalk-width-btn');
  widthBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const w = Number(btn.getAttribute('data-width')) || 6;
      chalkState.width = w;
      widthBtns.forEach((b) => {
        b.classList.remove('active', 'border-amber-500', 'bg-amber-950', 'text-amber-200');
        b.classList.add('border-stone-700', 'bg-stone-900', 'text-stone-300');
      });
      btn.classList.add('active', 'border-amber-500', 'bg-amber-950', 'text-amber-200');
      btn.classList.remove('border-stone-700', 'bg-stone-900', 'text-stone-300');
    });
  });

  // Bouton fermeture de la barre flottante
  if (btnClose) {
    btnClose.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setMapTool('select');
    });
  }

  // Effacer uniquement mes tracés permanents
  if (btnClearMy) {
    btnClearMy.addEventListener('click', (e) => {
      e.preventDefault();
      const authorName = CURRENT_USER_NAME || (CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : 'Aventurier');
      if (CURRENT_ROOM) {
        socket.emit('draw:clear', { roomId: CURRENT_ROOM, author: authorName, all: false }, (res) => {
          if (res?.success) {
            tacticalMapState.drawings = (tacticalMapState.drawings || []).filter((d) => d.author !== authorName);
            ephemeralDrawings = ephemeralDrawings.filter((d) => d.author !== authorName);
            requestMapRender();
          }
        });
      }
    });
  }

  // Effacer tous les tracés de la carte
  if (btnClearAll) {
    btnClearAll.addEventListener('click', (e) => {
      e.preventDefault();
      if (!confirm('Voulez-vous effacer l\'intégralité des tracés de craie de la carte ?')) return;
      if (CURRENT_ROOM) {
        socket.emit('draw:clear', { roomId: CURRENT_ROOM, all: true, role: CURRENT_ROLE }, (res) => {
          if (res?.success) {
            tacticalMapState.drawings = [];
            ephemeralDrawings = [];
            requestMapRender();
          }
        });
      }
    });
  }
}

/**
 * Ouvre la modale d'inspection et d'interaction avec un objet ou PNJ personnalisé
 */
function openPropDetailModal(prop) {
  if (!prop) return;
  selectedPropForDetail = prop;

  const iconEl = document.getElementById('prop-detail-icon');
  if (iconEl) iconEl.textContent = prop.icon || '[■]';

  const nameEl = document.getElementById('prop-detail-name');
  if (nameEl) nameEl.textContent = prop.name || 'Objet Sans Titre';

  const stateEl = document.getElementById('prop-detail-state');
  if (stateEl) stateEl.textContent = prop.stateLabel || 'Intact';

  const descEl = document.getElementById('prop-detail-desc');
  if (descEl) descEl.textContent = prop.description || 'Aucune description disponible.';

  // Image d'illustration
  const imgBox = document.getElementById('prop-detail-img-box');
  const imgEl = document.getElementById('prop-detail-img');
  if (prop.imageUrl && prop.imageUrl.trim()) {
    if (imgEl) imgEl.src = prop.imageUrl.trim();
    if (imgBox) imgBox.classList.remove('hidden');
  } else {
    if (imgBox) imgBox.classList.add('hidden');
  }

  // Document secret / Parchemin
  const docBox = document.getElementById('prop-detail-doc-box');
  const docText = document.getElementById('prop-detail-doc-text');
  const hasDoc = Boolean(prop.revealedDoc && prop.revealedDoc.trim());
  if (hasDoc && (prop.isDocRevealed || CURRENT_ROLE === 'mj')) {
    if (docText) {
      let content = prop.revealedDoc;
      if (!prop.isDocRevealed && CURRENT_ROLE === 'mj') {
        content += '\n\n[Note MJ : Ce document est actuellement masqué aux joueurs]';
      }
      docText.textContent = content;
    }
    if (docBox) docBox.classList.remove('hidden');
  } else {
    if (docBox) docBox.classList.add('hidden');
  }

  // Notes secrètes du MJ
  const secretBox = document.getElementById('prop-detail-secret-box');
  const secretText = document.getElementById('prop-detail-secret-text');
  if (CURRENT_ROLE === 'mj' && prop.secretNotes && prop.secretNotes.trim()) {
    if (secretText) secretText.textContent = prop.secretNotes;
    if (secretBox) secretBox.classList.remove('hidden');
  } else {
    if (secretBox) secretBox.classList.add('hidden');
  }

  // Barre d'outils du Maître du Jeu
  const mjActionsBox = document.getElementById('prop-mj-actions');
  const btnToggleReveal = document.getElementById('btn-prop-toggle-doc-reveal');
  const btnTriggerDoor = document.getElementById('btn-prop-trigger-door');
  if (CURRENT_ROLE === 'mj') {
    if (mjActionsBox) mjActionsBox.classList.remove('hidden');
    if (btnToggleReveal) {
      btnToggleReveal.textContent = prop.isDocRevealed ? '[Masquer Parchemin]' : '[✦ Révéler Parchemin]';
      btnToggleReveal.classList.toggle('border-amber-500', Boolean(prop.isDocRevealed));
    }
    if (btnTriggerDoor) {
      if (prop.linkedDoorId) {
        btnTriggerDoor.classList.remove('hidden');
      } else {
        btnTriggerDoor.classList.add('hidden');
      }
    }
  } else {
    if (mjActionsBox) mjActionsBox.classList.add('hidden');
  }

  // Espace d'action joueur
  const actionInput = document.getElementById('prop-action-input');
  if (actionInput) actionInput.value = '';

  const modal = document.getElementById('modal-prop-detail');
  if (modal) modal.classList.remove('hidden');
}

/**
 * Ouvre la modale de création / édition d'un objet ou PNJ interactif (MJ)
 */
function openPropEditModal(prop = null, defaultCoords = null) {
  selectedPropForEdit = prop;
  propEditPendingCoords = defaultCoords || (prop ? { x: prop.x, y: prop.y } : { x: 1200, y: 800 });

  const modalTitle = document.getElementById('prop-edit-modal-title');
  if (modalTitle) {
    modalTitle.textContent = prop ? `✦ Édition : ${prop.name || 'Objet'} ✦` : '✦ Fiche Objet / PNJ Personnalisé ✦';
  }

  const btnDelete = document.getElementById('btn-prop-delete-edit');
  if (btnDelete) {
    btnDelete.classList.toggle('hidden', !prop);
  }

  const nameInput = document.getElementById('prop-edit-name');
  if (nameInput) nameInput.value = prop?.name || '';

  const stateInput = document.getElementById('prop-edit-state');
  if (stateInput) stateInput.value = prop?.stateLabel || 'Intact';

  const iconSelect = document.getElementById('prop-edit-icon');
  if (iconSelect) iconSelect.value = prop?.icon || '[■]';

  const sizeSelect = document.getElementById('prop-edit-size');
  if (sizeSelect) sizeSelect.value = String(prop?.size || 44);

  const imgUrlInput = document.getElementById('prop-edit-img-url');
  if (imgUrlInput) imgUrlInput.value = prop?.imageUrl || '';

  const prevBox = document.getElementById('prop-edit-img-preview-box');
  const prevImg = document.getElementById('prop-edit-img-preview');
  if (prop?.imageUrl && prop.imageUrl.trim()) {
    if (prevImg) prevImg.src = prop.imageUrl.trim();
    if (prevBox) prevBox.classList.remove('hidden');
  } else {
    if (prevBox) prevBox.classList.add('hidden');
  }

  const descInput = document.getElementById('prop-edit-desc');
  if (descInput) descInput.value = prop?.description || '';

  const docRevCheck = document.getElementById('prop-edit-doc-revealed');
  if (docRevCheck) docRevCheck.checked = Boolean(prop?.isDocRevealed);

  const docInput = document.getElementById('prop-edit-doc');
  if (docInput) docInput.value = prop?.revealedDoc || '';

  const radiusSelect = document.getElementById('prop-edit-radius');
  if (radiusSelect) radiusSelect.value = String(prop?.interactionRadius || 120);

  const secretInput = document.getElementById('prop-edit-secret');
  if (secretInput) secretInput.value = prop?.secretNotes || '';

  // Remplissage du menu déroulant des portes
  const doorSelect = document.getElementById('prop-edit-door-select');
  if (doorSelect) {
    doorSelect.innerHTML = '<option value="">Aucune porte liée</option>';
    const doors = (tacticalMapState.walls || []).filter((w) => w.wallType === 'door');
    doors.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      const status = d.isOpen ? 'Ouverte' : 'Fermée';
      const locked = d.isLocked ? ' / Verrouillée' : '';
      opt.textContent = `Porte #${d.id.slice(-4)} (${status}${locked})`;
      doorSelect.appendChild(opt);
    });
    doorSelect.value = prop?.linkedDoorId || '';
  }

  const modal = document.getElementById('modal-prop-edit');
  if (modal) modal.classList.remove('hidden');
}

/**
 * Initialise les modales, l'upload de fichiers locaux et les boutons des Objets Bac à Sable
 */
function initPropsUI() {
  const modalDetail = document.getElementById('modal-prop-detail');
  const btnCloseDetail = document.getElementById('btn-close-modal-prop-detail');
  const btnCancelDetail = document.getElementById('btn-cancel-modal-prop-detail');

  const closeDetail = () => {
    if (modalDetail) modalDetail.classList.add('hidden');
    selectedPropForDetail = null;
  };
  if (btnCloseDetail) btnCloseDetail.addEventListener('click', closeDetail);
  if (btnCancelDetail) btnCancelDetail.addEventListener('click', closeDetail);

  const modalEdit = document.getElementById('modal-prop-edit');
  const btnCloseEdit = document.getElementById('btn-close-modal-prop-edit');
  const btnCancelEdit = document.getElementById('btn-cancel-modal-prop-edit');

  const closeEdit = () => {
    if (modalEdit) modalEdit.classList.add('hidden');
    selectedPropForEdit = null;
  };
  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEdit);
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEdit);

  // Bouton "+ Objet / PNJ" dans la barre d'outils tactique
  const btnOpenToolbar = document.getElementById('btn-open-prop-modal');
  if (btnOpenToolbar) {
    btnOpenToolbar.addEventListener('click', () => {
      if (CURRENT_ROLE !== 'mj') return;
      const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
      openPropEditModal(null, { x: Math.round(center.x), y: Math.round(center.y) });
    });
  }

  // Téléversement d'image depuis le PC
  const btnBrowsePc = document.getElementById('btn-prop-browse-pc');
  const fileInput = document.getElementById('prop-edit-file');
  const imgUrlInput = document.getElementById('prop-edit-img-url');
  const btnClearImg = document.getElementById('btn-prop-clear-img');
  const prevBox = document.getElementById('prop-edit-img-preview-box');
  const prevImg = document.getElementById('prop-edit-img-preview');

  if (btnBrowsePc && fileInput) {
    btnBrowsePc.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('image', file);

      fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.url) {
            if (imgUrlInput) imgUrlInput.value = data.url;
            if (prevImg) prevImg.src = data.url;
            if (prevBox) prevBox.classList.remove('hidden');
          } else {
            alert('Erreur lors du téléversement de l\'image.');
          }
        })
        .catch((err) => {
          console.error('Erreur téléversement image objet:', err);
          alert('Erreur réseau lors de l\'envoi de l\'image.');
        });
    });
  }

  if (imgUrlInput) {
    imgUrlInput.addEventListener('input', (e) => {
      const url = e.target.value.trim();
      if (url) {
        if (prevImg) prevImg.src = url;
        if (prevBox) prevBox.classList.remove('hidden');
      } else {
        if (prevBox) prevBox.classList.add('hidden');
      }
    });
  }

  if (btnClearImg) {
    btnClearImg.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (imgUrlInput) imgUrlInput.value = '';
      if (prevBox) prevBox.classList.add('hidden');
      if (prevImg) prevImg.src = '';
    });
  }

  // Enregistrement de l'objet (Création ou Mise à jour)
  const btnSaveEdit = document.getElementById('btn-save-prop-edit');
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', () => {
      if (CURRENT_ROLE !== 'mj' || !CURRENT_ROOM) return;

      const name = document.getElementById('prop-edit-name')?.value.trim() || 'Élément Interactif';
      const stateLabel = document.getElementById('prop-edit-state')?.value.trim() || 'Intact';
      const icon = document.getElementById('prop-edit-icon')?.value || '[■]';
      const size = parseInt(document.getElementById('prop-edit-size')?.value, 10) || 44;
      const imageUrl = document.getElementById('prop-edit-img-url')?.value.trim() || '';
      const description = document.getElementById('prop-edit-desc')?.value.trim() || '';
      const isDocRevealed = Boolean(document.getElementById('prop-edit-doc-revealed')?.checked);
      const revealedDoc = document.getElementById('prop-edit-doc')?.value.trim() || '';
      const linkedDoorId = document.getElementById('prop-edit-door-select')?.value || null;
      const interactionRadius = parseInt(document.getElementById('prop-edit-radius')?.value, 10) || 120;
      const secretNotes = document.getElementById('prop-edit-secret')?.value.trim() || '';

      if (selectedPropForEdit) {
        const updates = {
          name,
          stateLabel,
          icon,
          size,
          imageUrl,
          description,
          isDocRevealed,
          revealedDoc,
          linkedDoorId,
          interactionRadius,
          secretNotes
        };
        socket.emit('prop:update', {
          roomId: CURRENT_ROOM,
          propId: selectedPropForEdit.id,
          updates,
          role: CURRENT_ROLE
        });
      } else {
        const coords = propEditPendingCoords || { x: 1200, y: 800 };
        const propData = {
          name,
          stateLabel,
          icon,
          size,
          x: coords.x,
          y: coords.y,
          imageUrl,
          description,
          isDocRevealed,
          revealedDoc,
          linkedDoorId,
          interactionRadius,
          secretNotes
        };
        socket.emit('prop:add', {
          roomId: CURRENT_ROOM,
          propData,
          role: CURRENT_ROLE
        });
      }

      closeEdit();
    });
  }

  // Suppression d'un objet depuis la modale d'édition
  const btnDeleteEdit = document.getElementById('btn-prop-delete-edit');
  if (btnDeleteEdit) {
    btnDeleteEdit.addEventListener('click', () => {
      if (!selectedPropForEdit || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      if (confirm(`Voulez-vous supprimer définitivement "${selectedPropForEdit.name || 'cet élément'}" ?`)) {
        socket.emit('prop:remove', {
          roomId: CURRENT_ROOM,
          propId: selectedPropForEdit.id,
          role: CURRENT_ROLE
        });
        tacticalMapState.props = (tacticalMapState.props || []).filter((p) => p.id !== selectedPropForEdit.id);
        hoveredProp = null;
        closeEdit();
        requestMapRender();
      }
    });
  }

  // Actions depuis la modale de détail
  const btnEditOpen = document.getElementById('btn-prop-edit-open');
  if (btnEditOpen) {
    btnEditOpen.addEventListener('click', () => {
      const propToEdit = selectedPropForDetail;
      closeDetail();
      if (propToEdit) openPropEditModal(propToEdit);
    });
  }

  const btnToggleReveal = document.getElementById('btn-prop-toggle-doc-reveal');
  if (btnToggleReveal) {
    btnToggleReveal.addEventListener('click', () => {
      if (!selectedPropForDetail || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      const newRevealed = !selectedPropForDetail.isDocRevealed;
      selectedPropForDetail.isDocRevealed = newRevealed;
      socket.emit('prop:update', {
        roomId: CURRENT_ROOM,
        propId: selectedPropForDetail.id,
        updates: { isDocRevealed: newRevealed },
        role: CURRENT_ROLE
      });
      openPropDetailModal(selectedPropForDetail);
    });
  }

  const btnTriggerDoor = document.getElementById('btn-prop-trigger-door');
  if (btnTriggerDoor) {
    btnTriggerDoor.addEventListener('click', () => {
      if (!selectedPropForDetail || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      socket.emit('prop:trigger_door', {
        roomId: CURRENT_ROOM,
        propId: selectedPropForDetail.id,
        role: CURRENT_ROLE
      });
    });
  }

  const btnExportClue = document.getElementById('btn-prop-export-clue');
  if (btnExportClue) {
    btnExportClue.addEventListener('click', () => {
      if (!selectedPropForDetail || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      const author = CURRENT_USER_NAME || 'Maître du Jeu';
      socket.emit('prop:export_investigation', {
        roomId: CURRENT_ROOM,
        propId: selectedPropForDetail.id,
        authorName: author
      });
      alert(`[✓] L'élément "${selectedPropForDetail.name || 'Objet'}" et ses indices ont été épinglés sur le Mur d'Enquête !`);
    });
  }

  // Envoi d'une action improvisée dans le chat
  const btnSendAction = document.getElementById('btn-prop-send-action');
  const actionInput = document.getElementById('prop-action-input');

  const sendPropAction = () => {
    const text = actionInput?.value.trim();
    if (!text || !CURRENT_ROOM) return;
    const author = CURRENT_USER_NAME || (CURRENT_ROLE === 'mj' ? 'Le Maître du Jeu' : 'Un aventurier');
    const propName = selectedPropForDetail?.name || 'un élément de décor';

    socket.emit('chat:message', {
      roomId: CURRENT_ROOM,
      sender: author,
      text: `[Interaction avec "${propName}"] : ${text}`,
      role: CURRENT_ROLE
    });

    if (actionInput) actionInput.value = '';
    alert(`Action transmise au groupe et au MJ : "${text}"`);
  };

  if (btnSendAction) btnSendAction.addEventListener('click', sendPropAction);
  if (actionInput) {
    actionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendPropAction();
      }
    });
  }
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

  // Badge du numéro de Manche (Round)
  const roundEl = document.getElementById('turn-round-badge');
  if (roundEl) {
    const roundNum = tacticalMapState.turnRound || currentTurn?.round || 1;
    roundEl.textContent = `M. ${roundNum}`;
  }

  // Badge du jet d'initiative d20
  const d20Badge = document.getElementById('turn-d20-badge');
  if (d20Badge) {
    if (currentTurn && typeof currentTurn.roll === 'number') {
      d20Badge.textContent = `Init: ${currentTurn.roll}`;
      d20Badge.classList.remove('hidden');
    } else {
      d20Badge.classList.add('hidden');
    }
  }

  // Bouton "Fin de Tour" pour le joueur actif
  const btnFinish = document.getElementById('btn-finish-my-turn');
  const isMyTurn = (CURRENT_ROLE === 'player') && Boolean(
    currentTurn && (
      (typeof myAssignedSlot === 'number' && currentTurn.slot === myAssignedSlot) ||
      (CURRENT_USER_NAME && currentTurn.name && currentTurn.name.toLowerCase() === CURRENT_USER_NAME.toLowerCase())
    )
  );

  if (btnFinish) {
    if (isMyTurn) {
      btnFinish.classList.remove('hidden');
      btnFinish.classList.add('flex');
    } else {
      btnFinish.classList.add('hidden');
      btnFinish.classList.remove('flex');
    }
  }

  // Boutons du MJ : Tour Suivant & Lancer Initiative
  const btnNext = document.getElementById('btn-next-turn');
  const btnRollInit = document.getElementById('btn-roll-initiative');
  if (btnNext) {
    if (CURRENT_ROLE === 'mj') {
      btnNext.classList.remove('hidden');
      btnNext.classList.add('flex');
    } else {
      btnNext.classList.add('hidden');
      btnNext.classList.remove('flex');
    }
  }
  if (btnRollInit) {
    if (CURRENT_ROLE === 'mj') {
      btnRollInit.classList.remove('hidden');
      btnRollInit.classList.add('flex');
    } else {
      btnRollInit.classList.add('hidden');
      btnRollInit.classList.remove('flex');
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
        if (res?.success && res.result?.currentTurn) {
          updateTurnDisplay(res.result.currentTurn);
          requestMapRender();
        } else if (res?.error) {
          alert(`Info : ${res.error}`);
        }
      });
    });
  }

  // Bouton Finir mon tour pour le joueur actif
  const btnFinish = document.getElementById('btn-finish-my-turn');
  if (btnFinish) {
    btnFinish.addEventListener('click', () => {
      if (!CURRENT_ROOM) return;
      socket.emit('turn:finish', {
        roomId: CURRENT_ROOM,
        slot: myAssignedSlot,
        reason: 'manual'
      }, (res) => {
        if (res?.success) {
          btnFinish.classList.add('hidden');
          btnFinish.classList.remove('flex');
        } else if (res?.error) {
          alert(`Info : ${res.error}`);
        }
      });
    });
  }

  // Bouton Relancer l'initiative d20 autonome (MJ)
  const btnRollInit = document.getElementById('btn-roll-initiative');
  if (btnRollInit) {
    btnRollInit.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      socket.emit('turn:roll_initiative', {
        roomId: CURRENT_ROOM,
        role: CURRENT_ROLE
      }, (res) => {
        if (res?.success && res.result?.currentTurn) {
          tacticalMapState.currentTurn = res.result.currentTurn;
          tacticalMapState.turnRound = res.result.round;
          updateTurnDisplay(res.result.currentTurn);
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

/**
 * Gestionnaire d'interface de la Modale des Altérations d'État & Conditions
 */
let selectedConditionTokenId = null;

function refreshConditionsModalUI() {
  const modal = document.getElementById('modal-token-conditions');
  if (!modal || modal.classList.contains('hidden')) return;

  const select = document.getElementById('modal-conditions-token-select');
  const activeList = document.getElementById('modal-conditions-active-list');
  const grid = document.getElementById('modal-conditions-catalogue-grid');
  if (!select || !activeList || !grid) return;

  const tokens = tacticalMapState.tokens || [];
  if (tokens.length === 0) {
    select.innerHTML = '<option value="">Aucun pion sur le terrain</option>';
    activeList.innerHTML = '<p class="text-xs text-stone-400 italic">Aucun pion sur la carte.</p>';
    grid.innerHTML = '';
    return;
  }

  // Sélection par défaut
  if (!selectedConditionTokenId || !tokens.some((t) => t.id === selectedConditionTokenId)) {
    if (CURRENT_ROLE !== 'mj') {
      const myToken = getMyPlayerToken();
      selectedConditionTokenId = myToken ? myToken.id : tokens[0].id;
    } else {
      selectedConditionTokenId = tokens[0].id;
    }
  }

  select.innerHTML = tokens.map((t) => {
    const isSel = t.id === selectedConditionTokenId ? 'selected' : '';
    const label = `${t.type === 'monster' ? '[Monstre]' : '[Joueur]'} ${t.name || 'Pion'}`;
    return `<option value="${t.id}" ${isSel}>${label}</option>`;
  }).join('');

  if (CURRENT_ROLE !== 'mj') {
    select.disabled = true;
  } else {
    select.disabled = false;
  }

  const currentToken = tokens.find((t) => t.id === selectedConditionTokenId);
  if (!currentToken) return;

  // 1. Conditions actives
  const activeConds = getTokenConditions(currentToken);
  if (activeConds.length === 0) {
    activeList.innerHTML = '<p class="text-xs text-stone-400 italic py-1">Aucune altération active sur ce pion (parfait état).</p>';
  } else {
    activeList.innerHTML = activeConds.map((c) => {
      return `
        <div class="flex items-center justify-between bg-[#14100c] border border-[#78350f]/60 px-2.5 py-1.5 shadow-sm">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs" style="color: ${c.color || '#f59e0b'}">${c.icon || '[?]'}</span>
            <div>
              <div class="text-xs font-cinzel font-bold" style="color: ${c.color || '#fef08a'}">${c.name}</div>
              <div class="text-[10px] text-stone-400 font-crimson italic">${c.desc || ''}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 text-[10px] font-mono font-bold bg-stone-900 border border-stone-700 text-amber-200">
              ${c.duration} ${c.duration > 1 ? 'tours' : 'tour'}
            </span>
            <button
              type="button"
              data-remove-condition="${c.id}"
              class="btn-remove-cond px-2 py-0.5 text-[10px] font-cinzel font-bold bg-emerald-950 border border-emerald-600/70 text-emerald-300 hover:bg-emerald-900 transition cursor-pointer"
              title="Soigner / dissiper cet état"
            >
              Soigner
            </button>
          </div>
        </div>
      `;
    }).join('');

    activeList.querySelectorAll('.btn-remove-cond').forEach((btn) => {
      btn.addEventListener('click', () => {
        const condId = btn.getAttribute('data-remove-condition');
        if (!condId || !CURRENT_ROOM || !selectedConditionTokenId) return;
        socket.emit('token:remove_condition', {
          roomId: CURRENT_ROOM,
          tokenId: selectedConditionTokenId,
          conditionId: condId,
          role: CURRENT_ROLE
        });
      });
    });
  }

  // 2. Grille du catalogue
  grid.innerHTML = RPG_CONDITIONS_CATALOGUE.map((def) => {
    const isAlreadyActive = activeConds.some((c) => c.id === def.id);
    return `
      <div class="flex items-center justify-between bg-[#14100c] border border-stone-800 hover:border-amber-700/60 p-2 shadow transition">
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold" style="color: ${def.color}">${def.icon}</span>
          <div>
            <div class="text-xs font-cinzel font-bold" style="color: ${def.color}">${def.name}</div>
            <div class="text-[10px] text-stone-400 font-crimson italic leading-tight line-clamp-1">${def.desc}</div>
          </div>
        </div>
        <button
          type="button"
          data-apply-condition="${def.id}"
          class="btn-apply-cond px-2.5 py-1 text-[10px] font-cinzel font-bold transition shadow cursor-pointer active:scale-95 whitespace-nowrap ${
            isAlreadyActive
              ? 'bg-amber-950 border border-amber-600/70 text-amber-300 hover:bg-amber-900'
              : 'bg-stone-900 border border-[#78350f] text-stone-300 hover:text-amber-200 hover:bg-stone-800'
          }"
          title="Appliquer cette condition au pion sélectionné"
        >
          ${isAlreadyActive ? 'Prolonger' : 'Appliquer'}
        </button>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.btn-apply-cond').forEach((btn) => {
    btn.addEventListener('click', () => {
      const condId = btn.getAttribute('data-apply-condition');
      const durSel = document.getElementById('modal-condition-duration-select');
      const duration = durSel ? Number(durSel.value) : 3;
      if (!condId || !CURRENT_ROOM || !selectedConditionTokenId) return;

      socket.emit('token:set_condition', {
        roomId: CURRENT_ROOM,
        tokenId: selectedConditionTokenId,
        conditionId: condId,
        duration,
        role: CURRENT_ROLE
      });
    });
  });
}

function initConditionsModalUI() {
  const modal = document.getElementById('modal-token-conditions');
  if (!modal) return;

  const btnOpen1 = document.getElementById('btn-open-conditions-modal');
  const btnOpen2 = document.getElementById('btn-open-conditions-modal-mj');
  const btnClose = document.getElementById('btn-close-modal-conditions');
  const btnCancel = document.getElementById('btn-cancel-modal-conditions');
  const select = document.getElementById('modal-conditions-token-select');
  const btnClearAll = document.getElementById('btn-modal-clear-conditions');

  const openModal = () => {
    modal.classList.remove('hidden');
    refreshConditionsModalUI();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (btnOpen1) btnOpen1.addEventListener('click', openModal);
  if (btnOpen2) btnOpen2.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (select) {
    select.addEventListener('change', () => {
      selectedConditionTokenId = select.value;
      refreshConditionsModalUI();
    });
  }

  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (!CURRENT_ROOM || !selectedConditionTokenId) return;
      socket.emit('token:clear_conditions', {
        roomId: CURRENT_ROOM,
        tokenId: selectedConditionTokenId,
        role: CURRENT_ROLE
      });
    });
  }
}

/**
 * Rafraîchit les statistiques et le registre des pièges dans la modale MJ
 */
function refreshTrapsModalUI() {
  const modal = document.getElementById('modal-traps-manager');
  if (!modal || modal.classList.contains('hidden')) return;

  const traps = tacticalMapState.traps || [];
  const statTotal = document.getElementById('trap-stat-total');
  const statHidden = document.getElementById('trap-stat-hidden');
  const statRevealed = document.getElementById('trap-stat-revealed');
  const statTriggered = document.getElementById('trap-stat-triggered');
  const list = document.getElementById('modal-traps-list');

  const countHidden = traps.filter((t) => !t.revealed && !t.triggered).length;
  const countRevealed = traps.filter((t) => t.revealed && !t.triggered).length;
  const countTriggered = traps.filter((t) => t.triggered).length;

  if (statTotal) statTotal.textContent = traps.length;
  if (statHidden) statHidden.textContent = countHidden;
  if (statRevealed) statRevealed.textContent = countRevealed;
  if (statTriggered) statTriggered.textContent = countTriggered;

  if (!list) return;
  list.innerHTML = '';

  if (traps.length === 0) {
    list.innerHTML = `
      <div class="py-6 text-center text-stone-500 font-crimson italic text-xs">
        Aucun mécanisme ni piège déployé sur la carte.
      </div>
    `;
    return;
  }

  traps.forEach((trap, index) => {
    const isPassage = trap.subType === 'secret_passage';
    const row = document.createElement('div');
    row.className = 'flex flex-wrap items-center justify-between gap-2 p-2 bg-stone-950/70 border border-stone-800 hover:border-indigo-800 transition text-xs';

    let statusBadge = '';
    if (trap.triggered) {
      statusBadge = '<span class="px-1.5 py-0.5 text-[10px] bg-rose-950 border border-rose-700 text-rose-300 font-bold">Déclenché</span>';
    } else if (trap.disarmed) {
      statusBadge = '<span class="px-1.5 py-0.5 text-[10px] bg-stone-800 border border-stone-600 text-stone-300 font-bold">Désamorcé</span>';
    } else if (trap.revealed) {
      statusBadge = '<span class="px-1.5 py-0.5 text-[10px] bg-emerald-950 border border-emerald-700 text-emerald-300 font-bold">Révélé aux joueurs</span>';
    } else {
      statusBadge = '<span class="px-1.5 py-0.5 text-[10px] bg-amber-950/80 border border-amber-700 text-amber-300 font-bold">Dissimulé</span>';
    }

    const typeIcons = {
      'pit': '[v]',
      'snare': '[#]',
      'poison_dart': '[☣]',
      'secret_passage': '[⊓]'
    };
    const icon = typeIcons[trap.subType] || '[!]';

    row.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-indigo-400 font-bold">${icon}</span>
        <div>
          <div class="font-cinzel font-bold text-stone-200 flex items-center gap-2">
            <span>${trap.label || 'Piège #' + (index + 1)}</span>
            ${statusBadge}
          </div>
          <div class="font-crimson italic text-[11px] text-stone-400">
            X: ${Math.round(trap.x)} | Y: ${Math.round(trap.y)} | Rayon: ${trap.r || 25}px
            ${isPassage ? '' : `| Dégâts: ${trap.damage || 0} ${trap.condition ? `(${trap.condition})` : ''}`}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-1 bg-stone-900 border border-stone-700 px-2 py-0.5 text-[11px]" title="Difficulté de détection par la perception passive (DD)">
          <span class="text-stone-400 font-cinzel">DD</span>
          <input
            type="number"
            min="5"
            max="30"
            value="${trap.dc || 12}"
            data-trap-id="${trap.id}"
            class="trap-dc-input w-10 bg-transparent text-center font-bold text-amber-300 focus:outline-none"
          />
        </div>
        ${!isPassage ? `
          <button
            type="button"
            data-action="toggle-disarm"
            data-trap-id="${trap.id}"
            class="px-2 py-1 text-[10px] font-cinzel font-bold bg-stone-900 border ${trap.disarmed ? 'border-amber-600 text-amber-300 hover:bg-amber-950/50' : 'border-stone-700 text-stone-300 hover:bg-stone-800'} transition cursor-pointer"
            title="${trap.disarmed ? 'Réarmer le piège' : 'Désamorcer le piège'}"
          >
            ${trap.disarmed ? 'Réarmer' : 'Désamorcer'}
          </button>
        ` : ''}
        <button
          type="button"
          data-action="toggle-reveal"
          data-trap-id="${trap.id}"
          class="px-2 py-1 text-[10px] font-cinzel font-bold bg-stone-900 border ${trap.revealed ? 'border-emerald-600 text-emerald-300' : 'border-stone-700 text-stone-400 hover:text-stone-200'} transition cursor-pointer"
          title="${trap.revealed ? 'Masquer aux joueurs' : 'Révéler immédiatement aux joueurs'}"
        >
          ${trap.revealed ? 'Masquer' : 'Révéler'}
        </button>
        <button
          type="button"
          data-action="delete"
          data-trap-id="${trap.id}"
          class="px-2 py-1 text-[10px] font-cinzel font-bold bg-stone-900 border border-rose-700 text-rose-300 hover:bg-rose-950/60 transition cursor-pointer"
          title="Supprimer ce piège"
        >
          [✕]
        </button>
      </div>
    `;

    const dcInput = row.querySelector('.trap-dc-input');
    if (dcInput) {
      dcInput.addEventListener('change', () => {
        const newDc = parseInt(dcInput.value, 10);
        if (!isNaN(newDc) && newDc >= 5) {
          trap.dc = newDc;
          if (CURRENT_ROOM) {
            socket.emit('map:add_trap', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, trap });
          }
        }
      });
    }

    const btnDisarm = row.querySelector('[data-action="toggle-disarm"]');
    if (btnDisarm) {
      btnDisarm.addEventListener('click', () => {
        if (!CURRENT_ROOM) return;
        const willDisarm = !trap.disarmed;
        socket.emit('map:disarm_trap', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, trapId: trap.id, disarmed: willDisarm });
      });
    }

    const btnReveal = row.querySelector('[data-action="toggle-reveal"]');
    if (btnReveal) {
      btnReveal.addEventListener('click', () => {
        if (!CURRENT_ROOM) return;
        if (trap.revealed) {
          trap.revealed = false;
          socket.emit('map:add_trap', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, trap });
        } else {
          socket.emit('map:reveal_trap', {
            roomId: CURRENT_ROOM,
            trapId: trap.id,
            characterName: 'Maître du Jeu',
            score: trap.dc || 12,
            dc: trap.dc || 12
          });
        }
      });
    }

    const btnDel = row.querySelector('[data-action="delete"]');
    if (btnDel) {
      btnDel.addEventListener('click', () => {
        if (!CURRENT_ROOM) return;
        socket.emit('map:remove_trap', { roomId: CURRENT_ROOM, role: CURRENT_ROLE, trapId: trap.id });
      });
    }

    list.appendChild(row);
  });
}

/**
 * Initialise les interactions de la modale des Pièges et Mécanismes (MJ)
 */
function initTrapsModalUI() {
  const modal = document.getElementById('modal-traps-manager');
  if (!modal) return;

  const btnOpen = document.getElementById('btn-open-traps-modal');
  const btnClose = document.getElementById('btn-close-modal-traps');
  const btnCancel = document.getElementById('btn-cancel-modal-traps');
  const btnClearAll = document.getElementById('btn-modal-clear-all-traps');
  const btnClearTraps = document.getElementById('btn-clear-traps');
  const btnClearZones = document.getElementById('btn-clear-zones');

  const openModal = () => {
    modal.classList.remove('hidden');
    refreshTrapsModalUI();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      if (confirm('Voulez-vous supprimer tous les pièges et passages secrets de la carte ?')) {
        socket.emit('map:clear_traps', { roomId: CURRENT_ROOM, role: CURRENT_ROLE });
      }
    });
  }

  if (btnClearTraps) {
    btnClearTraps.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      if (confirm('Voulez-vous supprimer tous les pièges et passages secrets de la carte ?')) {
        socket.emit('map:clear_traps', { roomId: CURRENT_ROLE, role: CURRENT_ROLE });
      }
    });
  }

  if (btnClearZones) {
    btnClearZones.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      if (confirm('Voulez-vous supprimer toutes les surfaces et zones de danger de la carte ?')) {
        socket.emit('map:clear_zones', { roomId: CURRENT_ROOM, role: CURRENT_ROLE });
      }
    });
  }
}

// Variables d'état pour la gestion des images locales de scènes
let activeSceneIdForBg = null;
let newSceneSelectedFile = null;

/**
 * Rafraîchit la liste des scènes dans la modale de gestion des scènes (MJ)
 */
function refreshSceneManagerModalUI() {
  const list = document.getElementById('modal-scenes-list');
  const badge = document.getElementById('preload-scenes-badge');
  if (!list) return;

  const renderScenes = (scenes) => {
    // Mettre à jour le badge d'état du préchargement en RAM
    if (badge) {
      const scenesWithBg = (scenes || []).filter((s) => Boolean(s.backgroundUrl));
      if (scenesWithBg.length === 0) {
        badge.textContent = 'Aucun fond';
        badge.className = 'px-1.5 py-0.5 text-[9px] bg-stone-950 border border-stone-800 text-stone-500 font-mono';
      } else {
        let readyCount = 0;
        scenesWithBg.forEach((s) => {
          const cached = preloadedScenesCache.get(s.id);
          if (cached && cached.loaded && cached.img?.complete) readyCount++;
        });
        badge.textContent = `${readyCount}/${scenesWithBg.length} prêts`;
        badge.className = readyCount === scenesWithBg.length
          ? 'px-1.5 py-0.5 text-[9px] bg-emerald-950 border border-emerald-600 text-emerald-300 font-mono'
          : 'px-1.5 py-0.5 text-[9px] bg-amber-950 border border-amber-600 text-amber-300 font-mono';
      }
    }

    if (!Array.isArray(scenes) || scenes.length === 0) {
      list.innerHTML = `
        <div class="py-6 text-center text-stone-500 font-crimson italic text-xs">
          Aucune scène enregistrée.
        </div>
      `;
      return;
    }

    list.innerHTML = '';
    const activeId = tacticalMapState.activeSceneId;

    scenes.forEach((s) => {
      const isActive = s.id === activeId;
      const row = document.createElement('div');
      row.className = `flex flex-wrap items-center justify-between gap-2 p-2 bg-stone-950/70 border ${isActive ? 'border-cyan-600 bg-cyan-950/20' : 'border-stone-800 hover:border-cyan-800/80'} transition text-xs`;

      const hasBg = Boolean(s.backgroundUrl);
      const cached = preloadedScenesCache.get(s.id);
      const isLoaded = cached && cached.loaded && cached.img?.complete;

      const thumbHtml = hasBg
        ? `<img src="${s.backgroundUrl}" alt="Aperçu" class="w-10 h-10 object-cover border border-cyan-800 flex-shrink-0 bg-black" />`
        : `<div class="w-10 h-10 border border-dashed border-stone-700 flex items-center justify-center text-stone-600 text-[10px] font-mono flex-shrink-0 bg-stone-900">[Grille]</div>`;

      const ramStatusBadge = hasBg
        ? (isLoaded
            ? `<span class="px-1.5 py-0.5 text-[9px] bg-emerald-950/80 border border-emerald-700 text-emerald-300 font-mono" title="Image chargée en mémoire RAM (transition instantanée)">[✓ RAM]</span>`
            : `<span class="px-1.5 py-0.5 text-[9px] bg-amber-950/80 border border-amber-700 text-amber-300 font-mono" title="En attente de préchargement">[En attente]</span>`)
        : `<span class="px-1.5 py-0.5 text-[9px] bg-stone-900 border border-stone-800 text-stone-500 font-mono">[Défaut]</span>`;

      row.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          ${thumbHtml}
          <div class="min-w-0">
            <div class="font-cinzel font-bold text-stone-200 flex items-center gap-2 truncate">
              <span class="truncate">${s.name || 'Scène sans titre'}</span>
              ${isActive ? '<span class="px-1.5 py-0.5 text-[9px] bg-emerald-950 border border-emerald-600 text-emerald-300 font-bold font-cinzel">[ACTIVE]</span>' : ''}
              ${ramStatusBadge}
            </div>
            <div class="font-crimson italic text-[11px] text-stone-400">
              Pions: ${s.tokensCount ?? 0} | Téléporteurs: ${s.teleportersCount ?? 0} | Ambiance: ${s.lightingMode === 'night' ? 'Nuit' : 'Jour'}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          ${!isActive ? `
            <button
              type="button"
              data-action="switch"
              data-scene-id="${s.id}"
              class="px-2 py-1 text-[10px] font-cinzel font-bold bg-cyan-950 border border-cyan-600 text-cyan-200 hover:bg-cyan-900 transition cursor-pointer active:scale-95"
              title="Basculer la table de jeu sur cette scène"
            >
              [▶] Basculer
            </button>
          ` : ''}
          <button
            type="button"
            data-action="pick-bg"
            data-scene-id="${s.id}"
            class="px-2 py-1 text-[10px] font-cinzel font-bold bg-stone-900 border border-cyan-800 text-cyan-300 hover:bg-cyan-950 hover:border-cyan-600 transition cursor-pointer"
            title="Choisir une image sur le PC pour cette scène"
          >
            [+ Fond PC]
          </button>
          ${hasBg ? `
            <button
              type="button"
              data-action="clear-bg"
              data-scene-id="${s.id}"
              class="px-1.5 py-1 text-[10px] font-cinzel font-bold bg-stone-900 border border-stone-800 text-stone-400 hover:text-amber-300 hover:border-amber-700 transition cursor-pointer"
              title="Réinitialiser à une grille neutre sans fond"
            >
              [✕ Fond]
            </button>
          ` : ''}
          ${!isActive && scenes.length > 1 ? `
            <button
              type="button"
              data-action="delete"
              data-scene-id="${s.id}"
              class="px-2 py-1 text-[10px] font-cinzel font-bold bg-stone-900 border border-rose-800 text-rose-300 hover:bg-rose-950/60 transition cursor-pointer"
              title="Supprimer cette scène"
            >
              [✕]
            </button>
          ` : ''}
        </div>
      `;

      const btnSwitch = row.querySelector('[data-action="switch"]');
      if (btnSwitch) {
        btnSwitch.addEventListener('click', () => {
          if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
          socket.emit('scene:switch', {
            roomId: CURRENT_ROOM,
            role: CURRENT_ROLE,
            targetSceneId: s.id,
            transportPlayers: true
          });
          const modal = document.getElementById('modal-scene-manager');
          if (modal) modal.classList.add('hidden');
        });
      }

      const btnPickBg = row.querySelector('[data-action="pick-bg"]');
      if (btnPickBg) {
        btnPickBg.addEventListener('click', () => {
          if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
          activeSceneIdForBg = s.id;
          const bgFileInput = document.getElementById('scene-update-bg-file-input');
          if (bgFileInput) {
            bgFileInput.value = '';
            bgFileInput.click();
          }
        });
      }

      const btnClearBg = row.querySelector('[data-action="clear-bg"]');
      if (btnClearBg) {
        btnClearBg.addEventListener('click', () => {
          if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
          if (confirm(`Retirer l'image de fond pour la scène "${s.name || s.id}" et revenir à la grille neutre ?`)) {
            socket.emit('scene:update', {
              roomId: CURRENT_ROOM,
              role: CURRENT_ROLE,
              sceneId: s.id,
              updates: { backgroundUrl: null }
            }, () => {
              preloadedScenesCache.delete(s.id);
              refreshSceneManagerModalUI();
            });
          }
        });
      }

      const btnDelete = row.querySelector('[data-action="delete"]');
      if (btnDelete) {
        btnDelete.addEventListener('click', () => {
          if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
          if (confirm(`Voulez-vous supprimer définitivement la scène "${s.name || s.id}" ?`)) {
            socket.emit('scene:delete', {
              roomId: CURRENT_ROOM,
              role: CURRENT_ROLE,
              sceneId: s.id
            }, () => {
              preloadedScenesCache.delete(s.id);
              refreshSceneManagerModalUI();
            });
          }
        });
      }

      list.appendChild(row);
    });
  };

  if (CURRENT_ROOM) {
    socket.emit('scene:list', { roomId: CURRENT_ROOM }, (res) => {
      if (res?.success && Array.isArray(res.scenes)) {
        tacticalMapState.scenes = res.scenes;
        if (res.activeSceneId) tacticalMapState.activeSceneId = res.activeSceneId;
        renderScenes(res.scenes);
      } else {
        renderScenes(tacticalMapState.scenes || []);
      }
    });
  } else {
    renderScenes(tacticalMapState.scenes || []);
  }
}

/**
 * Ouvre la modale de configuration d'un nouveau téléporteur aux coordonnées spécifiées
 */
function openTeleportConfigModal(x, y) {
  pendingTeleportCoords = { x, y };
  const modal = document.getElementById('modal-teleport-config');
  if (!modal) return;

  const select = document.getElementById('teleport-input-target-scene');
  if (select) {
    select.innerHTML = '';
    const scenes = tacticalMapState.scenes || [];
    const activeId = tacticalMapState.activeSceneId;

    if (scenes.length === 0) {
      const opt = document.createElement('option');
      opt.value = activeId;
      opt.textContent = tacticalMapState.sceneName || 'Scène Principale';
      select.appendChild(opt);
    } else {
      scenes.forEach((s) => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.name || s.id} ${s.id === activeId ? '(Scène actuelle)' : ''}`;
        if (s.id !== activeId) {
          opt.selected = true;
        }
        select.appendChild(opt);
      });
    }
  }

  const nameInput = document.getElementById('teleport-input-name');
  if (nameInput) {
    nameInput.value = 'Escalier / Point de passage';
  }

  const targetXInput = document.getElementById('teleport-input-target-x');
  const targetYInput = document.getElementById('teleport-input-target-y');
  if (targetXInput) targetXInput.value = x;
  if (targetYInput) targetYInput.value = y;

  modal.classList.remove('hidden');
}

/**
 * Initialise les interactions de la modale de placement de téléporteur (MJ)
 */
function initTeleportConfigModalUI() {
  const modal = document.getElementById('modal-teleport-config');
  if (!modal) return;

  const btnClose = document.getElementById('btn-close-modal-teleport');
  const btnCancel = document.getElementById('btn-cancel-modal-teleport');
  const btnConfirm = document.getElementById('btn-confirm-modal-teleport');

  const btnPresetCenter = document.getElementById('btn-teleport-preset-center');
  const btnPresetNorth = document.getElementById('btn-teleport-preset-north');
  const btnPresetSouth = document.getElementById('btn-teleport-preset-south');

  const targetXInput = document.getElementById('teleport-input-target-x');
  const targetYInput = document.getElementById('teleport-input-target-y');

  if (btnPresetCenter) {
    btnPresetCenter.addEventListener('click', () => {
      if (targetXInput) targetXInput.value = 600;
      if (targetYInput) targetYInput.value = 600;
    });
  }
  if (btnPresetNorth) {
    btnPresetNorth.addEventListener('click', () => {
      if (targetXInput) targetXInput.value = 600;
      if (targetYInput) targetYInput.value = 200;
    });
  }
  if (btnPresetSouth) {
    btnPresetSouth.addEventListener('click', () => {
      if (targetXInput) targetXInput.value = 600;
      if (targetYInput) targetYInput.value = 1000;
    });
  }

  const closeModal = () => {
    modal.classList.add('hidden');
    setMapTool('select');
  };

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

      const nameInput = document.getElementById('teleport-input-name');
      const typeSelect = document.getElementById('teleport-input-type');
      const targetSceneSelect = document.getElementById('teleport-input-target-scene');

      const name = nameInput?.value.trim() || 'Point de passage';
      const type = typeSelect?.value || 'stairs_down';
      const targetSceneId = targetSceneSelect?.value || tacticalMapState.activeSceneId;
      const targetX = parseInt(targetXInput?.value, 10) || 500;
      const targetY = parseInt(targetYInput?.value, 10) || 500;

      const teleporterData = {
        x: pendingTeleportCoords.x,
        y: pendingTeleportCoords.y,
        r: 32,
        name,
        type,
        targetSceneId,
        targetX,
        targetY
      };

      socket.emit('scene:add_teleporter', {
        roomId: CURRENT_ROOM,
        role: CURRENT_ROLE,
        teleporter: teleporterData
      }, (res) => {
        if (res?.success && res.teleporter) {
          if (!Array.isArray(tacticalMapState.teleporters)) tacticalMapState.teleporters = [];
          if (!tacticalMapState.teleporters.some((t) => t.id === res.teleporter.id)) {
            tacticalMapState.teleporters.push(res.teleporter);
          }
          requestMapRender();
        }
      });

      closeModal();
    });
  }
}

/**
 * Initialise les interactions de la modale de gestion des scènes (MJ)
 */
function initSceneManagerModalUI() {
  const modal = document.getElementById('modal-scene-manager');
  if (!modal) return;

  const btnOpen = document.getElementById('btn-open-scene-manager');
  const hudScenePill = document.getElementById('hud-scene-pill');
  const btnClose = document.getElementById('btn-close-modal-scenes');
  const btnCancel = document.getElementById('btn-cancel-modal-scenes');
  const btnCreateSubmit = document.getElementById('btn-create-scene-submit');
  const btnPreloadAll = document.getElementById('btn-preload-all-scenes');

  // Sélecteur de fichier local PC pour nouvelle scène
  const btnTriggerNewSceneFile = document.getElementById('btn-trigger-new-scene-file');
  const newSceneFileInput = document.getElementById('new-scene-file-input');
  const newSceneFileLabel = document.getElementById('new-scene-file-label');
  const btnClearNewSceneFile = document.getElementById('btn-clear-new-scene-file');
  const previewContainer = document.getElementById('new-scene-file-preview-container');
  const previewImg = document.getElementById('new-scene-file-preview');
  const previewName = document.getElementById('new-scene-file-name');
  const previewSize = document.getElementById('new-scene-file-size');

  // Input invisible pour mettre à jour le fond d'une scène existante depuis le PC
  const sceneUpdateBgFileInput = document.getElementById('scene-update-bg-file-input');

  const openModal = () => {
    modal.classList.remove('hidden');
    refreshSceneManagerModalUI();
  };

  const closeModal = () => {
    modal.classList.add('hidden');
  };

  if (btnOpen) btnOpen.addEventListener('click', openModal);
  if (hudScenePill) {
    hudScenePill.addEventListener('click', () => {
      if (CURRENT_ROLE === 'mj') openModal();
    });
  }
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  // Bouton de préchargement de toutes les scènes en RAM
  if (btnPreloadAll) {
    btnPreloadAll.addEventListener('click', () => {
      preloadAllScenes(true);
    });
  }

  // Déclencheur du sélecteur de fichier PC
  if (btnTriggerNewSceneFile && newSceneFileInput) {
    btnTriggerNewSceneFile.addEventListener('click', () => {
      newSceneFileInput.click();
    });
  }

  // Changement de fichier local pour la nouvelle scène
  if (newSceneFileInput) {
    newSceneFileInput.addEventListener('change', () => {
      const file = newSceneFileInput.files?.[0];
      if (!file) {
        newSceneSelectedFile = null;
        if (newSceneFileLabel) newSceneFileLabel.textContent = 'Aucun fichier (grille par défaut)';
        if (btnClearNewSceneFile) btnClearNewSceneFile.classList.add('hidden');
        if (previewContainer) previewContainer.classList.add('hidden');
        return;
      }

      newSceneSelectedFile = file;
      if (newSceneFileLabel) {
        newSceneFileLabel.textContent = file.name;
        newSceneFileLabel.title = file.name;
      }
      if (btnClearNewSceneFile) btnClearNewSceneFile.classList.remove('hidden');

      // Pré-remplir automatiquement le nom de la scène si le champ est vide
      const nameInput = document.getElementById('new-scene-name-input');
      if (nameInput && !nameInput.value.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        nameInput.value = baseName;
      }

      // Générer l'aperçu miniature local immédiat
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
        if (previewName) previewName.textContent = file.name;
        if (previewSize) {
          const sizeKb = (file.size / 1024).toFixed(1);
          const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
          previewSize.textContent = file.size > 1024 * 1024 ? `${sizeMb} Mo` : `${sizeKb} Ko`;
        }
        if (previewContainer) previewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  // Vider le fichier sélectionné
  if (btnClearNewSceneFile) {
    btnClearNewSceneFile.addEventListener('click', () => {
      newSceneSelectedFile = null;
      if (newSceneFileInput) newSceneFileInput.value = '';
      if (newSceneFileLabel) newSceneFileLabel.textContent = 'Aucun fichier (grille par défaut)';
      btnClearNewSceneFile.classList.add('hidden');
      if (previewContainer) previewContainer.classList.add('hidden');
    });
  }

  // Changement de fichier local pour mettre à jour une scène existante
  if (sceneUpdateBgFileInput) {
    sceneUpdateBgFileInput.addEventListener('change', async () => {
      const file = sceneUpdateBgFileInput.files?.[0];
      if (!file || !activeSceneIdForBg || !CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

      const targetSceneId = activeSceneIdForBg;
      try {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        const uploadData = await uploadRes.json();

        if (uploadData?.success && uploadData.url) {
          socket.emit('scene:update', {
            roomId: CURRENT_ROOM,
            role: CURRENT_ROLE,
            sceneId: targetSceneId,
            updates: { backgroundUrl: uploadData.url }
          }, (res) => {
            if (res?.success && res.scene) {
              preloadScene(res.scene);
            }
            refreshSceneManagerModalUI();
          });
        } else {
          alert('Erreur lors du téléversement de l\'image : ' + (uploadData?.message || 'Erreur inconnue'));
        }
      } catch (err) {
        console.error('Erreur upload fond scène :', err);
        alert('Erreur réseau lors de l\'envoi du fichier.');
      } finally {
        sceneUpdateBgFileInput.value = '';
        activeSceneIdForBg = null;
      }
    });
  }

  // Soumission de la création d'une nouvelle scène
  if (btnCreateSubmit) {
    btnCreateSubmit.addEventListener('click', async () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;

      const nameInput = document.getElementById('new-scene-name-input');
      const lightingSelect = document.getElementById('new-scene-lighting-select');
      const fogCheckbox = document.getElementById('new-scene-fog-checkbox');

      const name = nameInput?.value.trim();
      if (!name) {
        alert('Veuillez entrer un nom pour la nouvelle scène.');
        return;
      }

      const lightingMode = lightingSelect?.value || 'day';
      const fogEnabled = fogCheckbox ? fogCheckbox.checked : true;
      let backgroundUrl = null;

      // Si un fichier local PC a été sélectionné, on le téléverse au préalable
      if (newSceneSelectedFile) {
        const originalText = btnCreateSubmit.innerHTML;
        btnCreateSubmit.innerHTML = '[⟳] Téléversement...';
        btnCreateSubmit.disabled = true;

        try {
          const formData = new FormData();
          formData.append('file', newSceneSelectedFile);
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();

          if (uploadData?.success && uploadData.url) {
            backgroundUrl = uploadData.url;
          } else {
            alert('Erreur lors du téléversement de la carte : ' + (uploadData?.message || 'Erreur inconnue'));
            btnCreateSubmit.innerHTML = originalText;
            btnCreateSubmit.disabled = false;
            return;
          }
        } catch (err) {
          console.error('Erreur téléversement carte :', err);
          alert('Erreur réseau lors du téléversement de la carte.');
          btnCreateSubmit.innerHTML = originalText;
          btnCreateSubmit.disabled = false;
          return;
        } finally {
          btnCreateSubmit.innerHTML = originalText;
          btnCreateSubmit.disabled = false;
        }
      }

      socket.emit('scene:create', {
        roomId: CURRENT_ROOM,
        role: CURRENT_ROLE,
        scene: {
          name,
          backgroundUrl,
          lightingMode,
          fogEnabled
        }
      }, (res) => {
        if (res?.success) {
          if (nameInput) nameInput.value = '';
          newSceneSelectedFile = null;
          if (newSceneFileInput) newSceneFileInput.value = '';
          if (newSceneFileLabel) newSceneFileLabel.textContent = 'Aucun fichier (grille par défaut)';
          if (btnClearNewSceneFile) btnClearNewSceneFile.classList.add('hidden');
          if (previewContainer) previewContainer.classList.add('hidden');

          if (res.scene) {
            preloadScene(res.scene);
          }
          refreshSceneManagerModalUI();
        } else if (res?.error) {
          alert('Erreur lors de la création de la scène : ' + res.error);
        }
      });
    });
  }
}

// ------------------------------------------------------------
// RACCOURCIS CLAVIER TACTIQUES & VOLET ANCRÉ (FEATURE RACCOURCIS)
// ------------------------------------------------------------

/**
 * Vérifie si la vue Carte Tactique est actuellement active à l'écran
 */
function isTacticalMapActive() {
  const mapEl = document.getElementById('view-map');
  return Boolean(mapEl && !mapEl.classList.contains('hidden'));
}

/**
 * Vérifie si l'utilisateur est en train de saisir du texte dans un champ
 */
function isUserTyping() {
  const activeEl = document.activeElement;
  if (!activeEl) return false;
  const tag = activeEl.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || activeEl.isContentEditable;
}

/**
 * Vérifie si une fenêtre modale bloquante est actuellement ouverte à l'écran
 */
function isAnyModalOpen() {
  const modals = document.querySelectorAll('.fixed.z-50, .fixed.z-40');
  for (const m of modals) {
    if (!m.classList.contains('hidden')) return true;
  }
  return false;
}

/**
 * Affiche une brève notification discrète au centre du canvas lors de l'activation d'un raccourci
 */
let shortcutToastTimeout = null;
function showShortcutTriggerFeedback(actionName) {
  const toast = document.getElementById('hud-shortcut-toast');
  const toastText = document.getElementById('hud-shortcut-toast-text');
  if (!toast || !toastText) return;

  toastText.textContent = `✦ Raccourci : ${actionName} ✦`;
  toast.classList.remove('hidden');
  toast.style.opacity = '1';

  if (shortcutToastTimeout) clearTimeout(shortcutToastTimeout);
  shortcutToastTimeout = setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      toast.classList.add('hidden');
    }, 300);
  }, 1200);
}

/**
 * Actionne (ouvre / ferme) la porte la plus proche du pion joueur (ou du centre de vue)
 */
function toggleNearestDoor() {
  const myToken = typeof getMyPlayerToken === 'function' ? getMyPlayerToken() : null;
  const canvas = document.getElementById('tactical-map-canvas');
  const searchX = myToken ? myToken.x : (-mapPanX + (canvas ? canvas.width / (2 * mapZoom) : 600));
  const searchY = myToken ? myToken.y : (-mapPanY + (canvas ? canvas.height / (2 * mapZoom) : 600));

  const doors = (tacticalMapState.walls || []).filter((w) => w.type === 'door');
  if (doors.length === 0) {
    showShortcutTriggerFeedback('Aucune porte sur la carte');
    return;
  }

  let nearestDoor = null;
  let minDist = Infinity;
  for (const door of doors) {
    const dist = distToSegment(searchX, searchY, door.x1, door.y1, door.x2, door.y2);
    if (dist < minDist) {
      minDist = dist;
      nearestDoor = door;
    }
  }

  if (nearestDoor) {
    if (CURRENT_ROLE !== 'mj' && minDist > 140) {
      showShortcutTriggerFeedback('Trop éloigné de la porte (> 2m)');
      return;
    }

    socket.emit('map:toggle_door', { roomId: CURRENT_ROOM, doorId: nearestDoor.id, role: CURRENT_ROLE }, (res) => {
      if (res?.success && res.door) {
        const idx = (tacticalMapState.walls || []).findIndex((w) => w.id === res.door.id);
        if (idx !== -1) tacticalMapState.walls[idx] = res.door;
        rebuildFogCanvas();
        requestMapRender();
        showShortcutTriggerFeedback(res.door.isOpen ? 'Porte ouverte' : 'Porte fermée');
      } else if (res?.locked) {
        showShortcutTriggerFeedback('Porte verrouillée à clé !');
      }
    });
  }
}

/**
 * Valide le tour du joueur ou passe au tour suivant (MJ)
 */
function passOrAckTurn() {
  const btnAckTurn = document.getElementById('btn-ack-turn');
  const alertContainer = document.getElementById('turn-player-alert');
  if (alertContainer && !alertContainer.classList.contains('hidden') && btnAckTurn) {
    btnAckTurn.click();
    showShortcutTriggerFeedback('Tour confirmé');
    return;
  }

  const btnNext = document.getElementById('btn-next-turn');
  if (btnNext && CURRENT_ROLE === 'mj') {
    btnNext.click();
    showShortcutTriggerFeedback('Tour suivant');
  } else {
    showShortcutTriggerFeedback('En attente de votre tour');
  }
}

// Données exhaustives des raccourcis clavier pour Joueurs et MJ
const TACTICAL_SHORTCUTS = {
  player: [
    {
      category: 'Déplacement & Caméra',
      items: [
        { key: 'C / Espace', action: 'Centrer caméra sur mon héros', run: () => { const tok = getMyPlayerToken(); tok ? centerCameraOnToken(tok) : centerMapCamera(); } },
        { key: 'V', action: 'Mode Déplacer pions (Sélection)', run: () => setMapTool('select') },
        { key: 'O', action: 'Mode Caméra libre (Pan)', run: () => setMapTool('pan') },
        { key: '+ / -', action: 'Zoom Avant / Zoom Arrière', run: () => { mapZoom = Math.min(3, mapZoom * 1.2); requestMapRender(); } },
        { key: '0', action: 'Réinitialiser Zoom (100%) & Vue globale', run: () => { mapZoom = 1; centerMapCamera(); requestMapRender(); } },
      ]
    },
    {
      category: 'Actions & Interactions',
      items: [
        { key: 'T', action: 'Allumer / Éteindre ma torche (12m)', run: () => document.getElementById('btn-toggle-my-torch')?.click() },
        { key: 'E', action: 'Actionner la porte la plus proche (< 2m)', run: () => toggleNearestDoor() },
        { key: 'M', action: 'Outil Règle & Mesure de distance', run: () => setMapTool('measure') },
        { key: 'Q', action: 'Craie Tactique (Dessin libre à main levée)', run: () => setMapTool('chalk') },
        { key: 'Shift + Q', action: 'Gomme à Craie permanente', run: () => setMapTool('chalk-eraser') },
        { key: 'Alt + Clic / I', action: 'Signal d\'Attention lumineux (Ping)', run: () => setMapTool('ping') },
        { key: 'P', action: 'Valider / Confirmer mon tour de jeu', run: () => passOrAckTurn() },
      ]
    }
  ],
  mj: [
    {
      category: 'Architecture & Passages',
      items: [
        { key: 'W', action: 'Tracer un Mur de pierre (Bloque vue & pas)', run: () => setMapTool('wall') },
        { key: 'D', action: 'Poser une Porte interactive', run: () => setMapTool('door') },
        { key: 'G', action: 'Tracer un Gouffre (Bloque pas, vue libre)', run: () => setMapTool('chasm') },
        { key: 'X', action: 'Démolition Mur / Porte / Gouffre', run: () => setMapTool('wall-delete') },
        { key: 'Q', action: 'Craie Tactique (Dessin libre & Schémas)', run: () => setMapTool('chalk') },
        { key: 'Shift + Q', action: 'Gomme à Craie permanente', run: () => setMapTool('chalk-eraser') },
        { key: 'Alt + Clic / I', action: 'Signal d\'Attention lumineux (Ping)', run: () => setMapTool('ping') },
      ]
    },
    {
      category: 'Lumière, Ambiance & Brouillard',
      items: [
        { key: 'L', action: 'Déposer un Foyer lumineux / Brasero (12m)', run: () => setMapTool('light') },
        { key: 'Shift + L', action: 'Retirer un Foyer lumineux', run: () => setMapTool('light-delete') },
        { key: 'N', action: 'Basculer Plein Jour / Nuit Obscure', run: () => document.getElementById('btn-toggle-day-night')?.click() },
        { key: 'F', action: 'Révéler le Brouillard (Gommer)', run: () => setMapTool('fog-rect') },
        { key: 'H', action: 'Masquer le Brouillard (Peindre)', run: () => setMapTool('fog-circle') },
        { key: 'Shift + F', action: 'Réinitialiser tout le Brouillard', run: () => document.getElementById('btn-reset-fog')?.click() },
      ]
    },
    {
      category: 'Terrains Difficiles & Dangers',
      items: [
        { key: '1', action: 'Zone Marais (Vitesse -50%)', run: () => setMapTool('marsh') },
        { key: '2', action: 'Zone Eau Profonde (Vitesse -50%)', run: () => setMapTool('deep_water') },
        { key: '3', action: 'Zone Gravats (Vitesse -50%)', run: () => setMapTool('rubble') },
        { key: '4', action: 'Zone Toiles d\'araignée (Vitesse -50%)', run: () => setMapTool('web') },
        { key: '5', action: 'Zone Flammes (4 dégâts + Brûlé)', run: () => setMapTool('fire') },
        { key: '6', action: 'Zone Poison (3 dégâts + Empoisonné)', run: () => setMapTool('poison') },
        { key: '7', action: 'Zone Acide (5 dégâts corrosifs)', run: () => setMapTool('acid') },
        { key: '8', action: 'Dissiper une Zone d\'effet', run: () => setMapTool('zone-delete') },
      ]
    },
    {
      category: 'Pièges & Découvertes Dissimulées',
      items: [
        { key: 'Shift + 1', action: 'Poser Fosse secrète (DD 12 | 5 dégâts + À terre)', run: () => setMapTool('trap-pit') },
        { key: 'Shift + 2', action: 'Poser Mâchoires d\'acier (DD 13 | 6 dégâts + Entravé)', run: () => setMapTool('trap-bear') },
        { key: 'Shift + 3', action: 'Poser Fléchettes (DD 14 | 4 dégâts + Empoisonné)', run: () => setMapTool('trap-darts') },
        { key: 'Shift + 4', action: 'Poser Passage Secret (DD 13)', run: () => setMapTool('trap-secret') },
        { key: 'Shift + 5', action: 'Démanteler un Piège', run: () => setMapTool('trap-delete') },
        { key: 'K', action: 'Ouvrir Panneau d\'inspection des Pièges', run: () => document.getElementById('btn-open-traps-manager')?.click() },
      ]
    },
    {
      category: 'Scènes, Téléporteurs & Bestiaire',
      items: [
        { key: 'S', action: 'Ouvrir Gestionnaire de Scènes & Donjons', run: () => document.getElementById('btn-open-scene-manager')?.click() },
        { key: 'Shift + T', action: 'Poser Téléporteur / Escalier', run: () => setMapTool('teleport') },
        { key: 'Shift + X', action: 'Démanteler Téléporteur', run: () => setMapTool('teleport-delete') },
        { key: 'B', action: 'Invoquer un Monstre / PNJ', run: () => document.getElementById('btn-open-monster-modal')?.click() },
        { key: 'Shift + B', action: 'Invoquer Pion Joueur sur le plateau', run: () => document.getElementById('btn-open-player-tokens-modal')?.click() },
        { key: 'A', action: 'Panneau Altérations d\'état & Conditions', run: () => document.getElementById('btn-open-conditions-modal')?.click() },
        { key: 'Tab', action: 'Passer au Tour de combat suivant', run: () => document.getElementById('btn-next-turn')?.click() },
        { key: 'Shift + R', action: 'Nouveau Round de combat', run: () => document.getElementById('btn-new-round')?.click() },
      ]
    },
    {
      category: 'Objets & PNJ Bac à Sable',
      items: [
        { key: 'Shift + O', action: 'Poser un Objet / PNJ interactif', run: () => setMapTool('prop') },
        { key: 'Shift + P', action: 'Catalogue & Fiche d\'Objet', run: () => document.getElementById('btn-open-prop-modal')?.click() },
        { key: 'Shift + D', action: 'Supprimer un Objet interactif', run: () => setMapTool('prop-delete') },
      ]
    }
  ]
};

/**
 * Construit et actualise le contenu du volet ancré des raccourcis
 */
function renderTacticalShortcutsPanel(tab = 'player') {
  const container = document.getElementById('shortcuts-list-container');
  if (!container) return;

  const tabPlayer = document.getElementById('tab-shortcuts-player');
  const tabMj = document.getElementById('tab-shortcuts-mj');

  if (tabPlayer && tabMj) {
    if (tab === 'player') {
      tabPlayer.className = 'flex-1 py-1 px-2 text-center bg-stone-900 text-amber-300 border-b-2 border-amber-500 cursor-pointer';
      tabMj.className = 'flex-1 py-1 px-2 text-center text-stone-400 hover:text-stone-200 cursor-pointer';
    } else {
      tabPlayer.className = 'flex-1 py-1 px-2 text-center text-stone-400 hover:text-stone-200 cursor-pointer';
      tabMj.className = 'flex-1 py-1 px-2 text-center bg-stone-900 text-amber-300 border-b-2 border-amber-500 cursor-pointer';
    }
  }

  const sections = TACTICAL_SHORTCUTS[tab] || [];
  container.innerHTML = '';

  sections.forEach((sec) => {
    const secEl = document.createElement('div');
    secEl.className = 'space-y-1.5';

    const header = document.createElement('div');
    header.className = 'font-cinzel text-[10px] font-bold text-amber-400/90 uppercase tracking-wider pb-0.5 border-b border-stone-800';
    header.textContent = sec.category;
    secEl.appendChild(header);

    const list = document.createElement('div');
    list.className = 'space-y-1';

    sec.items.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-1.5 bg-stone-900/60 border border-stone-800 hover:border-amber-700/80 hover:bg-stone-800/80 transition cursor-pointer group';
      row.title = `Raccourci : ${item.key} (Cliquer pour activer)`;

      row.innerHTML = `
        <div class="flex flex-col min-w-0 pr-2">
          <span class="font-cinzel font-bold text-stone-200 text-[10px] group-hover:text-amber-300 truncate">${item.action}</span>
        </div>
        <kbd class="px-1.5 py-0.5 bg-stone-950 border border-amber-800/80 text-amber-300 font-mono text-[9px] font-bold shadow whitespace-nowrap flex-shrink-0">${item.key}</kbd>
      `;

      if (typeof item.run === 'function') {
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          item.run();
          showShortcutTriggerFeedback(item.action);
        });
      }

      list.appendChild(row);
    });

    secEl.appendChild(list);
    container.appendChild(secEl);
  });
}

/**
 * Initialise le panneau ancré des raccourcis et le gestionnaire global d'événements clavier
 */
function initTacticalShortcutsUI() {
  const panel = document.getElementById('tactical-shortcuts-panel');
  const btnToggle = document.getElementById('btn-toggle-shortcuts-panel');
  const content = document.getElementById('shortcuts-panel-content');
  const btnClose = document.getElementById('btn-close-shortcuts-panel');
  const arrow = document.getElementById('shortcuts-toggle-arrow');

  const tabPlayer = document.getElementById('tab-shortcuts-player');
  const tabMj = document.getElementById('tab-shortcuts-mj');

  let currentTab = CURRENT_ROLE === 'mj' ? 'mj' : 'player';

  const togglePanel = () => {
    if (!content) return;
    const isHidden = content.classList.contains('hidden');
    if (isHidden) {
      content.classList.remove('hidden');
      if (arrow) arrow.textContent = '▼';
      renderTacticalShortcutsPanel(currentTab);
    } else {
      content.classList.add('hidden');
      if (arrow) arrow.textContent = '◀';
    }
  };

  if (btnToggle) btnToggle.addEventListener('click', togglePanel);
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (content) content.classList.add('hidden');
      if (arrow) arrow.textContent = '◀';
    });
  }

  // Éviter que les clics dans le panneau n'interagissent avec le canvas sous-jacent
  if (panel) {
    panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
  }

  if (tabPlayer) {
    tabPlayer.addEventListener('click', () => {
      currentTab = 'player';
      renderTacticalShortcutsPanel('player');
    });
  }

  if (tabMj) {
    tabMj.addEventListener('click', () => {
      currentTab = 'mj';
      renderTacticalShortcutsPanel('mj');
    });
  }

  renderTacticalShortcutsPanel(currentTab);

  // ----------------------------------------------------------
  // GESTIONNAIRE GLOBAL DES ÉVÉNEMENTS CLAVIER (CARTE TACTIQUE)
  // ----------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    // 1. Actif STRICTEMENT sur la page Carte Tactique
    if (!isTacticalMapActive()) return;

    // 2. Ignorer toute frappe si l'utilisateur saisit du texte dans un champ ou une zone éditable
    if (isUserTyping()) return;

    // 3. Ignorer toute frappe si une modale bloquante est ouverte à l'écran
    if (isAnyModalOpen()) return;

    // 4. Ignorer les touches associées à Ctrl, Alt ou Meta pour préserver les raccourcis système
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    const key = e.key;
    const isShift = e.shiftKey;

    // --- A. Actions Joueur & Général ---
    if (key === 'c' || key === 'C' || key === ' ') {
      e.preventDefault();
      const myTok = typeof getMyPlayerToken === 'function' ? getMyPlayerToken() : null;
      if (myTok && typeof centerCameraOnToken === 'function') {
        centerCameraOnToken(myTok);
      } else {
        centerMapCamera();
      }
      showShortcutTriggerFeedback('Centrer caméra');
      return;
    }

    if (key === '0') {
      e.preventDefault();
      mapZoom = 1;
      centerMapCamera();
      requestMapRender();
      showShortcutTriggerFeedback('Zoom 100%');
      return;
    }

    if (key === '+' || key === '=') {
      e.preventDefault();
      mapZoom = Math.min(3, mapZoom * 1.2);
      requestMapRender();
      showShortcutTriggerFeedback('Zoom Avant');
      return;
    }

    if (key === '-' || key === '_') {
      e.preventDefault();
      mapZoom = Math.max(0.2, mapZoom / 1.2);
      requestMapRender();
      showShortcutTriggerFeedback('Zoom Arrière');
      return;
    }

    if ((key === 't' || key === 'T') && !isShift) {
      e.preventDefault();
      document.getElementById('btn-toggle-my-torch')?.click();
      showShortcutTriggerFeedback('Basculer Torche');
      return;
    }

    if ((key === 'e' || key === 'E') && !isShift) {
      e.preventDefault();
      toggleNearestDoor();
      return;
    }

    if ((key === 'p' || key === 'P') && !isShift) {
      e.preventDefault();
      passOrAckTurn();
      return;
    }

    if ((key === 'v' || key === 'V') && !isShift) {
      e.preventDefault();
      setMapTool('select');
      showShortcutTriggerFeedback('Mode Déplacer pions');
      return;
    }

    if ((key === 'o' || key === 'O') && !isShift) {
      e.preventDefault();
      setMapTool('pan');
      showShortcutTriggerFeedback('Mode Caméra libre');
      return;
    }

    if ((key === 'm' || key === 'M') && !isShift) {
      e.preventDefault();
      setMapTool('measure');
      showShortcutTriggerFeedback('Outil Mesure');
      return;
    }

    if ((key === 'q' || key === 'Q') && !isShift) {
      e.preventDefault();
      setMapTool('chalk');
      showShortcutTriggerFeedback('Craie Tactique');
      return;
    }

    if ((key === 'q' || key === 'Q') && isShift) {
      e.preventDefault();
      setMapTool('chalk-eraser');
      showShortcutTriggerFeedback('Gomme à Craie');
      return;
    }

    if ((key === 'i' || key === 'I') && !isShift) {
      e.preventDefault();
      setMapTool('ping');
      showShortcutTriggerFeedback('Signal Ping');
      return;
    }

    // --- B. Actions Maître du Jeu uniquement ---
    if (CURRENT_ROLE !== 'mj') return;

    if ((key === 'w' || key === 'W') && !isShift) {
      e.preventDefault();
      setMapTool('wall');
      showShortcutTriggerFeedback('Outil Mur');
      return;
    }

    if ((key === 'd' || key === 'D') && !isShift) {
      e.preventDefault();
      setMapTool('door');
      showShortcutTriggerFeedback('Outil Porte');
      return;
    }

    if ((key === 'g' || key === 'G') && !isShift) {
      e.preventDefault();
      setMapTool('chasm');
      showShortcutTriggerFeedback('Outil Gouffre');
      return;
    }

    if ((key === 'x' || key === 'X') && !isShift) {
      e.preventDefault();
      setMapTool('wall-delete');
      showShortcutTriggerFeedback('Démolition Mur/Porte/Gouffre');
      return;
    }

    if ((key === 'l' || key === 'L') && !isShift) {
      e.preventDefault();
      setMapTool('light');
      showShortcutTriggerFeedback('Outil Brasero');
      return;
    }

    if ((key === 'l' || key === 'L') && isShift) {
      e.preventDefault();
      setMapTool('light-delete');
      showShortcutTriggerFeedback('Retirer Brasero');
      return;
    }

    if ((key === 'n' || key === 'N') && !isShift) {
      e.preventDefault();
      document.getElementById('btn-toggle-day-night')?.click();
      showShortcutTriggerFeedback('Basculer Jour / Nuit');
      return;
    }

    if ((key === 'f' || key === 'F') && !isShift) {
      e.preventDefault();
      setMapTool('fog-rect');
      showShortcutTriggerFeedback('Révéler Brouillard');
      return;
    }

    if ((key === 'h' || key === 'H') && !isShift) {
      e.preventDefault();
      setMapTool('fog-circle');
      showShortcutTriggerFeedback('Masquer Brouillard');
      return;
    }

    if ((key === 'f' || key === 'F') && isShift) {
      e.preventDefault();
      document.getElementById('btn-reset-fog')?.click();
      showShortcutTriggerFeedback('Reset Brouillard');
      return;
    }

    // Terrains & Dangers (touches 1 à 8 sans Shift)
    if (!isShift) {
      if (key === '1') { e.preventDefault(); setMapTool('marsh'); showShortcutTriggerFeedback('Zone Marais'); return; }
      if (key === '2') { e.preventDefault(); setMapTool('deep_water'); showShortcutTriggerFeedback('Zone Eau Profonde'); return; }
      if (key === '3') { e.preventDefault(); setMapTool('rubble'); showShortcutTriggerFeedback('Zone Gravats'); return; }
      if (key === '4') { e.preventDefault(); setMapTool('web'); showShortcutTriggerFeedback('Zone Toiles'); return; }
      if (key === '5') { e.preventDefault(); setMapTool('fire'); showShortcutTriggerFeedback('Zone Flammes'); return; }
      if (key === '6') { e.preventDefault(); setMapTool('poison'); showShortcutTriggerFeedback('Zone Poison'); return; }
      if (key === '7') { e.preventDefault(); setMapTool('acid'); showShortcutTriggerFeedback('Zone Acide'); return; }
      if (key === '8') { e.preventDefault(); setMapTool('zone-delete'); showShortcutTriggerFeedback('Dissiper Zone'); return; }
    }

    // Pièges & Mécanismes (Shift + 1 à 5, compatible claviers AZERTY & QWERTY)
    if (isShift) {
      if (key === '1' || key === '&') { e.preventDefault(); setMapTool('trap-pit'); showShortcutTriggerFeedback('Poser Fosse'); return; }
      if (key === '2' || key === 'é') { e.preventDefault(); setMapTool('trap-bear'); showShortcutTriggerFeedback('Poser Mâchoires'); return; }
      if (key === '3' || key === '"') { e.preventDefault(); setMapTool('trap-darts'); showShortcutTriggerFeedback('Poser Fléchettes'); return; }
      if (key === '4' || key === "'") { e.preventDefault(); setMapTool('trap-secret'); showShortcutTriggerFeedback('Poser Passage Secret'); return; }
      if (key === '5' || key === '(') { e.preventDefault(); setMapTool('trap-delete'); showShortcutTriggerFeedback('Démanteler Piège'); return; }
    }

    if ((key === 'k' || key === 'K') && !isShift) {
      e.preventDefault();
      document.getElementById('btn-open-traps-manager')?.click();
      showShortcutTriggerFeedback('Panneau des Pièges');
      return;
    }

    if ((key === 's' || key === 'S') && !isShift) {
      e.preventDefault();
      document.getElementById('btn-open-scene-manager')?.click();
      showShortcutTriggerFeedback('Gestionnaire de Scènes');
      return;
    }

    if ((key === 't' || key === 'T') && isShift) {
      e.preventDefault();
      setMapTool('teleport');
      showShortcutTriggerFeedback('Poser Téléporteur');
      return;
    }

    if ((key === 'x' || key === 'X') && isShift) {
      e.preventDefault();
      setMapTool('teleport-delete');
      showShortcutTriggerFeedback('Démanteler Téléporteur');
      return;
    }

    if ((key === 'b' || key === 'B') && !isShift) {
      e.preventDefault();
      document.getElementById('btn-open-monster-modal')?.click();
      showShortcutTriggerFeedback('Invoquer Monstre');
      return;
    }

    if ((key === 'b' || key === 'B') && isShift) {
      e.preventDefault();
      document.getElementById('btn-open-player-tokens-modal')?.click();
      showShortcutTriggerFeedback('Invoquer Pion Joueur');
      return;
    }

    if ((key === 'a' || key === 'A') && !isShift) {
      e.preventDefault();
      document.getElementById('btn-open-conditions-modal')?.click();
      showShortcutTriggerFeedback('Panneau Conditions');
      return;
    }

    if ((key === 'o' || key === 'O') && isShift) {
      e.preventDefault();
      setMapTool('prop');
      showShortcutTriggerFeedback('Poser Objet / PNJ');
      return;
    }

    if ((key === 'p' || key === 'P') && isShift) {
      e.preventDefault();
      document.getElementById('btn-open-prop-modal')?.click();
      showShortcutTriggerFeedback('Catalogue des Objets');
      return;
    }

    if ((key === 'd' || key === 'D') && isShift) {
      e.preventDefault();
      setMapTool('prop-delete');
      showShortcutTriggerFeedback('Supprimer Objet');
      return;
    }

    if (key === 'Tab') {
      e.preventDefault();
      document.getElementById('btn-next-turn')?.click();
      showShortcutTriggerFeedback('Tour Suivant');
      return;
    }

    if ((key === 'r' || key === 'R') && isShift) {
      e.preventDefault();
      document.getElementById('btn-new-round')?.click();
      showShortcutTriggerFeedback('Nouveau Round');
      return;
    }
  });
}

// ------------------------------------------------------------
// CARNET D'ENQUÊTE & MUR DE DÉTECTIVE COLLABORATIF (FEATURE)
// ------------------------------------------------------------

let investigationState = {
  clues: [],
  links: []
};

let invPanX = 0;
let invPanY = 0;
let invIsPanning = false;
let invPanStartX = 0;
let invPanStartY = 0;

let invLinkModeActive = false;
let invLinkPendingFromId = null;
let invActiveDetailClueId = null;
let invNewClueSelectedImageFile = null;

let invLinkModalFromId = null;
let invLinkModalToId = null;

/**
 * Rafraîchit les données du tableau d'enquête auprès du serveur
 */
function refreshInvestigationBoardUI() {
  if (!CURRENT_ROOM) return;
  socket.emit('investigation:get', { roomId: CURRENT_ROOM }, (res) => {
    if (res?.success && res.investigation) {
      investigationState.clues = Array.isArray(res.investigation.clues) ? res.investigation.clues : [];
      investigationState.links = Array.isArray(res.investigation.links) ? res.investigation.links : [];
      renderInvestigationBoard();
    }
  });
}

/**
 * Met à jour la position transformée du tableau
 */
function updateInvestigationBoardTransform() {
  const viewport = document.getElementById('investigation-board-viewport');
  if (viewport) {
    viewport.style.transform = `translate(${invPanX}px, ${invPanY}px)`;
  }
}

/**
 * Dessine toutes les ficelles rouges reliant les indices sur le calque SVG
 */
function renderInvestigationStrings() {
  const group = document.getElementById('inv-strings-group');
  if (!group) return;

  group.innerHTML = '';
  const filterType = document.getElementById('inv-filter-type')?.value || 'all';

  const visibleClueIds = new Set(
    (investigationState.clues || [])
      .filter((c) => filterType === 'all' || c.type === filterType)
      .map((c) => c.id)
  );

  (investigationState.links || []).forEach((link) => {
    if (!visibleClueIds.has(link.fromId) || !visibleClueIds.has(link.toId)) return;

    const el1 = document.getElementById(`inv-card-${link.fromId}`);
    const el2 = document.getElementById(`inv-card-${link.toId}`);
    if (!el1 || !el2) return;

    // Calcul des coordonnées d'attache au niveau de l'épingle supérieure
    const w1 = el1.offsetWidth || 190;
    const w2 = el2.offsetWidth || 190;

    const x1 = (parseFloat(el1.style.left) || 0) + w1 / 2;
    const y1 = (parseFloat(el1.style.top) || 0) + 12;

    const x2 = (parseFloat(el2.style.left) || 0) + w2 / 2;
    const y2 = (parseFloat(el2.style.top) || 0) + 12;

    // Courbe naturelle de suspension (fléchissement réaliste du fil tendu)
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const sag = Math.min(50, Math.max(15, dist * 0.12));
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2 + sag;

    // Path SVG de la ficelle
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    path.setAttribute('stroke', link.color || '#ef4444');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('filter', 'url(#string-shadow)');
    group.appendChild(path);

    // Pastilles d'attache aux deux bouts
    const dot1 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot1.setAttribute('cx', x1);
    dot1.setAttribute('cy', y1);
    dot1.setAttribute('r', '3');
    dot1.setAttribute('fill', '#f59e0b');
    group.appendChild(dot1);

    const dot2 = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot2.setAttribute('cx', x2);
    dot2.setAttribute('cy', y2);
    dot2.setAttribute('r', '3');
    dot2.setAttribute('fill', '#f59e0b');
    group.appendChild(dot2);

    // Étiquette au milieu de la ficelle
    const labelX = cx;
    const labelY = cy - 6;

    const gLabel = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gLabel.setAttribute('transform', `translate(${labelX}, ${labelY})`);
    gLabel.style.cursor = 'pointer';
    gLabel.setAttribute('class', 'pointer-events-auto');

    const labelText = link.label ? link.label : 'Lien';
    const textWidth = Math.max(50, labelText.length * 7 + 22);

    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', -textWidth / 2);
    bgRect.setAttribute('y', -10);
    bgRect.setAttribute('width', textWidth);
    bgRect.setAttribute('height', 18);
    bgRect.setAttribute('rx', '3');
    bgRect.setAttribute('fill', '#0c0a09');
    bgRect.setAttribute('stroke', link.color || '#ef4444');
    bgRect.setAttribute('stroke-width', '1');
    gLabel.appendChild(bgRect);

    const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    txt.setAttribute('x', -textWidth / 2 + 6);
    txt.setAttribute('y', 3);
    txt.setAttribute('fill', '#fef08a');
    txt.setAttribute('font-size', '10');
    txt.setAttribute('font-family', 'Cinzel, Georgia, serif');
    txt.setAttribute('font-weight', 'bold');
    txt.textContent = labelText.length > 18 ? labelText.substring(0, 16) + '...' : labelText;
    gLabel.appendChild(txt);

    // Bouton de coupure [✕] au bout de l'étiquette
    const cutTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    cutTxt.setAttribute('x', textWidth / 2 - 12);
    cutTxt.setAttribute('y', 3);
    cutTxt.setAttribute('fill', '#f87171');
    cutTxt.setAttribute('font-size', '10');
    cutTxt.setAttribute('font-weight', 'bold');
    cutTxt.textContent = '✕';
    gLabel.appendChild(cutTxt);

    gLabel.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Couper cette ficelle reliant ces deux indices ?`)) {
        socket.emit('investigation:delete_link', { roomId: CURRENT_ROOM, linkId: link.id });
      }
    });

    group.appendChild(gLabel);
  });
}

/**
 * Rendu visuel complet du tableau de détective
 */
function renderInvestigationBoard() {
  const cardsLayer = document.getElementById('investigation-cards-layer');
  if (!cardsLayer) return;

  const countClues = document.getElementById('inv-clues-count');
  const countLinks = document.getElementById('inv-links-count');
  const btnClear = document.getElementById('btn-inv-clear-board');
  const filterType = document.getElementById('inv-filter-type')?.value || 'all';

  const clues = investigationState.clues || [];
  const links = investigationState.links || [];

  if (countClues) countClues.textContent = `${clues.length} indice${clues.length > 1 ? 's' : ''}`;
  if (countLinks) countLinks.textContent = `${links.length} ficelle${links.length > 1 ? 's' : ''}`;

  if (btnClear) {
    if (CURRENT_ROLE === 'mj' && clues.length > 0) {
      btnClear.classList.remove('hidden');
    } else {
      btnClear.classList.add('hidden');
    }
  }

  cardsLayer.innerHTML = '';

  const filteredClues = clues.filter((c) => filterType === 'all' || c.type === filterType);

  filteredClues.forEach((clue) => {
    const card = document.createElement('div');
    card.id = `inv-card-${clue.id}`;
    card.setAttribute('data-clue-id', clue.id);

    const isPending = invLinkPendingFromId === clue.id;
    const isSealed = clue.type === 'sealed' && clue.isSealed;

    const baseBg = clue.color || '#fef3c7';

    card.className = `absolute w-48 sm:w-52 p-3 shadow-2xl border-2 transition-transform cursor-pointer select-none group ${
      isPending ? 'border-rose-500 ring-4 ring-rose-500/50 scale-105 z-20' : 'border-stone-800 hover:border-amber-600 z-10'
    }`;
    card.style.left = `${clue.x}px`;
    card.style.top = `${clue.y}px`;
    card.style.backgroundColor = baseBg;
    card.style.color = '#1c1917';

    // Type label & badge
    let typeBadgeText = '[NOTE]';
    let typeBadgeColor = 'bg-amber-950 text-amber-300';
    if (clue.type === 'npc') {
      const statusMap = {
        neutral: 'Neutre',
        suspect: 'Suspect',
        ally: 'Allié',
        enemy: 'Ennemi',
        witness: 'Témoin',
        missing: 'Disparu',
        evidence: 'Preuve'
      };
      typeBadgeText = `[PNJ • ${statusMap[clue.status] || 'PNJ'}]`;
      typeBadgeColor = clue.status === 'suspect' ? 'bg-rose-950 text-rose-300' : (clue.status === 'ally' ? 'bg-emerald-950 text-emerald-300' : 'bg-stone-900 text-stone-300');
    } else if (clue.type === 'document') {
      typeBadgeText = '[PARCHEMIN]';
      typeBadgeColor = 'bg-stone-900 text-amber-200';
    } else if (clue.type === 'sealed') {
      typeBadgeText = isSealed ? '[SCELLÉ]' : '[DÉCACHETÉ]';
      typeBadgeColor = isSealed ? 'bg-red-950 text-red-200 font-bold' : 'bg-stone-900 text-stone-300';
    }

    const deductionsCount = Array.isArray(clue.deductions) ? clue.deductions.length : 0;

    let bodyContentHtml = '';
    if (isSealed) {
      bodyContentHtml = `
        <div class="my-2 p-3 bg-red-950/20 border border-red-800 text-center">
          <div class="text-xl font-mono text-red-700 font-bold leading-tight">[✦]</div>
          <div class="font-cinzel text-[10px] font-bold text-red-900 uppercase">Cachet de Cire Intact</div>
          <div class="font-crimson italic text-[9px] text-red-950/80 mt-0.5">Contenu secret scellé</div>
        </div>
      `;
    } else {
      const imgHtml = clue.image
        ? `<img src="${clue.image}" alt="Aperçu" class="w-full h-24 object-cover border border-amber-950/40 my-1 bg-black/40" />`
        : '';
      const textPreview = clue.content
        ? `<p class="font-crimson text-stone-900 text-xs italic line-clamp-3 leading-snug">${clue.content}</p>`
        : '<p class="font-crimson text-stone-500 text-xs italic">(Aucune note écrite)</p>';

      bodyContentHtml = `
        ${imgHtml}
        <div class="my-1">${textPreview}</div>
      `;
    }

    card.innerHTML = `
      <!-- Épingle d'accroche supérieure dorée -->
      <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 via-red-600 to-stone-950 border border-amber-300 shadow flex items-center justify-center text-[7px] text-white font-mono font-bold pointer-events-none">
        •
      </div>

      <!-- En-tête de carte -->
      <div class="flex items-start justify-between gap-1 mb-1 border-b border-stone-800/20 pb-1">
        <span class="px-1.5 py-0.2 text-[9px] font-cinzel font-bold border border-black/20 ${typeBadgeColor}">
          ${typeBadgeText}
        </span>
        <button type="button" data-inv-action="delete" class="text-stone-700 hover:text-red-700 text-xs font-bold px-1" title="Détacher cet indice">[✕]</button>
      </div>

      <!-- Titre de l'indice -->
      <h4 class="font-cinzel text-xs font-bold text-stone-950 leading-tight truncate" title="${clue.title}">
        ${clue.title}
      </h4>

      <!-- Contenu -->
      ${bodyContentHtml}

      <!-- Pied de carte -->
      <div class="flex items-center justify-between mt-2 pt-1.5 border-t border-stone-800/20 text-[10px] font-cinzel">
        <span class="text-stone-600 font-crimson italic truncate max-w-[90px]">${clue.author}</span>
        <div class="flex items-center gap-1">
          ${deductionsCount > 0 ? `<span class="px-1 py-0.2 bg-stone-900/10 text-stone-800 font-mono font-bold text-[9px]" title="${deductionsCount} déduction(s)">[? ${deductionsCount}]</span>` : ''}
          <button type="button" data-inv-action="link" class="px-1.5 py-0.5 bg-rose-950 text-rose-200 hover:bg-rose-900 border border-rose-800 text-[9px] font-bold" title="Tendre une ficelle depuis cet indice">[~]</button>
          <button type="button" data-inv-action="inspect" class="px-1.5 py-0.5 bg-stone-900 text-amber-200 hover:bg-stone-800 border border-stone-700 text-[9px] font-bold" title="Ouvrir le dossier complet">[✎]</button>
        </div>
      </div>
    `;

    // Gestion du clic pour mode ficelle ou inspection
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-inv-action]')) return;

      if (invLinkModeActive) {
        handleClueLinkClick(clue.id);
      } else {
        openClueDetailModal(clue.id);
      }
    });

    const btnInspect = card.querySelector('[data-inv-action="inspect"]');
    if (btnInspect) {
      btnInspect.addEventListener('click', (e) => {
        e.stopPropagation();
        openClueDetailModal(clue.id);
      });
    }

    const btnLink = card.querySelector('[data-inv-action="link"]');
    if (btnLink) {
      btnLink.addEventListener('click', (e) => {
        e.stopPropagation();
        handleClueLinkClick(clue.id);
      });
    }

    const btnDelete = card.querySelector('[data-inv-action="delete"]');
    if (btnDelete) {
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Détacher l'indice "${clue.title}" du mur d'enquête ?`)) {
          socket.emit('investigation:delete_clue', { roomId: CURRENT_ROOM, clueId: clue.id });
        }
      });
    }

    // Déplacement de la carte (Drag-and-Drop)
    card.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') || invLinkModeActive) return;
      e.stopPropagation();

      invDraggedClueId = clue.id;
      const startCardX = clue.x;
      const startCardY = clue.y;
      const startPointerX = e.clientX;
      const startPointerY = e.clientY;

      card.classList.add('scale-105', 'shadow-2xl', 'z-30');
      card.style.cursor = 'grabbing';

      const onPointerMove = (moveEvt) => {
        const dx = moveEvt.clientX - startPointerX;
        const dy = moveEvt.clientY - startPointerY;

        const newX = Math.max(20, Math.min(5500, startCardX + dx));
        const newY = Math.max(20, Math.min(5500, startCardY + dy));

        clue.x = newX;
        clue.y = newY;
        card.style.left = `${newX}px`;
        card.style.top = `${newY}px`;

        // Mise à jour immédiate des ficelles connectées pendant le glisser
        renderInvestigationStrings();
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);

        card.classList.remove('scale-105', 'shadow-2xl', 'z-30');
        card.style.cursor = 'pointer';
        invDraggedClueId = null;

        // Émission du nouvel emplacement
        socket.emit('investigation:move_clue', {
          roomId: CURRENT_ROOM,
          clueId: clue.id,
          x: clue.x,
          y: clue.y
        });
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    cardsLayer.appendChild(card);
  });

  // Tracer l'ensemble des ficelles
  renderInvestigationStrings();
}

/**
 * Gestion du clic sur un indice en mode de création de lien
 */
function handleClueLinkClick(clueId) {
  if (!invLinkModeActive) {
    invLinkModeActive = true;
    invLinkPendingFromId = clueId;
    updateLinkModeNotice();
    renderInvestigationBoard();
    return;
  }

  if (!invLinkPendingFromId) {
    invLinkPendingFromId = clueId;
    updateLinkModeNotice();
    renderInvestigationBoard();
    return;
  }

  if (invLinkPendingFromId === clueId) {
    // Annulation si on clique sur la même carte
    invLinkPendingFromId = null;
    updateLinkModeNotice();
    renderInvestigationBoard();
    return;
  }

  // Ouvrir la modale de confirmation du lien
  openAddLinkModal(invLinkPendingFromId, clueId);
  invLinkPendingFromId = null;
  invLinkModeActive = false;
  updateLinkModeNotice();
  renderInvestigationBoard();
}

/**
 * Met à jour le bandeau d'alerte lors du mode ficelle rouge
 */
function updateLinkModeNotice() {
  const notice = document.getElementById('inv-link-mode-notice');
  const btn = document.getElementById('btn-inv-toggle-link-mode');
  const btnText = document.getElementById('inv-link-mode-text');

  if (invLinkModeActive) {
    if (notice) {
      notice.classList.remove('hidden');
      notice.textContent = invLinkPendingFromId
        ? '✦ Mode Ficelle : Cliquez maintenant sur le second indice à relier ✦'
        : '✦ Mode Ficelle Rouge : Cliquez sur le premier indice puis sur le second pour les relier ✦';
    }
    if (btn) btn.classList.add('bg-rose-950', 'border-rose-500', 'text-rose-200');
    if (btnText) btnText.textContent = 'Mode Ficelle Actif';
  } else {
    if (notice) notice.classList.add('hidden');
    if (btn) btn.classList.remove('bg-rose-950', 'border-rose-500', 'text-rose-200');
    if (btnText) btnText.textContent = 'Tendre Ficelle';
  }
}

/**
 * Ouvre la modale de création d'un lien ficelle entre deux indices
 */
function openAddLinkModal(fromId, toId) {
  const modal = document.getElementById('modal-add-link');
  if (!modal) return;

  invLinkModalFromId = fromId;
  invLinkModalToId = toId;

  const c1 = (investigationState.clues || []).find((c) => c.id === fromId);
  const c2 = (investigationState.clues || []).find((c) => c.id === toId);

  const fromLabel = document.getElementById('link-from-title');
  const toLabel = document.getElementById('link-to-title');
  const inputLabel = document.getElementById('inv-link-label-input');

  if (fromLabel) fromLabel.textContent = c1 ? c1.title : 'Indice A';
  if (toLabel) toLabel.textContent = c2 ? c2.title : 'Indice B';
  if (inputLabel) inputLabel.value = '';

  modal.classList.remove('hidden');
}

/**
 * Ouvre la modale de détails et déductions collectives d'un indice
 */
function openClueDetailModal(clueId) {
  const modal = document.getElementById('modal-clue-detail');
  if (!modal) return;

  const clue = (investigationState.clues || []).find((c) => c.id === clueId);
  if (!clue) return;

  invActiveDetailClueId = clueId;

  const titleEl = document.getElementById('detail-clue-title');
  const metaEl = document.getElementById('detail-clue-meta');
  const typeBadge = document.getElementById('detail-clue-type-badge');

  const sealedBox = document.getElementById('detail-clue-sealed-box');
  const contentBox = document.getElementById('detail-clue-content-box');
  const contentP = document.getElementById('detail-clue-content');

  const imgContainer = document.getElementById('detail-clue-image-container');
  const imgEl = document.getElementById('detail-clue-image');

  const npcBar = document.getElementById('detail-clue-npc-bar');
  const npcBadge = document.getElementById('detail-clue-status-badge');
  const npcRole = document.getElementById('detail-clue-npc-role');

  if (titleEl) titleEl.textContent = clue.title;
  if (metaEl) {
    const timeStr = clue.createdAt ? new Date(clue.createdAt).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
    metaEl.textContent = `Épinglé par ${clue.author || 'Aventurier'} (${clue.authorRole === 'mj' ? 'MJ' : 'Joueur'}) • ${timeStr}`;
  }

  const isSealed = clue.type === 'sealed' && clue.isSealed;

  if (typeBadge) {
    typeBadge.textContent = isSealed ? '[LETTRE SCELLÉE]' : `[${clue.type.toUpperCase()}]`;
  }

  if (isSealed) {
    if (sealedBox) sealedBox.classList.remove('hidden');
    if (contentBox) contentBox.classList.add('hidden');
  } else {
    if (sealedBox) sealedBox.classList.add('hidden');
    if (contentBox) contentBox.classList.remove('hidden');
    if (contentP) contentP.textContent = clue.content || '(Aucune note écrite)';

    if (clue.image && imgContainer && imgEl) {
      imgEl.src = clue.image;
      imgContainer.classList.remove('hidden');
    } else if (imgContainer) {
      imgContainer.classList.add('hidden');
    }

    if (clue.type === 'npc' && npcBar) {
      npcBar.classList.remove('hidden');
      if (npcBadge) {
        npcBadge.textContent = clue.status?.toUpperCase() || 'NEUTRE';
        npcBadge.className = `px-2 py-0.5 font-cinzel text-[10px] font-bold border ${
          clue.status === 'suspect' ? 'bg-rose-950 border-rose-600 text-rose-300' :
          (clue.status === 'ally' ? 'bg-emerald-950 border-emerald-600 text-emerald-300' : 'bg-stone-900 border-stone-700 text-stone-300')
        }`;
      }
      if (npcRole) npcRole.textContent = clue.role || '';
    } else if (npcBar) {
      npcBar.classList.add('hidden');
    }
  }

  // Rendu de la liste des déductions de l'équipe
  renderDeductionsList(clue);

  modal.classList.remove('hidden');
}

/**
 * Affiche la liste des déductions d'équipe dans la modale d'inspection
 */
function renderDeductionsList(clue) {
  const list = document.getElementById('detail-deductions-list');
  const countEl = document.getElementById('detail-deductions-count');
  if (!list) return;

  const deductions = Array.isArray(clue.deductions) ? clue.deductions : [];
  if (countEl) countEl.textContent = `${deductions.length} déduction${deductions.length > 1 ? 's' : ''}`;

  if (deductions.length === 0) {
    list.innerHTML = `
      <div class="py-3 text-center text-stone-500 font-crimson italic text-xs">
        Aucune déduction enregistrée. Proposez la première théorie ci-dessous !
      </div>
    `;
    return;
  }

  list.innerHTML = '';
  deductions.forEach((d) => {
    const row = document.createElement('div');
    row.className = 'p-2 bg-stone-950/80 border border-amber-950/60 text-xs font-crimson space-y-0.5';

    const timeStr = d.createdAt ? new Date(d.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';

    row.innerHTML = `
      <div class="flex items-center justify-between text-[10px] font-cinzel text-amber-400 font-bold">
        <span>${d.author || 'Aventurier'} <span class="text-stone-500 font-normal">(${d.authorRole === 'mj' ? 'MJ' : 'Joueur'})</span></span>
        <span class="text-stone-500 font-mono text-[9px]">${timeStr}</span>
      </div>
      <p class="text-stone-200 italic leading-snug">${d.text}</p>
    `;
    list.appendChild(row);
  });
}

/**
 * Initialise l'ensemble des interactions du carnet d'enquête
 */
function initInvestigationUI() {
  const container = document.getElementById('investigation-board-container');
  const btnAddClue = document.getElementById('btn-inv-add-clue');
  const btnToggleLinkMode = document.getElementById('btn-inv-toggle-link-mode');
  const btnResetPan = document.getElementById('btn-inv-reset-pan');
  const btnClearBoard = document.getElementById('btn-inv-clear-board');
  const filterSelect = document.getElementById('inv-filter-type');

  // Modale Ajout d'indice
  const modalAddClue = document.getElementById('modal-add-clue');
  const btnCloseAddClue = document.getElementById('btn-close-modal-add-clue');
  const btnCancelAddClue = document.getElementById('btn-cancel-modal-add-clue');
  const btnSubmitAddClue = document.getElementById('btn-submit-add-clue');

  const btnTriggerImage = document.getElementById('btn-trigger-inv-image');
  const fileInputImage = document.getElementById('inv-clue-image-input');
  const labelImage = document.getElementById('inv-clue-image-label');
  const btnClearImage = document.getElementById('btn-clear-inv-image');
  const previewImgContainer = document.getElementById('inv-image-preview-container');
  const previewImg = document.getElementById('inv-image-preview');
  const previewImgName = document.getElementById('inv-image-name');

  // Modale Détail indice
  const modalClueDetail = document.getElementById('modal-clue-detail');
  const btnCloseClueDetail = document.getElementById('btn-close-modal-clue-detail');
  const btnCancelClueDetail = document.getElementById('btn-cancel-modal-clue-detail');
  const btnUnsealClue = document.getElementById('btn-inv-unseal-clue');
  const btnDeleteClue = document.getElementById('btn-inv-delete-clue');
  const btnLinkFromDetail = document.getElementById('btn-inv-link-from-detail');
  const btnSubmitDeduction = document.getElementById('btn-submit-deduction');
  const inputNewDeduction = document.getElementById('input-new-deduction');

  // Modale Lien
  const modalAddLink = document.getElementById('modal-add-link');
  const btnCloseAddLink = document.getElementById('btn-close-modal-add-link');
  const btnCancelAddLink = document.getElementById('btn-cancel-modal-add-link');
  const btnConfirmAddLink = document.getElementById('btn-confirm-add-link');

  // Navigation / Pan sur le tableau
  if (container) {
    container.addEventListener('pointerdown', (e) => {
      if (e.target.closest('#investigation-cards-layer') || e.target.closest('button')) return;
      invIsPanning = true;
      invPanStartX = e.clientX - invPanX;
      invPanStartY = e.clientY - invPanY;
      container.style.cursor = 'grabbing';
    });

    window.addEventListener('pointermove', (e) => {
      if (!invIsPanning) return;
      invPanX = e.clientX - invPanStartX;
      invPanY = e.clientY - invPanStartY;
      updateInvestigationBoardTransform();
    });

    window.addEventListener('pointerup', () => {
      if (invIsPanning) {
        invIsPanning = false;
        if (container) container.style.cursor = 'grab';
      }
    });
  }

  // Bouton de recentrage
  if (btnResetPan) {
    btnResetPan.addEventListener('click', () => {
      invPanX = 0;
      invPanY = 0;
      updateInvestigationBoardTransform();
    });
  }

  // Filtrage des indices
  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      renderInvestigationBoard();
    });
  }

  // Bascule du mode ficelle rouge
  if (btnToggleLinkMode) {
    btnToggleLinkMode.addEventListener('click', () => {
      invLinkModeActive = !invLinkModeActive;
      invLinkPendingFromId = null;
      updateLinkModeNotice();
      renderInvestigationBoard();
    });
  }

  // Vider le tableau (MJ)
  if (btnClearBoard) {
    btnClearBoard.addEventListener('click', () => {
      if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj') return;
      if (confirm('Voulez-vous supprimer définitivement tous les indices et ficelles du tableau ?')) {
        socket.emit('investigation:clear_all', { roomId: CURRENT_ROOM, role: CURRENT_ROLE });
      }
    });
  }

  // --- Gestion de la modale d'ajout d'indice ---
  if (btnAddClue) {
    btnAddClue.addEventListener('click', () => {
      if (modalAddClue) {
        modalAddClue.classList.remove('hidden');
        const titleInput = document.getElementById('new-clue-title-input');
        if (titleInput) {
          titleInput.value = '';
          titleInput.focus();
        }
        const contentInput = document.getElementById('new-clue-content-input');
        if (contentInput) contentInput.value = '';
        invNewClueSelectedImageFile = null;
        if (fileInputImage) fileInputImage.value = '';
        if (labelImage) labelImage.textContent = 'Aucune image jointe';
        if (btnClearImage) btnClearImage.classList.add('hidden');
        if (previewImgContainer) previewImgContainer.classList.add('hidden');
      }
    });
  }

  const closeAddClue = () => {
    if (modalAddClue) modalAddClue.classList.add('hidden');
  };
  if (btnCloseAddClue) btnCloseAddClue.addEventListener('click', closeAddClue);
  if (btnCancelAddClue) btnCancelAddClue.addEventListener('click', closeAddClue);

  // Sélecteur de type d'indice (Note, PNJ, Document, Scellé)
  document.querySelectorAll('.btn-clue-type-select').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-clue-type');
      const valInput = document.getElementById('new-clue-type-val');
      if (valInput) valInput.value = type;

      document.querySelectorAll('.btn-clue-type-select').forEach((b) => {
        if (b === btn) {
          b.className = 'btn-clue-type-select p-2 bg-stone-900 border border-amber-600 text-amber-300 font-cinzel text-[10px] font-bold text-center cursor-pointer transition';
        } else {
          b.className = 'btn-clue-type-select p-2 bg-stone-950 border border-stone-800 text-stone-400 font-cinzel text-[10px] font-bold text-center cursor-pointer transition hover:text-stone-200';
        }
      });

      const npcOptions = document.getElementById('new-clue-npc-options');
      const contentLabel = document.getElementById('new-clue-content-label');

      if (type === 'npc') {
        if (npcOptions) npcOptions.classList.remove('hidden');
        if (contentLabel) contentLabel.textContent = 'Notes biographiques & secrets connus sur le PNJ';
      } else if (type === 'sealed') {
        if (npcOptions) npcOptions.classList.add('hidden');
        if (contentLabel) contentLabel.textContent = 'Contenu secret protégé par le cachet de cire';
      } else {
        if (npcOptions) npcOptions.classList.add('hidden');
        if (contentLabel) contentLabel.textContent = 'Contenu de la note / Texte du parchemin';
      }
    });
  });

  // Sélection image locale PC pour l'indice
  if (btnTriggerImage && fileInputImage) {
    btnTriggerImage.addEventListener('click', () => fileInputImage.click());
  }

  if (fileInputImage) {
    fileInputImage.addEventListener('change', () => {
      const file = fileInputImage.files?.[0];
      if (!file) return;

      invNewClueSelectedImageFile = file;
      if (labelImage) labelImage.textContent = file.name;
      if (btnClearImage) btnClearImage.classList.remove('hidden');

      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
        if (previewImgName) previewImgName.textContent = file.name;
        if (previewImgContainer) previewImgContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnClearImage) {
    btnClearImage.addEventListener('click', () => {
      invNewClueSelectedImageFile = null;
      if (fileInputImage) fileInputImage.value = '';
      if (labelImage) labelImage.textContent = 'Aucune image jointe';
      btnClearImage.classList.add('hidden');
      if (previewImgContainer) previewImgContainer.classList.add('hidden');
    });
  }

  // Soumission de la création d'indice
  if (btnSubmitAddClue) {
    btnSubmitAddClue.addEventListener('click', async () => {
      if (!CURRENT_ROOM) return;

      const titleInput = document.getElementById('new-clue-title-input');
      const contentInput = document.getElementById('new-clue-content-input');
      const typeVal = document.getElementById('new-clue-type-val')?.value || 'clue';
      const statusSelect = document.getElementById('new-clue-status-select');
      const roleInput = document.getElementById('new-clue-role-input');
      const colorRadio = document.querySelector('input[name="clue-color"]:checked');

      const title = titleInput?.value.trim();
      if (!title) {
        alert('Veuillez entrer un titre pour cet indice.');
        return;
      }

      const content = contentInput?.value.trim() || '';
      const color = colorRadio?.value || '#fef3c7';
      const status = statusSelect?.value || 'neutral';
      const role = roleInput?.value.trim() || '';

      let image = null;

      if (invNewClueSelectedImageFile) {
        const originalText = btnSubmitAddClue.innerHTML;
        btnSubmitAddClue.innerHTML = '[⟳] Téléversement...';
        btnSubmitAddClue.disabled = true;

        try {
          const formData = new FormData();
          formData.append('file', invNewClueSelectedImageFile);
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();

          if (uploadData?.success && uploadData.url) {
            image = uploadData.url;
          }
        } catch (err) {
          console.error('Erreur upload image indice :', err);
        } finally {
          btnSubmitAddClue.innerHTML = originalText;
          btnSubmitAddClue.disabled = false;
        }
      }

      const myChar = typeof getMyPlayerToken === 'function' ? getMyPlayerToken() : null;
      const author = myChar?.name || (CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : 'Aventurier');

      const clueData = {
        title,
        content,
        type: typeVal,
        status,
        role,
        color,
        image,
        isSealed: typeVal === 'sealed',
        sealedBy: typeVal === 'sealed' ? author : null,
        author,
        authorRole: CURRENT_ROLE,
        x: 120 + Math.floor(Math.random() * 400) - invPanX,
        y: 100 + Math.floor(Math.random() * 250) - invPanY
      };

      socket.emit('investigation:add_clue', {
        roomId: CURRENT_ROOM,
        clue: clueData
      }, (res) => {
        if (res?.success) {
          closeAddClue();
        }
      });
    });
  }

  // --- Modale Détail d'un indice ---
  const closeClueDetail = () => {
    if (modalClueDetail) modalClueDetail.classList.add('hidden');
    invActiveDetailClueId = null;
  };
  if (btnCloseClueDetail) btnCloseClueDetail.addEventListener('click', closeClueDetail);
  if (btnCancelClueDetail) btnCancelClueDetail.addEventListener('click', closeClueDetail);

  // Briser le sceau d'une lettre scellée
  if (btnUnsealClue) {
    btnUnsealClue.addEventListener('click', () => {
      if (!CURRENT_ROOM || !invActiveDetailClueId) return;

      const myChar = typeof getMyPlayerToken === 'function' ? getMyPlayerToken() : null;
      const unsealedBy = myChar?.name || (CURRENT_ROLE === 'mj' ? 'Le Maître du Jeu' : 'Un Aventurier');

      socket.emit('investigation:unseal', {
        roomId: CURRENT_ROOM,
        clueId: invActiveDetailClueId,
        unsealedBy
      });
    });
  }

  // Supprimer un indice depuis sa modale
  if (btnDeleteClue) {
    btnDeleteClue.addEventListener('click', () => {
      if (!CURRENT_ROOM || !invActiveDetailClueId) return;
      if (confirm('Voulez-vous détacher définitivement cet indice du mur ?')) {
        socket.emit('investigation:delete_clue', {
          roomId: CURRENT_ROOM,
          clueId: invActiveDetailClueId
        });
        closeClueDetail();
      }
    });
  }

  // Démarrer une ficelle depuis la modale
  if (btnLinkFromDetail) {
    btnLinkFromDetail.addEventListener('click', () => {
      if (!invActiveDetailClueId) return;
      const fromId = invActiveDetailClueId;
      closeClueDetail();
      handleClueLinkClick(fromId);
    });
  }

  // Soumission d'une déduction d'équipe
  if (btnSubmitDeduction && inputNewDeduction) {
    const submitDeduction = () => {
      const text = inputNewDeduction.value.trim();
      if (!text || !CURRENT_ROOM || !invActiveDetailClueId) return;

      const myChar = typeof getMyPlayerToken === 'function' ? getMyPlayerToken() : null;
      const author = myChar?.name || (CURRENT_ROLE === 'mj' ? 'Maître du Jeu' : 'Aventurier');

      socket.emit('investigation:add_deduction', {
        roomId: CURRENT_ROOM,
        clueId: invActiveDetailClueId,
        deduction: {
          text,
          author,
          authorRole: CURRENT_ROLE
        }
      }, (res) => {
        if (res?.success) {
          inputNewDeduction.value = '';
        }
      });
    };

    btnSubmitDeduction.addEventListener('click', submitDeduction);
    inputNewDeduction.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitDeduction();
      }
    });
  }

  // --- Modale Création Lien Ficelle ---
  const closeAddLink = () => {
    if (modalAddLink) modalAddLink.classList.add('hidden');
    invLinkModalFromId = null;
    invLinkModalToId = null;
  };
  if (btnCloseAddLink) btnCloseAddLink.addEventListener('click', closeAddLink);
  if (btnCancelAddLink) btnCancelAddLink.addEventListener('click', closeAddLink);

  if (btnConfirmAddLink) {
    btnConfirmAddLink.addEventListener('click', () => {
      if (!CURRENT_ROOM || !invLinkModalFromId || !invLinkModalToId) return;

      const labelInput = document.getElementById('inv-link-label-input');
      const colorRadio = document.querySelector('input[name="link-color"]:checked');

      const label = labelInput?.value.trim() || '';
      const color = colorRadio?.value || '#ef4444';

      socket.emit('investigation:add_link', {
        roomId: CURRENT_ROOM,
        link: {
          fromId: invLinkModalFromId,
          toId: invLinkModalToId,
          label,
          color
        }
      }, (res) => {
        if (res?.success) {
          closeAddLink();
        }
      });
    });
  }

  // ----------------------------------------------------------
  // ÉCOUTEURS D'ÉVÉNEMENTS SOCKET.IO DU CARNET D'ENQUÊTE
  // ----------------------------------------------------------

  socket.on('investigation:clue_added', ({ clue }) => {
    if (!clue) return;
    if (!Array.isArray(investigationState.clues)) investigationState.clues = [];
    investigationState.clues.push(clue);
    renderInvestigationBoard();
  });

  socket.on('investigation:clue_updated', ({ clue }) => {
    if (!clue) return;
    const idx = (investigationState.clues || []).findIndex((c) => c.id === clue.id);
    if (idx !== -1) {
      investigationState.clues[idx] = clue;
      renderInvestigationBoard();
      if (invActiveDetailClueId === clue.id) {
        openClueDetailModal(clue.id);
      }
    }
  });

  socket.on('investigation:clue_moved', ({ clueId, x, y }) => {
    const clue = (investigationState.clues || []).find((c) => c.id === clueId);
    if (clue) {
      clue.x = x;
      clue.y = y;
      const card = document.getElementById(`inv-card-${clueId}`);
      if (card) {
        card.style.left = `${x}px`;
        card.style.top = `${y}px`;
      }
      renderInvestigationStrings();
    }
  });

  socket.on('investigation:clue_deleted', ({ clueId }) => {
    investigationState.clues = (investigationState.clues || []).filter((c) => c.id !== clueId);
    investigationState.links = (investigationState.links || []).filter((l) => l.fromId !== clueId && l.toId !== clueId);
    renderInvestigationBoard();
    if (invActiveDetailClueId === clueId) {
      closeClueDetail();
    }
  });

  socket.on('investigation:clue_unsealed', ({ clue }) => {
    if (!clue) return;
    const idx = (investigationState.clues || []).findIndex((c) => c.id === clue.id);
    if (idx !== -1) {
      investigationState.clues[idx] = clue;
      renderInvestigationBoard();
      if (invActiveDetailClueId === clue.id) {
        openClueDetailModal(clue.id);
      }
    }
  });

  socket.on('investigation:deduction_added', ({ clueId, deduction }) => {
    const clue = (investigationState.clues || []).find((c) => c.id === clueId);
    if (clue) {
      if (!Array.isArray(clue.deductions)) clue.deductions = [];
      clue.deductions.push(deduction);
      renderInvestigationBoard();
      if (invActiveDetailClueId === clueId) {
        renderDeductionsList(clue);
      }
    }
  });

  socket.on('investigation:link_added', ({ link }) => {
    if (!link) return;
    if (!Array.isArray(investigationState.links)) investigationState.links = [];
    if (!investigationState.links.some((l) => l.id === link.id)) {
      investigationState.links.push(link);
      renderInvestigationBoard();
    }
  });

  socket.on('investigation:link_deleted', ({ linkId }) => {
    investigationState.links = (investigationState.links || []).filter((l) => l.id !== linkId);
    renderInvestigationBoard();
  });

  socket.on('investigation:cleared', () => {
    investigationState.clues = [];
    investigationState.links = [];
    renderInvestigationBoard();
    closeClueDetail();
  });
}



