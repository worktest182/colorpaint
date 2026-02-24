
@@ -0,0 +1,620 @@
+(() => {
+  'use strict';
+
+  // ==========================================================
+  // Safety wrappers for optional globals
+  // ==========================================================
+  const safeColorDatabase =
+    typeof window !== 'undefined' && window.colorDatabase && typeof window.colorDatabase === 'object'
+      ? window.colorDatabase
+      : {};
+
+  const safeDesignerTemplates =
+    typeof window !== 'undefined' && window.designerTemplates && typeof window.designerTemplates === 'object'
+      ? window.designerTemplates
+      : {};
+
+  const DEFAULT_WALL_COLOR = '#d9d9d9';
+  const DEFAULT_FURNITURE_COLOR = '#8c8c8c';
+
+  const state = {
+    wallSections: 1,
+    activeSection: 0,
+    wallColors: [DEFAULT_WALL_COLOR, DEFAULT_WALL_COLOR, DEFAULT_WALL_COLOR, DEFAULT_WALL_COLOR],
+    furnitureColor: DEFAULT_FURNITURE_COLOR,
+    lightOn: true,
+    lightTemperature: 50, // 0 = warm, 100 = cold
+    suggestions: {
+      similar: [],
+      contrast: [],
+      monochrome: []
+    }
+  };
+
+  // ==========================================================
+  // DOM helpers (null-safe)
+  // ==========================================================
+  const q = (sel) => (typeof document !== 'undefined' ? document.querySelector(sel) : null);
+  const qa = (sel) => (typeof document !== 'undefined' ? Array.from(document.querySelectorAll(sel)) : []);
+
+  const dom = {
+    roomPreview: q('[data-room-preview]') || q('#roomPreview') || q('.room-preview'),
+    wallPreview: q('[data-wall-preview]') || q('#wallPreview') || q('.wall-preview'),
+    furniturePreview: q('[data-furniture-preview]') || q('#furniturePreview') || q('.furniture-preview'),
+
+    sectionCountInput: q('[data-section-count]') || q('#sectionCount'),
+    sectionButtons: qa('[data-section-index]'),
+
+    wallHexInput: q('[data-wall-hex]') || q('#wallHex'),
+    wallPicker: q('[data-wall-picker]') || q('#wallPicker') || q('input[type="color"][name="wallColor"]'),
+    furnitureHexInput: q('[data-furniture-hex]') || q('#furnitureHex'),
+    furniturePicker: q('[data-furniture-picker]') || q('#furniturePicker') || q('input[type="color"][name="furnitureColor"]'),
+
+    applyWallColorBtn: q('[data-apply-wall-color]') || q('#applyWallColor'),
+    applyFurnitureColorBtn: q('[data-apply-furniture-color]') || q('#applyFurnitureColor'),
+
+    catalogSelect: q('[data-color-catalog]') || q('#colorCatalog'),
+    catalogColorSelect: q('[data-catalog-color]') || q('#catalogColor'),
+    applyCatalogColorBtn: q('[data-apply-catalog-color]') || q('#applyCatalogColor'),
+    targetSelect: q('[data-color-target]') || q('#colorTarget'),
+
+    templateSelect: q('[data-template-select]') || q('#templateSelect'),
+    applyTemplateBtn: q('[data-apply-template]') || q('#applyTemplate'),
+
+    similarList: q('[data-similar-list]') || q('#similarColors'),
+    contrastList: q('[data-contrast-list]') || q('#contrastColors'),
+    monochromeList: q('[data-monochrome-list]') || q('#monochromeColors'),
+    generateHarmonyBtn: q('[data-generate-harmony]') || q('#generateHarmony'),
+
+    lightToggle: q('[data-light-toggle]') || q('#lightToggle'),
+    lightTemperature: q('[data-light-temperature]') || q('#lightTemperature'),
+    lightModeText: q('[data-light-mode]') || q('#lightMode')
+  };
+
+  // ==========================================================
+  // Color math
+  // ==========================================================
+  function normalizeHex(input) {
+    if (typeof input !== 'string') return null;
+    let hex = input.trim().toUpperCase();
+    if (!hex) return null;
+
+    if (!hex.startsWith('#')) hex = `#${hex}`;
+    if (/^#[0-9A-F]{3}$/.test(hex)) {
+      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
+    }
+
+    return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
+  }
+
+  function hexToRgb(hex) {
+    const normalized = normalizeHex(hex);
+    if (!normalized) return null;
+    const value = normalized.slice(1);
+    return {
+      r: parseInt(value.slice(0, 2), 16),
+      g: parseInt(value.slice(2, 4), 16),
+      b: parseInt(value.slice(4, 6), 16)
+    };
+  }
+
+  function rgbToHex(r, g, b) {
+    const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
+    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
+  }
+
+  function rgbToHsl(r, g, b) {
+    const nr = r / 255;
+    const ng = g / 255;
+    const nb = b / 255;
+    const max = Math.max(nr, ng, nb);
+    const min = Math.min(nr, ng, nb);
+    const d = max - min;
+
+    let h = 0;
+    const l = (max + min) / 2;
+    let s = 0;
+
+    if (d !== 0) {
+      s = d / (1 - Math.abs(2 * l - 1));
+      switch (max) {
+        case nr:
+          h = 60 * (((ng - nb) / d) % 6);
+          break;
+        case ng:
+          h = 60 * ((nb - nr) / d + 2);
+          break;
+        case nb:
+          h = 60 * ((nr - ng) / d + 4);
+          break;
+      }
+    }
+
+    if (h < 0) h += 360;
+
+    return { h, s: s * 100, l: l * 100 };
+  }
+
+  function hslToRgb(h, s, l) {
+    const ns = Math.max(0, Math.min(100, s)) / 100;
+    const nl = Math.max(0, Math.min(100, l)) / 100;
+    const c = (1 - Math.abs(2 * nl - 1)) * ns;
+    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
+    const m = nl - c / 2;
+
+    let r1 = 0;
+    let g1 = 0;
+    let b1 = 0;
+
+    if (h >= 0 && h < 60) {
+      r1 = c;
+      g1 = x;
+    } else if (h < 120) {
+      r1 = x;
+      g1 = c;
+    } else if (h < 180) {
+      g1 = c;
+      b1 = x;
+    } else if (h < 240) {
+      g1 = x;
+      b1 = c;
+    } else if (h < 300) {
+      r1 = x;
+      b1 = c;
+    } else {
+      r1 = c;
+      b1 = x;
+    }
+
+    return {
+      r: (r1 + m) * 255,
+      g: (g1 + m) * 255,
+      b: (b1 + m) * 255
+    };
+  }
+
+  function hexToHsl(hex) {
+    const rgb = hexToRgb(hex);
+    if (!rgb) return null;
+    return rgbToHsl(rgb.r, rgb.g, rgb.b);
+  }
+
+  function hslToHex(h, s, l) {
+    const rgb = hslToRgb((h + 360) % 360, s, l);
+    return rgbToHex(rgb.r, rgb.g, rgb.b);
+  }
+
+  // ==========================================================
+  // Rendering
+  // ==========================================================
+  function buildWallGradient() {
+    const activeColors = state.wallColors.slice(0, state.wallSections);
+    if (!activeColors.length) return DEFAULT_WALL_COLOR;
+
+    const step = 100 / activeColors.length;
+    const parts = activeColors.flatMap((color, i) => {
+      const start = (i * step).toFixed(2);
+      const end = ((i + 1) * step).toFixed(2);
+      return [`${color} ${start}%`, `${color} ${end}%`];
+    });
+
+    return `linear-gradient(90deg, ${parts.join(', ')})`;
+  }
+
+  function renderWallSectionsButtons() {
+    if (!dom.sectionButtons || dom.sectionButtons.length === 0) return;
+
+    dom.sectionButtons.forEach((btn) => {
+      if (!btn) return;
+      const idx = Number(btn.getAttribute('data-section-index'));
+      const enabled = idx >= 0 && idx < state.wallSections;
+
+      btn.disabled = !enabled;
+      btn.classList.toggle('is-active', idx === state.activeSection);
+      btn.style.opacity = enabled ? '1' : '0.4';
+    });
+  }
+
+  function renderPreviews() {
+    if (dom.wallPreview) {
+      dom.wallPreview.style.background = buildWallGradient();
+    }
+
+    if (dom.furniturePreview) {
+      dom.furniturePreview.style.backgroundColor = state.furnitureColor;
+    }
+
+    if (dom.roomPreview) {
+      dom.roomPreview.style.setProperty('--wall-gradient', buildWallGradient());
+      dom.roomPreview.style.setProperty('--furniture-color', state.furnitureColor);
+    }
+
+    if (dom.wallPicker) dom.wallPicker.value = state.wallColors[state.activeSection] || DEFAULT_WALL_COLOR;
+    if (dom.wallHexInput) dom.wallHexInput.value = state.wallColors[state.activeSection] || DEFAULT_WALL_COLOR;
+
+    if (dom.furniturePicker) dom.furniturePicker.value = state.furnitureColor;
+    if (dom.furnitureHexInput) dom.furnitureHexInput.value = state.furnitureColor;
+
+    renderWallSectionsButtons();
+    renderLight();
+  }
+
+  function renderLight() {
+    const t = state.lightTemperature;
+    const warmColor = `rgba(255, 214, 170, ${(100 - t) / 200})`;
+    const coldColor = `rgba(190, 225, 255, ${t / 200})`;
+
+    if (dom.roomPreview) {
+      dom.roomPreview.style.boxShadow = state.lightOn
+        ? `inset 0 0 180px ${warmColor}, inset 0 0 140px ${coldColor}`
+        : 'none';
+      dom.roomPreview.style.filter = state.lightOn ? 'brightness(1)' : 'brightness(0.7)';
+    }
+
+    if (dom.lightModeText) {
+      if (!state.lightOn) {
+        dom.lightModeText.textContent = 'Свет выключен';
+      } else {
+        dom.lightModeText.textContent = t < 50 ? 'Тёплый свет' : t > 50 ? 'Холодный свет' : 'Нейтральный свет';
+      }
+    }
+  }
+
+  function renderPalette(listElement, colors) {
+    if (!listElement) return;
+    listElement.innerHTML = '';
+
+    colors.forEach((hex) => {
+      const btn = document.createElement('button');
+      btn.type = 'button';
+      btn.className = 'palette-color';
+      btn.title = hex;
+      btn.textContent = hex;
+      btn.style.background = hex;
+      btn.style.color = '#111';
+      btn.style.border = '1px solid rgba(0,0,0,0.2)';
+      btn.style.margin = '2px';
+      btn.style.padding = '4px 8px';
+      btn.style.cursor = 'pointer';
+
+      btn.addEventListener('click', () => {
+        applyColor(hex, 'wall', state.activeSection);
+      });
+
+      listElement.appendChild(btn);
+    });
+  }
+
+  // ==========================================================
+  // Core actions
+  // ==========================================================
+  function applyColor(rawHex, target = 'wall', wallSectionIndex = state.activeSection) {
+    const hex = normalizeHex(rawHex);
+    if (!hex) return false;
+
+    if (target === 'furniture') {
+      state.furnitureColor = hex;
+    } else {
+      const idx = Math.max(0, Math.min(3, Number(wallSectionIndex) || 0));
+      state.wallColors[idx] = hex;
+      state.activeSection = idx;
+    }
+
+    renderPreviews();
+    console.log('COLOR APPLIED', { target, hex, section: wallSectionIndex });
+    return true;
+  }
+
+  function setWallSections(count) {
+    const next = Math.max(1, Math.min(4, Number(count) || 1));
+    state.wallSections = next;
+
+    if (state.activeSection >= next) {
+      state.activeSection = next - 1;
+    }
+
+    renderPreviews();
+  }
+
+  function getCatalogs() {
+    const raw = safeColorDatabase;
+    const maybeCatalogs = raw.catalogs && typeof raw.catalogs === 'object' ? raw.catalogs : raw;
+
+    const out = {};
+    Object.entries(maybeCatalogs).forEach(([name, value]) => {
+      if (value && typeof value === 'object') {
+        out[name] = value;
+      }
+    });
+
+    return out;
+  }
+
+  function fillCatalogUI() {
+    const catalogs = getCatalogs();
+    if (dom.catalogSelect) {
+      dom.catalogSelect.innerHTML = '';
+      Object.keys(catalogs).forEach((name) => {
+        const opt = document.createElement('option');
+        opt.value = name;
+        opt.textContent = name;
+        dom.catalogSelect.appendChild(opt);
+      });
+    }
+
+    updateCatalogColors();
+  }
+
+  function updateCatalogColors() {
+    if (!dom.catalogColorSelect) return;
+
+    const catalogs = getCatalogs();
+    const catalogName = dom.catalogSelect ? dom.catalogSelect.value : Object.keys(catalogs)[0];
+    const catalog = catalogName ? catalogs[catalogName] : null;
+
+    dom.catalogColorSelect.innerHTML = '';
+
+    if (!catalog) return;
+
+    Object.entries(catalog).forEach(([name, hex]) => {
+      const valid = normalizeHex(String(hex));
+      if (!valid) return;
+
+      const opt = document.createElement('option');
+      opt.value = valid;
+      opt.textContent = `${name} (${valid})`;
+      dom.catalogColorSelect.appendChild(opt);
+    });
+  }
+
+  function getTemplates() {
+    return safeDesignerTemplates.templates && typeof safeDesignerTemplates.templates === 'object'
+      ? safeDesignerTemplates.templates
+      : safeDesignerTemplates;
+  }
+
+  function fillTemplateUI() {
+    if (!dom.templateSelect) return;
+
+    const templates = getTemplates();
+    dom.templateSelect.innerHTML = '';
+
+    Object.keys(templates).forEach((name) => {
+      const t = templates[name];
+      if (!t || typeof t !== 'object') return;
+
+      const opt = document.createElement('option');
+      opt.value = name;
+      opt.textContent = name;
+      dom.templateSelect.appendChild(opt);
+    });
+  }
+
+  function applyDesignerTemplate(templateName) {
+    const templates = getTemplates();
+    const template = templates[templateName];
+    if (!template || typeof template !== 'object') return false;
+
+    const primary = normalizeHex(template.primary || template.main || template.base || '');
+    const secondary = normalizeHex(template.secondary || template.second || '');
+    const accent = normalizeHex(template.accent || '');
+
+    const ratio = {
+      main: Number(template.mainPercent ?? template.main ?? 60) || 60,
+      secondary: Number(template.secondaryPercent ?? template.secondaryRatio ?? 30) || 30,
+      accent: Number(template.accentPercent ?? template.accentRatio ?? 10) || 10
+    };
+
+    // 60 / 30 / 10 interpretation:
+    // - main -> most wall sections
+    // - secondary -> one wall section
+    // - accent -> furniture OR extra wall section
+    if (primary) {
+      state.wallColors[0] = primary;
+      state.wallColors[1] = primary;
+    }
+
+    if (secondary) {
+      state.wallColors[2] = secondary;
+    }
+
+    const accentTarget = (template.accentTarget || '').toLowerCase();
+    const accentToFurniture = accentTarget === 'furniture' || ratio.accent <= 10;
+
+    if (accent) {
+      if (accentToFurniture) {
+        state.furnitureColor = accent;
+      } else {
+        state.wallColors[3] = accent;
+      }
+    }
+
+    state.wallSections = accentToFurniture ? 3 : 4;
+    state.activeSection = 0;
+    renderPreviews();
+
+    return true;
+  }
+
+  function generateHarmonyPalette(baseHex) {
+    const base = hexToHsl(baseHex);
+    if (!base) return null;
+
+    const similar = [
+      hslToHex(base.h - 20, Math.min(100, base.s + 5), Math.min(90, base.l + 4)),
+      hslToHex(base.h - 10, base.s, base.l),
+      hslToHex(base.h + 10, base.s, base.l),
+      hslToHex(base.h + 20, Math.max(0, base.s - 5), Math.max(10, base.l - 4))
+    ];
+
+    const contrast = [
+      hslToHex(base.h + 180, base.s, base.l),
+      hslToHex(base.h + 150, Math.min(100, base.s + 10), base.l),
+      hslToHex(base.h + 210, Math.max(0, base.s - 10), base.l)
+    ];
+
+    const monochrome = [
+      hslToHex(base.h, base.s, Math.min(95, base.l + 20)),
+      hslToHex(base.h, base.s, Math.min(95, base.l + 10)),
+      hslToHex(base.h, base.s, Math.max(5, base.l - 10)),
+      hslToHex(base.h, base.s, Math.max(5, base.l - 20))
+    ];
+
+    state.suggestions = { similar, contrast, monochrome };
+    console.log('SIMILAR GENERATED', { baseHex, similarCount: similar.length });
+    return state.suggestions;
+  }
+
+  // ==========================================================
+  // Event binding
+  // ==========================================================
+  function bindEvents() {
+    if (dom.sectionCountInput) {
+      dom.sectionCountInput.addEventListener('input', (e) => {
+        setWallSections(e.target.value);
+      });
+    }
+
+    if (dom.sectionButtons && dom.sectionButtons.length) {
+      dom.sectionButtons.forEach((btn) => {
+        if (!btn) return;
+        btn.addEventListener('click', () => {
+          const idx = Number(btn.getAttribute('data-section-index'));
+          if (Number.isNaN(idx) || idx < 0 || idx >= state.wallSections) return;
+          state.activeSection = idx;
+          renderPreviews();
+        });
+      });
+    }
+
+    if (dom.wallPicker) {
+      dom.wallPicker.addEventListener('input', (e) => {
+        applyColor(e.target.value, 'wall', state.activeSection);
+      });
+    }
+
+    if (dom.furniturePicker) {
+      dom.furniturePicker.addEventListener('input', (e) => {
+        applyColor(e.target.value, 'furniture');
+      });
+    }
+
+    if (dom.applyWallColorBtn) {
+      dom.applyWallColorBtn.addEventListener('click', () => {
+        if (!dom.wallHexInput) return;
+        applyColor(dom.wallHexInput.value, 'wall', state.activeSection);
+      });
+    }
+
+    if (dom.applyFurnitureColorBtn) {
+      dom.applyFurnitureColorBtn.addEventListener('click', () => {
+        if (!dom.furnitureHexInput) return;
+        applyColor(dom.furnitureHexInput.value, 'furniture');
+      });
+    }
+
+    if (dom.catalogSelect) {
+      dom.catalogSelect.addEventListener('change', updateCatalogColors);
+    }
+
+    if (dom.applyCatalogColorBtn) {
+      dom.applyCatalogColorBtn.addEventListener('click', () => {
+        if (!dom.catalogColorSelect) return;
+        const hex = dom.catalogColorSelect.value;
+
+        const target = dom.targetSelect ? dom.targetSelect.value : 'wall';
+        if (target === 'furniture') {
+          applyColor(hex, 'furniture');
+        } else {
+          applyColor(hex, 'wall', state.activeSection);
+        }
+      });
+    }
+
+    if (dom.applyTemplateBtn) {
+      dom.applyTemplateBtn.addEventListener('click', () => {
+        if (!dom.templateSelect) return;
+        applyDesignerTemplate(dom.templateSelect.value);
+      });
+    }
+
+    if (dom.generateHarmonyBtn) {
+      dom.generateHarmonyBtn.addEventListener('click', () => {
+        const baseHex = state.wallColors[state.activeSection] || state.furnitureColor;
+        const generated = generateHarmonyPalette(baseHex);
+        if (!generated) return;
+
+        renderPalette(dom.similarList, generated.similar);
+        renderPalette(dom.contrastList, generated.contrast);
+        renderPalette(dom.monochromeList, generated.monochrome);
+      });
+    }
+
+    if (dom.lightToggle) {
+      dom.lightToggle.addEventListener('change', (e) => {
+        state.lightOn = !!e.target.checked;
+        renderLight();
+      });
+    }
+
+    if (dom.lightTemperature) {
+      dom.lightTemperature.addEventListener('input', (e) => {
+        state.lightTemperature = Math.max(0, Math.min(100, Number(e.target.value) || 0));
+        renderLight();
+      });
+    }
+  }
+
+  function bootstrapInitialValues() {
+    if (dom.sectionCountInput) {
+      const value = Number(dom.sectionCountInput.value);
+      if (!Number.isNaN(value)) setWallSections(value);
+    }
+
+    if (dom.wallPicker && normalizeHex(dom.wallPicker.value)) {
+      state.wallColors[state.activeSection] = normalizeHex(dom.wallPicker.value);
+    }
+
+    if (dom.furniturePicker && normalizeHex(dom.furniturePicker.value)) {
+      state.furnitureColor = normalizeHex(dom.furniturePicker.value);
+    }
+
+    if (dom.lightToggle) {
+      state.lightOn = !!dom.lightToggle.checked;
+    }
+
+    if (dom.lightTemperature) {
+      state.lightTemperature = Math.max(0, Math.min(100, Number(dom.lightTemperature.value) || 50));
+    }
+  }
+
+  function init() {
+    bootstrapInitialValues();
+    fillCatalogUI();
+    fillTemplateUI();
+    bindEvents();
+    renderPreviews();
+
+    console.log('INIT OK');
+  }
+
+  if (typeof document !== 'undefined') {
+    if (document.readyState === 'loading') {
+      document.addEventListener('DOMContentLoaded', init, { once: true });
+    } else {
+      init();
+    }
+  }
+
+  // expose API for debug/manual control
+  if (typeof window !== 'undefined') {
+    window.colorpaint = {
+      state,
+      applyColor,
+      applyDesignerTemplate,
+      generateHarmonyPalette,
+      setWallSections,
+      normalizeHex
+    };
+  }
+})();

