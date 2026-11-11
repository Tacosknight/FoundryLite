'use strict';
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../../src/createServer');
let instance, directory, url;
const origins = [];
test.beforeAll(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foundry-browser-'));
  instance = await createServer({ dataDirectory: directory, allowedOrigins: origins });
  await new Promise(resolve => instance.server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${instance.server.address().port}`;
  origins.push(url);
});
test.afterAll(async () => { if (instance) await instance.close(); if (directory) await fs.rm(directory, { recursive: true, force: true }); });
test('home renders, establishes session, and exposes campaign controls on mobile', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await expect(page.locator('#join-form')).toBeVisible();
  await expect(page.locator('#campaign-create')).toBeAttached();
  await expect(page.locator('#campaign-invitation')).toBeAttached();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

async function join(page, { room, name, create = false, invitation = '' }) {
  await page.goto(url);
  await page.locator('#roomId').fill(room);
  await page.locator('#username').fill(name);
  await page.locator('#campaign-create').setChecked(create);
  await page.locator('#campaign-invitation').fill(invitation);
  await page.locator('#btn-join').click();
  await expect(page.locator('#current-room')).toHaveText(room);
}

test('recovery restores the campaign identity and rotates the recovery code', async ({ browser }) => {
  const originalContext = await browser.newContext();
  const recoveredContext = await browser.newContext();
  try {
    const original = await originalContext.newPage();
    await original.goto(url);
    const recovery = original.getByLabel('Code personnel de récupération');
    await expect(recovery).toBeVisible();
    const code = await recovery.inputValue();
    await original.locator('#roomId').fill('recovery-campaign');
    await original.locator('#username').fill('MJ');
    await original.locator('#campaign-create').check();
    await original.locator('#btn-join').click();
    await expect(original.locator('#current-room')).toHaveText('recovery-campaign');

    const recovered = await recoveredContext.newPage();
    await recovered.goto(url);
    await expect(recovered.getByLabel('Code personnel de récupération')).toBeVisible();
    await recovered.getByRole('button', { name: 'Récupérer mon identité' }).click();
    const dialog = recovered.getByRole('dialog');
    await dialog.getByLabel('Code de récupération', { exact: true }).fill(code);
    await dialog.getByRole('button', { name: 'Récupérer', exact: true }).click();
    const replacement = dialog.getByLabel('Nouveau code de récupération');
    await expect(replacement).toBeVisible();
    expect(await replacement.inputValue()).not.toBe(code);
    await dialog.getByRole('button', { name: 'Recharger' }).click();
    await recovered.locator('#roomId').fill('recovery-campaign');
    await recovered.locator('#username').fill('MJ retrouvé');
    await recovered.locator('#btn-join').click();
    await expect(recovered.locator('#current-room')).toHaveText('recovery-campaign');
    await expect(recovered.getByRole('button', { name: 'Inviter', exact: true })).toBeVisible();

    const response = await recovered.request.post(`${url}/api/session/recover`, {
      headers: { Origin: url }, data: { code }
    });
    expect(response.ok()).toBe(false);
  } finally {
    await originalContext.close();
    await recoveredContext.close();
  }
});

test('MJ invites a player who forges a stable character, reconnects and survives restoration', async ({ browser }) => {
  const gmContext = await browser.newContext();
  const playerContext = await browser.newContext();
  try {
    const gm = await gmContext.newPage();
    const player = await playerContext.newPage();
    const errors = [];
    for (const page of [gm, player]) page.on('pageerror', error => errors.push(error.message));
    await join(gm, { room: 'browser-campaign', name: 'MJ', create: true });
    await gm.getByRole('button', { name: 'Inviter', exact: true }).click();
    const invitation = await gm.getByLabel('Code d’invitation', { exact: true }).inputValue();
    await gm.getByRole('dialog').getByRole('button', { name: 'Fermer', exact: true }).click();
    await join(player, { room: 'browser-campaign', name: 'Héroïne', invitation });
    await expect(player.locator('#char-create-form')).toBeVisible();
    await player.locator('#btn-roll-stats').click();
    await expect(player.locator('#attr-points-left')).toHaveText('0');
    await player.locator('#btn-forge-destiny').click();
    await expect.poll(() => player.evaluate(() => getMyCharacter()?.created)).toBe(true);
    const identity = await player.evaluate(() => getMyCharacter().id);
    await expect.poll(() => gm.evaluate(() => charactersCache.size)).toBe(1);
    await player.reload();
    await player.locator('#roomId').fill('browser-campaign');
    await player.locator('#username').fill('Autre pseudo');
    await player.locator('#btn-join').click();
    await expect.poll(() => player.evaluate(() => getMyCharacter()?.id)).toBe(identity);
    const spawned = await gm.evaluate(() => new Promise(resolve => socket.emit('map:spawn_all_players', { startX: 200, startY: 200 }, resolve)));
    expect(spawned.success).toBe(true);
    const initiative = await gm.evaluate(() => new Promise(resolve => socket.emit('turn:roll_initiative', {}, resolve)));
    expect(initiative.success).toBe(true);
    await player.locator('[data-tab="map"]').click();
    await expect(player.locator('#btn-finish-my-turn')).toBeVisible();
    await expect.poll(() => player.evaluate(() => isTacticalMapActive())).toBe(true);
    const beforeTurn = await player.evaluate(() => tacticalMapState.currentTurn.timestamp);
    await player.locator('body').click({ position: { x: 10, y: 180 } });
    await player.keyboard.press('p');
    await expect.poll(() => instance.services.roomManager.getRoom('browser-campaign').map.turnSystem.round).toBe(initiative.result.round + 1);
    await expect.poll(() => player.evaluate(() => tacticalMapState.currentTurn.timestamp)).not.toBe(beforeTurn);
    const snapshot = await gm.evaluate(() => new Promise(resolve => socket.emit('room:snapshot:create', { name: 'Avant modification' }, resolve)));
    expect(snapshot.success).toBe(true);
    const renamed = await player.evaluate(() => new Promise(resolve => socket.emit('char:rename', { name: 'Après modification' }, resolve)));
    expect(renamed.success).toBe(true);
    await expect.poll(() => player.evaluate(() => getMyCharacter()?.name)).toBe('Après modification');
    const restored = await gm.evaluate(snapshotId => new Promise(resolve => socket.emit('room:snapshot:restore', { snapshotId }, resolve)), snapshot.result.id);
    expect(restored.success).toBe(true);
    await expect.poll(() => player.evaluate(() => getMyCharacter()?.name)).toBe('Héroïne');
    await expect.poll(() => player.evaluate(() => getMyCharacter()?.id)).toBe(identity);
    await gm.getByRole('button', { name: 'Exporter', exact: true }).click();
    const downloadPromise = gm.waitForEvent('download');
    await gm.getByRole('dialog').getByRole('button', { name: 'Télécharger le JSON' }).click();
    const download = await downloadPromise;
    const exported = await fs.readFile(await download.path());
    await gm.getByRole('dialog').getByRole('button', { name: 'Fermer' }).click();
    const renamedAgain = await player.evaluate(() => new Promise(resolve => socket.emit('char:rename', { name: 'Avant import' }, resolve)));
    expect(renamedAgain.success).toBe(true);
    await gm.getByRole('button', { name: 'Importer', exact: true }).click();
    await gm.getByLabel('Fichier JSON').setInputFiles({ name: 'campagne.json', mimeType: 'application/json', buffer: exported });
    gm.once('dialog', dialog => dialog.accept());
    await gm.getByRole('button', { name: 'Importer et remplacer' }).click();
    await expect(gm.getByRole('dialog').getByRole('status')).toHaveText('Campagne importée.');
    await expect.poll(() => player.evaluate(() => getMyCharacter()?.name)).toBe('Héroïne');
    await player.setViewportSize({ width: 390, height: 844 });
    await player.screenshot({ path: 'test-results/player-mobile.png', fullPage: true });
    expect(errors).toEqual([]);
  } finally {
    await gmContext.close();
    await playerContext.close();
  }
});
