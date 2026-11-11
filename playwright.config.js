'use strict';
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './test/e2e', timeout: 30000, workers: 1, use: { headless: true, viewport: { width: 1280, height: 900 } } });
