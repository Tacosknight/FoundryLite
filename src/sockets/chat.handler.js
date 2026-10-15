/**
 * Module Socket.io pour la gestion du Chat et du Lancer de Dés
 */

/**
 * Analyse et résout une formule de dés (ex: "1d20", "2d6+3", "d100", "3d8-2")
 * Effectue le calcul côté serveur pour garantir l'équité.
 * @param {string} rawFormula 
 * @returns {Object} Détail du tirage
 */
function parseAndRoll(rawFormula) {
  if (!rawFormula || typeof rawFormula !== 'string') {
    throw new Error('Formule de dé invalide ou manquante.');
  }

  // Nettoyage : suppression des espaces et conversion en minuscules
  const formula = rawFormula.trim().toLowerCase().replace(/\s+/g, '');

  // Regex pour capturer [nombre]d[faces] ([+/-] [modificateur])
  const regex = /^(\d*)d(\d+)(?:([+-])(\d+))?$/;
  const match = formula.match(regex);

  if (!match) {
    throw new Error(`Format de dé incorrect : "${rawFormula}". Exemples valides : 1d20, 2d6+3, d100, 3d8-1`);
  }

  const count = match[1] === '' ? 1 : parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const sign = match[3] || '+';
  const rawMod = match[4] ? parseInt(match[4], 10) : 0;
  const modifier = sign === '-' ? -rawMod : rawMod;

  // Gardes-fous pour éviter les abus ou blocages
  if (count <= 0 || count > 50) {
    throw new Error('Le nombre de dés doit être compris entre 1 et 50.');
  }
  if (sides <= 1 || sides > 1000) {
    throw new Error('Le nombre de faces doit être compris entre 2 et 1000.');
  }

  // Tirage sécurisé côté serveur
  const rolls = [];
  let sumRolls = 0;
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    sumRolls += roll;
  }

  const total = sumRolls + modifier;

  // Détection des réussites et échecs critiques sur le d20
  let isCriticalSuccess = false;
  let isCriticalFailure = false;

  if (sides === 20 && count === 1) {
    if (rolls[0] === 20) isCriticalSuccess = true;
    if (rolls[0] === 1) isCriticalFailure = true;
  }

  return {
    formula,
    count,
    sides,
    rolls,
    modifier,
    total,
    isCriticalSuccess,
    isCriticalFailure
  };
}

/**
 * Enregistre les gestionnaires d'événements Socket.io pour le chat et les dés
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerChatHandlers(io, socket) {
  const roomManager = require('../state/RoomManager');

  /**
   * Envoi d'un message textuel classique
   * data: { roomId: string, sender: string, text: string, color?: string, isMJ?: boolean }
   */
  socket.on('chat:message', (data, callback) => {
    try {
      const { roomId = 'table-ronde', sender, text, color: clientColor } = data || {};

      if (!text || typeof text !== 'string' || !text.trim()) {
        throw new Error('Le message ne peut pas être vide.');
      }

      const cleanText = text.trim();
      const userRole = socket.data?.user?.role;
      const isMJ = userRole === 'mj' || data?.isMJ;

      // Détermination du nom d'expéditeur et de sa couleur
      const roomObj = roomManager.getRoom(roomId);
      const playerChar = roomObj?.characters?.find(c => c.socketId === socket.id);
      
      let cleanSender = (sender && typeof sender === 'string' && sender.trim())
        ? sender.trim()
        : (isMJ ? 'Maître du Jeu' : (playerChar?.name || 'Aventurier'));

      let messageColor = '#ef4444';
      if (isMJ) {
        messageColor = '#facc15'; // Jaune / Or éclatant exclusivement réservé au MJ
      } else if (playerChar?.color) {
        messageColor = playerChar.color;
      } else if (clientColor && clientColor !== '#facc15' && clientColor !== '#eab308' && clientColor !== '#f59e0b') {
        messageColor = clientColor;
      }

      const messagePayload = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        roomId,
        sender: cleanSender,
        color: messageColor,
        isMJ: Boolean(isMJ),
        text: cleanText,
        timestamp: new Date().toISOString()
      };

      // Diffusion du message à tous les clients connectés
      io.emit('chat:broadcast', messagePayload);

      if (typeof callback === 'function') {
        callback({ success: true, message: messagePayload });
      }
    } catch (error) {
      console.error(`[ChatHandler Error] ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Demande de lancer de dés
   * data: { roomId: string, sender: string, formula: string }
   */
  socket.on('dice:roll', (data, callback) => {
    try {
      // Seul le Maître du Jeu (MJ) est autorisé à lancer les dés
      const userRole = socket.data?.user?.role;
      const isMJ = Boolean(userRole === 'mj' || data?.isMJ);
      if (!isMJ || (userRole && userRole !== 'mj')) {
        throw new Error('Action non autorisée : seul le Maître du Jeu a le pouvoir de lancer les dés.');
      }

      const { roomId = 'table-ronde', sender, formula, target } = data || {};

      const rollResult = parseAndRoll(formula);
      const cleanSender = (sender && typeof sender === 'string' && sender.trim())
        ? sender.trim()
        : 'Maître du Jeu';

      // Détermination du statut spécifique au d20
      let outcome = null;
      if (rollResult.sides === 20 && rollResult.count === 1) {
        const d20Val = rollResult.rolls[0];
        if (d20Val === 1) outcome = 'crit_fail';
        else if (d20Val >= 2 && d20Val <= 9) outcome = 'fail';
        else if (d20Val >= 10 && d20Val <= 19) outcome = 'success';
        else if (d20Val === 20) outcome = 'crit_success';
      }

      const dicePayload = {
        id: `dice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        roomId,
        sender: cleanSender,
        color: isMJ ? '#facc15' : '#ef4444',
        target: target || null, // ex: { slot: 0, name: 'Valeros' } ou null
        isMJ,
        outcome,
        ...rollResult,
        timestamp: new Date().toISOString()
      };

      // Log serveur pour audit/anti-triche
      const targetStr = target ? ` pour ${target.name || `Slot ${target.slot}`}` : '';
      console.log(`[Dice Roll] [${isMJ ? 'MJ' : 'Joueur'}] ${cleanSender} a lancé ${formula}${targetStr} -> Total: ${rollResult.total} (Dés: [${rollResult.rolls.join(', ')}]) Outcome: ${outcome}`);

      // Diffusion du résultat à tous les clients
      io.emit('dice:result', dicePayload);

      if (typeof callback === 'function') {
        callback({ success: true, result: dicePayload });
      }
    } catch (error) {
      console.error(`[DiceHandler Error] ${error.message}`);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });
}

module.exports = registerChatHandlers;
module.exports.parseAndRoll = parseAndRoll;
