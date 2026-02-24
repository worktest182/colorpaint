(() => {
  'use strict';

  const SUPPORTED_CATALOGS = ['dulux', 'ice parade', 'vision', 'ral'];
  const DEFAULT_WALL_HEX = '#D9D9D9';
  const DEFAULT_FURNITURE_HEX = '#8C8C8C';

  const q = (selector) => (typeof document !== 'undefined' ? document.querySelector(selector) : null);
  const qa = (selector) => (typeof document !== 'undefined' ? Array.from(document.querySelectorAll(selector)) : []);

  const dom = {
    roomPreview: q('[data-room-preview]'),
    wallPreview: q('[data-wall-preview]'),
    furniturePreview: q('[data-furniture-preview]'),

    sectionCountInput: q('[data-section-count]'),
    sectionButtons: qa('[data-section-index]'),

    wallCodeInput: q('[data-wall-hex]'),
    wallPicker: q('[data-wall-picker]'),
    applyWallColorBtn: q('[data-apply-wall-color]'),

    furnitureCodeInput: q('[data-furniture-hex]'),
    furniturePicker: q('[data-furniture-picker]'),
    applyFurnitureColorBtn: q('[data-apply-furniture-color]'),

    catalogSelect: q('[data-color-catalog]'),
    catalogColorSelect: q('[data-catalog-color]'),
    targetSelect: q('[data-color-target]'),
    applyCatalogColorBtn: q('[data-apply-catalog-color]'),

    templateSelect: q('[data-template-select]'),
    applyTemplateBtn: q('[data-apply-template]'),

    generateHarmonyBtn: q('[data-generate-harmony]'),
    similarList: q('[data-similar-list]'),
    contrastList: q('[data-contrast-list]')
  };

  const state = {
    sections: 1,
    activeSection: 0,
    wallHexBySection: [DEFAULT_WALL_HEX, DEFAULT_WALL_HEX, DEFAULT_WALL_HEX, DEFAULT_WALL_HEX],
    furnitureHex: DEFAULT_FURNITURE_HEX
  };

  function sanitizeHex(hex) {
    if (typeof hex !== 'string') return null;
    const value = hex.trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(value) ? value : null;
  }

  function rgbToHsl(r, g, b) {
    const nr = r / 255;
    const ng = g / 255;
    const nb = b / 255;
    const max = Math.max(nr, ng, nb);
    const min = Math.min(nr, ng, nb);
    const d = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      if (max === nr) h = 60 * (((ng - nb) / d) % 6);
      else if (max === ng) h = 60 * ((nb - nr) / d + 2);
      else h = 60 * ((nr - ng) / d + 4);
    }

    if (h < 0) h += 360;
    return { h, s: s * 100, l: l * 100 };
  }

  function hslToRgb(h, s, l) {
    const ns = Math.max(0, Math.min(100, s)) / 100;
    const nl = Math.max(0, Math.min(100, l)) / 100;
    const c = (1 - Math.abs(2 * nl - 1)) * ns;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = nl - c / 2;

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (h < 60) {
      r1 = c;
      g1 = x;
    } else if (h < 120) {
      r1 = x;
      g1 = c;
    } else if (h < 180) {
      g1 = c;
      b1 = x;
    } else if (h < 240) {
      g1 = x;
      b1 = c;
    } else if (h < 300) {
      r1 = x;
      b1 = c;
    } else {
      r1 = c;
      b1 = x;
    }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  function hexToRgb(hex) {
    const valid = sanitizeHex(hex);
    if (!valid) return null;
    const raw = valid.slice(1);
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16)
    };
  }

  function rgbToHex(r, g, b) {
    const asHex = (n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0').toUpperCase();
    return `#${asHex(r)}${asHex(g)}${asHex(b)}`;
  }

  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
  }

  function hslToHex(h, s, l) {
    const rgb = hslToRgb(((h % 360) + 360) % 360, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  function normalizeCatalogName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getCatalogMap() {
    const raw = typeof window !== 'undefined' && window.colorDatabase && typeof window.colorDatabase === 'object'
      ? window.colorDatabase
      : {};

    const result = {};
    Object.entries(raw).forEach(([catalogName, catalog]) => {
      if (!catalog || typeof catalog !== 'object') return;
      const normalizedName = normalizeCatalogName(catalogName);
      if (!SUPPORTED_CATALOGS.includes(normalizedName)) return;

      const entries = [];
      Object.entries(catalog).forEach(([code, hex]) => {
        const validHex = sanitizeHex(String(hex));
        if (!validHex) return;
        entries.push({ code: String(code), hex: validHex });
      });

      if (entries.length > 0) {
        result[normalizedName] = entries;
      }
    });

    return result;
  }

  function findColorByCode(code, catalogName) {
    const inputCode = String(code || '').trim().toLowerCase();
    if (!inputCode) return null;

    const catalogs = getCatalogMap();
    const desiredCatalog = normalizeCatalogName(catalogName);

    const tryFind = (entries, catalogKey) => {
      if (!Array.isArray(entries)) return null;
      const exact = entries.find((item) => item.code.toLowerCase() === inputCode);
      return exact ? { ...exact, catalog: catalogKey } : null;
    };

    if (desiredCatalog && catalogs[desiredCatalog]) {
      const found = tryFind(catalogs[desiredCatalog], desiredCatalog);
      if (found) return found;
    }

    for (const [catalogKey, entries] of Object.entries(catalogs)) {
      const found = tryFind(entries, catalogKey);
      if (found) return found;
    }

    return null;
  }

  function buildWallGradient() {
    const colors = state.wallHexBySection.slice(0, state.sections);
    if (colors.length === 0) return DEFAULT_WALL_HEX;
    if (colors.length === 1) return colors[0];

    const stops = [];
    for (let i = 0; i < colors.length; i += 1) {
      const position = (i / (colors.length - 1)) * 100;
      stops.push(`${colors[i]} ${position.toFixed(2)}%`);
    }

    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }

  function syncInputs() {
    const activeWallHex = state.wallHexBySection[state.activeSection] || DEFAULT_WALL_HEX;

    if (dom.wallPicker) dom.wallPicker.value = activeWallHex;
    if (dom.furniturePicker) dom.furniturePicker.value = state.furnitureHex;

    if (dom.wallCodeInput && document.activeElement !== dom.wallCodeInput) {
      dom.wallCodeInput.value = dom.wallCodeInput.value || '';
    }
    if (dom.furnitureCodeInput && document.activeElement !== dom.furnitureCodeInput) {
      dom.furnitureCodeInput.value = dom.furnitureCodeInput.value || '';
    }
  }

  function renderSectionsUI() {
    if (!Array.isArray(dom.sectionButtons)) return;

    dom.sectionButtons.forEach((button) => {
      if (!button) return;
      const idx = Number(button.getAttribute('data-section-index'));
      const enabled = Number.isInteger(idx) && idx >= 0 && idx < state.sections;
      button.disabled = !enabled;
      button.classList.toggle('is-active', idx === state.activeSection);
      button.setAttribute('aria-pressed', idx === state.activeSection ? 'true' : 'false');
    });
  }

  function renderPreview() {
    const wallGradient = buildWallGradient();

    if (dom.wallPreview) dom.wallPreview.style.background = wallGradient;
    if (dom.furniturePreview) dom.furniturePreview.style.background = state.furnitureHex;

    if (dom.roomPreview) {
      dom.roomPreview.style.setProperty('--wall-gradient', wallGradient);
      dom.roomPreview.style.setProperty('--furniture-color', state.furnitureHex);
    }

    renderSectionsUI();
    syncInputs();
  }

  function applyColorHex(target, hex, sectionIndex = state.activeSection) {
    const validHex = sanitizeHex(hex);
    if (!validHex) return false;

    if (target === 'furniture') {
      state.furnitureHex = validHex;
    } else {
      const idx = Math.max(0, Math.min(3, Number(sectionIndex) || 0));
      state.wallHexBySection[idx] = validHex;
      state.activeSection = idx;
    }

    renderPreview();
    console.log('COLOR APPLIED', { target, hex: validHex, sectionIndex });
    return true;
  }

  function applyByCode(target, code, catalogName) {
    const found = findColorByCode(code, catalogName);
    if (!found) return false;
    return applyColorHex(target, found.hex, state.activeSection);
  }

  function setSections(count) {
    const safeCount = Math.max(1, Math.min(4, Number(count) || 1));
    state.sections = safeCount;
    if (state.activeSection > safeCount - 1) {
      state.activeSection = safeCount - 1;
    }
    renderPreview();
  }

  function fillCatalogSelects() {
    const catalogs = getCatalogMap();

    if (dom.catalogSelect) {
      dom.catalogSelect.innerHTML = '';
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'Выберите базу';
      dom.catalogSelect.appendChild(empty);

      SUPPORTED_CATALOGS.forEach((name) => {
        if (!catalogs[name]) return;
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        dom.catalogSelect.appendChild(option);
      });

      if (dom.catalogSelect.options.length > 1) dom.catalogSelect.selectedIndex = 1;
    }

    updateCatalogColorOptions();
  }

  function updateCatalogColorOptions() {
    if (!dom.catalogColorSelect) return;

    const catalogs = getCatalogMap();
    const selectedCatalog = normalizeCatalogName(dom.catalogSelect ? dom.catalogSelect.value : '');
    const colors = catalogs[selectedCatalog] || [];

    dom.catalogColorSelect.innerHTML = '';

    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Выберите цвет';
    dom.catalogColorSelect.appendChild(empty);

    colors.forEach((entry) => {
      const option = document.createElement('option');
      option.value = entry.code;
      option.textContent = `${entry.code}`;
      dom.catalogColorSelect.appendChild(option);
    });
  }

  function getTemplates() {
    const source = typeof window !== 'undefined' && window.designerTemplates && typeof window.designerTemplates === 'object'
      ? window.designerTemplates
      : {};

    const templates = [];
    Object.entries(source).forEach(([key, template]) => {
      if (!template || typeof template !== 'object') return;
      const main = sanitizeHex(String(template.main || ''));
      const secondary = sanitizeHex(String(template.secondary || ''));
      const accent = sanitizeHex(String(template.accent || ''));
      if (!main || !secondary || !accent) return;
      templates.push({
        key,
        label: String(template.name || key),
        main,
        secondary,
        accent,
        accentTarget: String(template.accentTarget || 'furniture').toLowerCase()
      });
    });

    return templates;
  }

  function fillTemplatesSelect() {
    if (!dom.templateSelect) return;

    dom.templateSelect.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'Выберите шаблон';
    dom.templateSelect.appendChild(empty);

    getTemplates().forEach((template) => {
      const option = document.createElement('option');
      option.value = template.key;
      option.textContent = template.label;
      dom.templateSelect.appendChild(option);
    });
  }

  function applyTemplate(templateKey) {
    const template = getTemplates().find((item) => item.key === templateKey);
    if (!template) return false;

    state.wallHexBySection[0] = template.main;
    state.wallHexBySection[1] = template.main;
    state.wallHexBySection[2] = template.secondary;

    if (template.accentTarget === 'wall') {
      state.sections = 4;
      state.wallHexBySection[3] = template.accent;
    } else {
      state.sections = 3;
      state.furnitureHex = template.accent;
    }

    state.activeSection = 0;
    renderPreview();
    console.log('COLOR APPLIED', { target: 'template', template: template.key });
    return true;
  }

  function renderSuggestionList(listElement, colors) {
    if (!listElement) return;
    listElement.innerHTML = '';

    colors.forEach((hex) => {
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'palette-color';
      button.textContent = hex;
      button.style.background = hex;
      button.style.border = '1px solid rgba(0, 0, 0, 0.2)';
      button.style.color = '#1a1a1a';
      button.style.padding = '4px 8px';
      button.style.cursor = 'pointer';

      button.addEventListener('click', () => {
        applyColorHex('wall', hex, state.activeSection);
      });

      li.appendChild(button);
      listElement.appendChild(li);
    });
  }

  function generateSuggestions() {
    const baseHex = state.wallHexBySection[state.activeSection] || state.furnitureHex;
    const baseHsl = hexToHsl(baseHex);
    if (!baseHsl) return;

    const similar = [
      hslToHex(baseHsl.h - 18, baseHsl.s, Math.min(95, baseHsl.l + 5)),
      hslToHex(baseHsl.h - 8, baseHsl.s, baseHsl.l),
      hslToHex(baseHsl.h + 8, baseHsl.s, baseHsl.l),
      hslToHex(baseHsl.h + 18, baseHsl.s, Math.max(10, baseHsl.l - 5))
    ];

    const contrast = [
      hslToHex(baseHsl.h + 180, baseHsl.s, baseHsl.l),
      hslToHex(baseHsl.h + 150, Math.min(100, baseHsl.s + 10), baseHsl.l),
      hslToHex(baseHsl.h + 210, Math.max(0, baseHsl.s - 10), baseHsl.l)
    ];

    renderSuggestionList(dom.similarList, similar);
    renderSuggestionList(dom.contrastList, contrast);
    console.log('SIMILAR GENERATED', { baseHex, similarCount: similar.length, contrastCount: contrast.length });
  }

  function bindEvents() {
    if (dom.sectionCountInput) {
      dom.sectionCountInput.addEventListener('input', (event) => {
        setSections(event && event.target ? event.target.value : 1);
      });
    }

    if (Array.isArray(dom.sectionButtons)) {
      dom.sectionButtons.forEach((button) => {
        if (!button) return;
        button.addEventListener('click', () => {
          const idx = Number(button.getAttribute('data-section-index'));
          if (!Number.isInteger(idx) || idx < 0 || idx >= state.sections) return;
          state.activeSection = idx;
          renderPreview();
        });
      });
    }

    if (dom.wallPicker) {
      dom.wallPicker.addEventListener('input', (event) => {
        const hex = event && event.target ? event.target.value : '';
        applyColorHex('wall', hex, state.activeSection);
      });
    }

    if (dom.furniturePicker) {
      dom.furniturePicker.addEventListener('input', (event) => {
        const hex = event && event.target ? event.target.value : '';
        applyColorHex('furniture', hex);
      });
    }

    if (dom.applyWallColorBtn) {
      dom.applyWallColorBtn.addEventListener('click', () => {
        const code = dom.wallCodeInput ? dom.wallCodeInput.value : '';
        const catalog = dom.catalogSelect ? dom.catalogSelect.value : '';
        if (!applyByCode('wall', code, catalog) && dom.wallPicker) {
          applyColorHex('wall', dom.wallPicker.value, state.activeSection);
        }
      });
    }

    if (dom.applyFurnitureColorBtn) {
      dom.applyFurnitureColorBtn.addEventListener('click', () => {
        const code = dom.furnitureCodeInput ? dom.furnitureCodeInput.value : '';
        const catalog = dom.catalogSelect ? dom.catalogSelect.value : '';
        if (!applyByCode('furniture', code, catalog) && dom.furniturePicker) {
          applyColorHex('furniture', dom.furniturePicker.value);
        }
      });
    }

    if (dom.catalogSelect) {
      dom.catalogSelect.addEventListener('change', updateCatalogColorOptions);
    }

    if (dom.applyCatalogColorBtn) {
      dom.applyCatalogColorBtn.addEventListener('click', () => {
        const catalog = dom.catalogSelect ? dom.catalogSelect.value : '';
        const codeFromSelect = dom.catalogColorSelect ? dom.catalogColorSelect.value : '';
        const target = dom.targetSelect ? dom.targetSelect.value : 'wall';

        if (!applyByCode(target === 'furniture' ? 'furniture' : 'wall', codeFromSelect, catalog)) {
          return;
        }
      });
    }

    if (dom.applyTemplateBtn) {
      dom.applyTemplateBtn.addEventListener('click', () => {
        const key = dom.templateSelect ? dom.templateSelect.value : '';
        applyTemplate(key);
      });
    }

    if (dom.generateHarmonyBtn) {
      dom.generateHarmonyBtn.addEventListener('click', generateSuggestions);
    }
  }

  function initInputPlaceholders() {
    if (dom.wallCodeInput) dom.wallCodeInput.placeholder = 'Введите цвет';
    if (dom.furnitureCodeInput) dom.furnitureCodeInput.placeholder = 'Введите цвет';
  }

  function init() {
    initInputPlaceholders();
    fillCatalogSelects();
    fillTemplatesSelect();
    bindEvents();
    renderPreview();
    console.log('INIT OK');
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
