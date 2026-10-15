const roomManager = require('../state/RoomManager');

/**
 * Enregistre les écouteurs d'événements Socket.io pour la gestion de l'inventaire en temps réel
 * @param {import('socket.io').Server} io - Instance Socket.io
 * @param {import('socket.io').Socket} socket - Socket du client connecté
 */
function registerInvHandlers(io, socket) {
  /**
   * Ajout d'un nouvel objet dans l'inventaire d'un personnage
   * data: { roomId: string, slot: number, item: { name, desc, qty, imgUrl } }
   */
  socket.on('inv:add_item', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { slot, item } = data || {};

      if (!item || !item.name || !item.name.trim()) {
        throw new Error('Le nom de l\'objet est obligatoire.');
      }

      const result = roomManager.addItemToInventory(roomId, slot, item);

      const payload = {
        roomId,
        slot: Number(slot),
        character: result.character,
        inventory: result.character.inventory,
        item: result.item
      };

      // Diffusion en temps réel à toute la salle
      io.to(roomId).emit('inv:updated', payload);
      io.to(roomId).emit('char:vitals_updated', {
        roomId,
        slot: Number(slot),
        character: result.character
      });

      console.log(`[InvHandler] Objet "${result.item.name}" (x${result.item.qty}) ajouté au slot ${slot} (${result.character.name}).`);

      if (typeof callback === 'function') {
        callback({ success: true, item: result.item, character: result.character });
      }
    } catch (error) {
      console.error(`[InvHandler Error] inv:add_item (${socket.id}) :`, error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Suppression d'un objet de l'inventaire (jeter l'objet)
   * data: { roomId: string, slot: number, itemId: string }
   */
  socket.on('inv:remove_item', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { slot, itemId } = data || {};

      if (!itemId) {
        throw new Error('Identifiant d\'objet manquant.');
      }

      const result = roomManager.removeItemFromInventory(roomId, slot, itemId);

      const payload = {
        roomId,
        slot: Number(slot),
        character: result.character,
        inventory: result.character.inventory,
        removedItemId: itemId
      };

      // Diffusion de la mise à jour à toute la salle
      io.to(roomId).emit('inv:updated', payload);
      io.to(roomId).emit('char:vitals_updated', {
        roomId,
        slot: Number(slot),
        character: result.character
      });

      console.log(`[InvHandler] Objet ID "${itemId}" retiré du slot ${slot} (${result.character.name}).`);

      if (typeof callback === 'function') {
        callback({ success: true, character: result.character });
      }
    } catch (error) {
      console.error(`[InvHandler Error] inv:remove_item (${socket.id}) :`, error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });

  /**
   * Modification de la quantité d'un objet (incrémenter/décrémenter)
   * data: { roomId: string, slot: number, itemId: string, change?: number, delta?: number }
   */
  socket.on('inv:update_qty', (data, callback) => {
    try {
      const roomId = data?.roomId || socket.data?.roomId || 'table-ronde';
      const { slot, itemId, change, delta } = data || {};
      const diff = Number(change !== undefined ? change : delta);

      if (!itemId || isNaN(diff)) {
        throw new Error('Paramètres invalides pour la mise à jour de quantité.');
      }

      const result = roomManager.updateItemQuantity(roomId, slot, itemId, diff);

      const payload = {
        roomId,
        slot: Number(slot),
        character: result.character,
        inventory: result.character.inventory,
        item: result.item,
        removed: result.removed
      };

      // Diffusion à toute la table
      io.to(roomId).emit('inv:updated', payload);
      io.to(roomId).emit('char:vitals_updated', {
        roomId,
        slot: Number(slot),
        character: result.character
      });

      console.log(`[InvHandler] Quantité modifiée pour l'objet ${itemId} (${diff > 0 ? `+${diff}` : diff}) sur slot ${slot}.`);

      if (typeof callback === 'function') {
        callback({ success: true, item: result.item, removed: result.removed });
      }
    } catch (error) {
      console.error(`[InvHandler Error] inv:update_qty (${socket.id}) :`, error.message);
      if (typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  });
}

module.exports = registerInvHandlers;
