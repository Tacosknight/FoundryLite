'use strict';

// Interface de campagne : l'identité et la connexion Socket.IO restent gérées par app.js.
(() => {
  const inputClass = 'w-full px-3 py-2 bg-stone-950 border border-amber-900 text-stone-100';
  const buttonClass = 'px-3 py-2 rpg-btn rpg-btn-gold text-xs font-cinzel';
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const button = (text, action) => {
    const node = el('button', text, buttonClass);
    node.type = 'button';
    node.addEventListener('click', action);
    return node;
  };
  const field = (label, type = 'text') => {
    const wrapper = el('label', null, 'block space-y-1 text-amber-200');
    wrapper.append(el('span', label, 'block text-sm'));
    const control = document.createElement('input');
    control.type = type;
    control.className = inputClass;
    wrapper.append(control);
    return { wrapper, control };
  };
  const selectField = (label, choices) => {
    const wrapper = el('label', null, 'block space-y-1 text-amber-200');
    wrapper.append(el('span', label, 'block text-sm'));
    const control = el('select', null, inputClass);
    choices.forEach(([value, text]) => {
      const option = el('option', text);
      option.value = value;
      control.append(option);
    });
    wrapper.append(control);
    return { wrapper, control };
  };
  const emit = (event, data = {}) => new Promise((resolve, reject) => {
    if (!CURRENT_ROOM || CURRENT_ROLE !== 'mj' || !socket.connected) return reject(new Error('Connexion MJ requise.'));
    const timer = setTimeout(() => reject(new Error('Le serveur ne répond pas.')), 10000);
    socket.emit(event, { roomId: CURRENT_ROOM, ...data }, (response) => {
      clearTimeout(timer);
      if (!response?.success) reject(new Error(response?.error || 'Action impossible.'));
      else resolve(response);
    });
  });
  const run = (status, action) => async () => {
    status.textContent = '';
    try { await action(); } catch (error) { status.textContent = error.message || 'Une erreur est survenue.'; }
  };
  const dialog = (title) => {
    const box = el('dialog', null, 'fixed z-50 bg-stone-950 text-stone-100 border-2 border-amber-800 p-5 w-[min(94vw,48rem)] max-h-[90dvh] overflow-y-auto shadow-2xl');
    const heading = el('h2', title, 'font-cinzel text-lg text-amber-300 font-bold');
    const headingId = `campaign-dialog-${Math.random().toString(36).slice(2)}`;
    heading.id = headingId;
    box.setAttribute('aria-labelledby', headingId);
    const status = el('p', '', 'text-amber-300 text-sm');
    status.setAttribute('role', 'status');
    const body = el('div', null, 'space-y-4 my-4');
    const close = button('Fermer', () => box.close());
    box.append(heading, status, body, close);
    document.body.append(box);
    box.addEventListener('close', () => box.remove(), { once: true });
    box.showModal();
    return { box, body, status };
  };
  const activeScene = () => {
    const { scenes: _sceneSummaries, ...scene } = tacticalMapState;
    scene.id = tacticalMapState.activeSceneId;
    scene.name = tacticalMapState.sceneName || 'Scène active';
    return scene;
  };
  const scenes = async () => {
    const response = await emit('scene:list');
    return Array.isArray(response.scenes) ? response.scenes : [];
  };

  function initLogin() {
    const form = document.getElementById('join-form');
    if (!form) return;
    const create = document.createElement('input');
    create.type = 'checkbox';
    create.id = 'campaign-create';
    const createLabel = el('label', null, 'flex items-center gap-2 text-amber-200 text-sm');
    createLabel.append(create, document.createTextNode('Créer une campagne en tant que MJ'));
    const invitation = field('Code d’invitation (si nécessaire)');
    invitation.control.id = 'campaign-invitation';
    invitation.control.autocomplete = 'off';
    form.insertBefore(createLabel, document.getElementById('btn-join'));
    form.insertBefore(invitation.wrapper, document.getElementById('btn-join'));
    const recover = button('Récupérer mon identité', () => {
      const d = dialog('Récupérer mon identité');
      const code = field('Code de récupération');
      code.control.autocomplete = 'off';
      const submit = button('Récupérer', run(d.status, async () => {
        if (!code.control.value.trim()) throw new Error('Saisissez votre code de récupération.');
        const response = await fetch('/api/session/recover', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: code.control.value.trim() }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Récupération impossible.');
        d.body.replaceChildren();
        d.body.append(el('p', 'Identité récupérée. Le code précédent est invalidé. Conservez le nouveau code ci-dessous avant de recharger.', 'text-amber-200'));
        const newCode = field('Nouveau code de récupération');
        newCode.control.value = result.recoveryCode || '';
        newCode.control.readOnly = true;
        d.body.append(newCode.wrapper, button('Recharger', () => location.reload()));
        d.status.textContent = '';
      }));
      d.body.append(code.wrapper, submit);
      code.control.focus();
    });
    recover.classList.add('w-full');
    form.insertAdjacentElement('afterend', recover);
  }

  function snapshotUI() {
    const d = dialog('Points de sauvegarde');
    const name = field('Nom du point');
    name.control.maxLength = 200;
    const list = el('div', null, 'space-y-2');
    const refresh = async () => {
      const { result } = await emit('room:snapshot:list');
      list.replaceChildren();
      if (!result?.length) list.append(el('p', 'Aucun point de sauvegarde.', 'text-stone-400'));
      (result || []).forEach((item) => {
        const row = el('div', null, 'border border-stone-700 p-2 flex flex-wrap gap-2 items-center');
        row.append(el('span', `${item.name} — ${new Date(item.createdAt).toLocaleString('fr-FR')}`, 'flex-1'));
        row.append(button('Restaurer', run(d.status, async () => {
          if (!confirm(`Restaurer « ${item.name} » ? Une sauvegarde préalable sera créée.`)) return;
          await emit('room:snapshot:restore', { snapshotId: item.id });
          d.status.textContent = 'Restauration effectuée.';
          await refresh();
        })), button('Supprimer', run(d.status, async () => {
          if (!confirm(`Supprimer « ${item.name} » ?`)) return;
          await emit('room:snapshot:delete', { snapshotId: item.id });
          await refresh();
        })));
        list.append(row);
      });
    };
    d.body.append(name.wrapper, button('Créer un point', run(d.status, async () => {
      if (!name.control.value.trim()) throw new Error('Indiquez un nom.');
      await emit('room:snapshot:create', { name: name.control.value.trim() });
      name.control.value = '';
      await refresh();
    })), list);
    run(d.status, refresh)();
  }

  function libraryUI() {
    const d = dialog('Bibliothèque de campagne');
    const name = field('Nom du modèle');
    name.control.maxLength = 200;
    const type = selectField('Type', [['map', 'Carte active'], ['token', 'Pion non joueur'], ['encounter', 'Rencontre']]);
    const tokenArea = el('fieldset', null, 'border border-stone-700 p-2 space-y-1');
    tokenArea.append(el('legend', 'Pions de la scène active', 'text-amber-200'));
    const tokens = (tacticalMapState.tokens || []).filter(t => t.type !== 'player');
    tokens.forEach((token) => {
      const label = el('label', null, 'flex gap-2 items-center');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox'; checkbox.value = token.id;
      label.append(checkbox, document.createTextNode(token.name || token.id));
      tokenArea.append(label);
    });
    if (!tokens.length) tokenArea.append(el('p', 'Aucun pion non joueur sur la scène active.', 'text-stone-400'));
    const search = field('Rechercher dans la bibliothèque', 'search');
    const list = el('div', null, 'space-y-2');
    let entries = [];
    const draw = () => {
      list.replaceChildren();
      const filtered = entries.filter(item => item.name.toLocaleLowerCase().includes(search.control.value.toLocaleLowerCase()));
      if (!filtered.length) list.append(el('p', 'Aucun modèle.', 'text-stone-400'));
      filtered.forEach(item => {
        const row = el('div', null, 'border border-stone-700 p-2 flex flex-wrap gap-2 items-center');
        row.append(el('span', `${item.name} (${item.type})`, 'flex-1'));
        row.append(button('Instancier', run(d.status, async () => {
          await emit('library:instantiate', { id: item.id, sceneId: tacticalMapState.activeSceneId });
          d.status.textContent = 'Modèle instancié côté serveur. Rechargez la scène pour voir le résultat.';
        })), button('Renommer', run(d.status, async () => {
          const next = prompt('Nouveau nom', item.name);
          if (next === null) return;
          if (!next.trim()) throw new Error('Indiquez un nom.');
          await emit('library:update', { id: item.id, fields: { name: next.trim() } });
          await refresh();
        })), button('Supprimer', run(d.status, async () => {
          if (!confirm(`Supprimer « ${item.name} » ?`)) return;
          await emit('library:delete', { id: item.id });
          await refresh();
        })));
        list.append(row);
      });
    };
    const refresh = async () => { const response = await emit('library:list'); entries = response.result || []; draw(); };
    search.control.addEventListener('input', draw);
    d.body.append(name.wrapper, type.wrapper, tokenArea, button('Créer le modèle', run(d.status, async () => {
      const value = name.control.value.trim();
      if (!value) throw new Error('Indiquez un nom.');
      const selected = [...tokenArea.querySelectorAll('input:checked')].map(input => input.value);
      const data = { type: type.control.value, name: value };
      if (data.type === 'map') data.data = activeScene();
      else if (data.type === 'token') {
        if (selected.length !== 1) throw new Error('Sélectionnez exactement un pion non joueur.');
        data.data = tokens.find(token => token.id === selected[0]);
      } else {
        if (!selected.length) throw new Error('Sélectionnez au moins un pion non joueur.');
        data.sceneId = tacticalMapState.activeSceneId;
        data.tokenIds = selected;
      }
      await emit('library:create', data);
      name.control.value = '';
      await refresh();
    })), search.wrapper, list);
    run(d.status, refresh)();
  }

  function sceneUI() {
    const d = dialog('Dupliquer une scène');
    const name = field('Nom de la copie (facultatif)');
    run(d.status, async () => {
      const all = await scenes();
      if (!all.length) throw new Error('Aucune scène disponible.');
      const choice = selectField('Scène', all.map(scene => [scene.id, scene.name || scene.id]));
      d.body.append(choice.wrapper, name.wrapper, button('Dupliquer', run(d.status, async () => {
        await emit('scene:duplicate', { sceneId: choice.control.value, name: name.control.value.trim() || undefined });
        d.status.textContent = 'Scène dupliquée. Actualisez le gestionnaire de scènes.';
      })));
    })();
  }

  function historyUI() {
    const d = dialog('Journal de campagne');
    const list = el('ol', null, 'space-y-2');
    const paging = el('div', null, 'flex gap-2');
    let offset = 0;
    const refresh = async () => {
      const { result } = await emit('history:list', { offset, limit: 50 });
      list.replaceChildren();
      (result.entries || []).forEach(entry => list.append(el('li', `${new Date(entry.timestamp).toLocaleString('fr-FR')} — ${entry.actor} — ${entry.action}`, 'border-b border-stone-800 py-1')));
      if (!result.entries.length) list.append(el('li', 'Aucune entrée.'));
      paging.replaceChildren();
      if (offset > 0) paging.append(button('Plus récent', run(d.status, async () => { offset = Math.max(0, offset - 50); await refresh(); })));
      if (offset + 50 < result.total) paging.append(button('Plus ancien', run(d.status, async () => { offset += 50; await refresh(); })));
    };
    d.body.append(list, paging);
    run(d.status, refresh)();
  }

  function initTools() {
    const save = document.getElementById('btn-save-room');
    if (!save) return;
    const tools = el('span', null, 'hidden flex-wrap gap-1');
    tools.id = 'campaign-tools';
    const invite = () => {
      const d = dialog('Invitation');
      run(d.status, async () => {
        const response = await emit('room:invite');
        const code = field('Code d’invitation');
        code.control.value = response.code;
        code.control.readOnly = true;
        d.body.append(el('p', 'Transmettez ce code au joueur par un canal privé.'), code.wrapper);
      })();
    };
    const exportGame = () => {
      const d = dialog('Exporter la campagne');
      d.body.append(el('p', 'L’export JSON contient des références aux médias, pas les fichiers images. Conservez-les séparément.', 'text-amber-200'));
      d.body.append(button('Télécharger le JSON', run(d.status, async () => {
        const { result } = await emit('room:export');
        const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a'); link.href = url; link.download = 'campagne.json'; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })));
    };
    const importGame = () => {
      const d = dialog('Importer une campagne');
      const file = field('Fichier JSON', 'file');
      file.control.accept = '.json,application/json';
      d.body.append(el('p', 'L’import remplace la partie actuelle et crée un point de sauvegarde préalable. Les fichiers médias ne sont pas inclus dans le JSON.', 'text-amber-200'), file.wrapper);
      d.body.append(button('Importer et remplacer', run(d.status, async () => {
        const selected = file.control.files[0];
        if (!selected) throw new Error('Sélectionnez un fichier JSON.');
        if (selected.size > 5 * 1024 * 1024) throw new Error('Fichier trop volumineux (5 Mo maximum).');
        let archive;
        try { archive = JSON.parse(await selected.text()); } catch { throw new Error('Fichier JSON invalide.'); }
        if (!confirm('Remplacer la partie actuelle par cette sauvegarde ?')) return;
        await emit('room:import', { archive });
        d.status.textContent = 'Campagne importée.';
      })));
    };
    tools.append(button('Inviter', invite), button('Points', snapshotUI), button('Bibliothèque', libraryUI), button('Scènes', sceneUI), button('Journal', historyUI), button('Exporter', exportGame), button('Importer', importGame));
    save.insertAdjacentElement('afterend', tools);
    // Le bouton existant reflète déjà les permissions et l'état de connexion.
    const update = () => { tools.classList.toggle('hidden', save.classList.contains('hidden')); tools.classList.toggle('flex', !save.classList.contains('hidden')); };
    new MutationObserver(update).observe(save, { attributes: true, attributeFilter: ['class'] });
    update();
  }
  initLogin();
  initTools();
})();
