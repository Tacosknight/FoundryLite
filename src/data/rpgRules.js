/**
 * Données de référence et logique d'équilibrage RPG
 * 10 Races et 6 Classes médiévales-fantastiques
 */

const RACES = {
  humain: {
    id: 'humain',
    name: 'Humain',
    icon: '👤',
    tagline: 'Adaptable et résolu',
    description: 'Les humains excellent dans la polyvalence. Leur volonté indomptable leur confère une robuste adaptabilité face à toutes les épreuves.',
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
    tagline: 'Gracieux et lié au voile arcanique',
    description: 'Créatures longévives d\'une agilité surnaturelle. Leur affinité mystique accroît leur réserve d\'énergie au détriment de leur résistance physique.',
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
    tagline: 'Inébranlable comme la pierre des montagnes',
    description: 'Forgerons et guerriers des profondeurs. Leur constitution forgée dans la roche les rend extrêmement coriaces mais plus lents dans la manipulation des flux.',
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
    tagline: 'Férocité sauvage et sang bouillonnant',
    description: 'Porteurs d\'une force brute dévastatrice. Leur endurance martiale leur permet d\'encaisser les coups les plus violents.',
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
    tagline: 'Chance insolente et furtivité naturelle',
    description: 'Petits par la taille mais insaisissables. Leur chance proverbiale leur permet de se sortir des pires pièges sans épuiser leurs forces.',
    hpMod: -1,
    energyMod: 4,
    passive: {
      name: 'Chance Insolente',
      description: 'Évite le danger avec nonchalance (+4 Énergie Max, -1 PV Max).'
    }
  },
  drakeide: {
    id: 'drakeide',
    name: 'Drakéide',
    icon: '🐲',
    tagline: 'Héritier du sang des dragons ancestraux',
    description: 'Nobles fiers dotés d\'écailles impénétrables et du souffle des dragons. Un profil imposant capable d\'encaisser et de projeter sa force.',
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
    tagline: 'Filiation infernale et ruse sombre',
    description: 'Marqués par un héritage d\'outre-monde, les tieffelins puisent dans un feu intérieur obscur pour alimenter leurs ressources ésotériques.',
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
    tagline: 'Curiosité sans fin et esprit vif',
    description: 'Inventeurs et illusionnistes perpétuels. Leur vivacité d\'esprit leur accorde une récupération d\'énergie sans pareille malgré leur petite corpulence.',
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
    tagline: 'Opportunisme vicieux et instincts de survie',
    description: 'Survivant rusé des terriers et des ruines. Habitué à frapper lâchement et fuir, son énergie de panique lui donne un sursaut d\'agilité.',
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
    tagline: 'Harmonie entre deux mondes',
    description: 'Héritant de la robustesse humaine et de la finesse elfique, le demi-elfe trouve un équilibre parfait et une souplesse d\'esprit enviée.',
    hpMod: 1,
    energyMod: 3,
    passive: {
      name: 'Héritage Mixte',
      description: 'Combine constitution et grâce (+1 PV Max, +3 Énergie Max).'
    }
  }
};

const CLASSES = {
  guerrier: {
    id: 'guerrier',
    name: 'Guerrier',
    icon: '🛡️',
    tagline: 'Maître d\'armes et pilier de combat',
    description: 'Expert en armes de mêlée et armures lourdes. Conçu pour tenir la ligne de front et protéger ses compagnons au péril de sa vie.',
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
    description: 'Manipulateur des flux magiques élémentaires. Capable de terrasser des armées entières tout en restant particulièrement vulnérable.',
    baseHp: 16,
    baseEnergy: 26,
    role: 'Dégâts Magiques / Contrôle',
    classPassive: 'Affinité Élémentaire (Maîtrise des sorts destructeurs)'
  },
  voleur: {
    id: 'voleur',
    name: 'Voleur',
    icon: '🗡️',
    tagline: 'Ombre mortelle et expert des faiblesses',
    description: 'Spécialiste de la dissimulation, du crochetage et des frappes chirurgicales. Préfère l\'assaut éclair plutôt que le duel frontal.',
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
    description: 'Canalise les miracles divins pour relever ses alliés ou châtier les impies. Un mélange robuste de dévotion sacrée et de blindage.',
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
    description: 'Tireur d\'élite et survivant émérite. Ses flèches précises harcèlent l\'ennemi à distance pendant qu\'il lit le terrain à la perfection.',
    baseHp: 22,
    baseEnergy: 15,
    role: 'Dégâts à Distance / Pistage',
    classPassive: 'Œil du Faucon (Tir précis et sens de la faune)'
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: '⚔️',
    tagline: 'Champion en armure investi d\'un serment sacré',
    description: 'Chevalier saint combinant puissance martiale et ferveur divine. Ses coups résonnent d\'un châtiment radiant impitoyable.',
    baseHp: 26,
    baseEnergy: 14,
    role: 'Tank Saint / Châtiment',
    classPassive: 'Châtiment Divin (Lame imprégnée d\'éclat sacré)'
  }
};

/**
 * Calcule les statistiques réelles et le passif d'une combinaison Race + Classe
 * Logique d'équilibrage déterministe côté serveur (anti-triche)
 */
function calculateCharacterStats(raceId, classId) {
  const raceKey = (raceId || '').toLowerCase().trim();
  const classKey = (classId || '').toLowerCase().trim();

  const race = RACES[raceKey];
  const charClass = CLASSES[classKey];

  if (!race) {
    throw new Error(`Race invalide : "${raceId}". Choisissez parmi : ${Object.keys(RACES).join(', ')}`);
  }
  if (!charClass) {
    throw new Error(`Classe invalide : "${classId}". Choisissez parmi : ${Object.keys(CLASSES).join(', ')}`);
  }

  // Calcul équilibré
  const maxHp = Math.max(10, charClass.baseHp + race.hpMod);
  const maxEnergy = Math.max(4, charClass.baseEnergy + race.energyMod);

  // Formulation du passif unique combiné
  const passiveTitle = `${race.passive.name} & ${charClass.classPassive.split('(')[0].trim()}`;
  const passiveText = `${race.passive.description} Associé au savoir de la classe ${charClass.name} : ${charClass.classPassive}.`;

  return {
    race: race.name,
    raceId: race.id,
    raceIcon: race.icon,
    class: charClass.name,
    classId: charClass.id,
    classIcon: charClass.icon,
    role: charClass.role,
    hp: maxHp,
    maxHp,
    energy: maxEnergy,
    maxEnergy,
    passive: {
      name: passiveTitle,
      description: passiveText
    }
  };
}

module.exports = {
  RACES,
  CLASSES,
  calculateCharacterStats
};
