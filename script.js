(() => {
  'use strict';

  const ALLOWED_CATALOGS = ['dulux', 'iceparade', 'vision', 'ral'];
  const CATALOG_ALIASES = {
    dulux: 'dulux',
    vision: 'vision',
    ral: 'ral',
    'ice parade': 'iceparade',
    'ice-parade': 'iceparade',
    iceparade: 'iceparade'
  };

  const q = (selector, root = document) => {
    if (!root || typeof root.querySelector !== 'function') return null;
    return root.querySelector(selector);
  };

  const qa = (selector, root = document) => {
    if (!root || typeof root.querySelectorAll !== 'function') return [];
    return Array.from(root.querySelectorAll(selector));
  };

  const normalizeHex = (value) => {
    if (typeof value !== 'string') return null;
    const hex = value.trim().toUpperCase();
    return /^#[0-9A-F]{6}$/.test(hex) ? hex : null;
  };

  const normalizeCatalog = (value) => String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  const parseHex = (hex) => {
    const valid = normalizeHex(hex);
    if (!valid) return null;
    return {
      r: parseInt(valid.slice(1, 3), 16),
      g: parseInt(valid.slice(3, 5), 16),
      b: parseInt(valid.slice(5, 7), 16)
    };
  };

  const rgbToHex = (r, g, b) => {
    const part = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
    return `#${part(r)}${part(g)}${part(b)}`;
  };

  const rgbToHsl = (r, g, b) => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const d = max - min;
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
      s = d / (1 - Math.abs(2 * l - 1));
      switch (max) {
        case rn:
          h = 60 * (((gn - bn) / d) % 6);
          break;
        case gn:
          h = 60 * ((bn - rn) / d + 2);
          break;
        default:
          h = 60 * ((rn - gn) / d + 4);
      }
    }

    if (h < 0) h += 360;
    return { h, s, l };
  };

  const hueDistance = (a, b) => {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
  };

  const findButtonByText = (container, text) => qa('button', container).find((btn) => btn.textContent && btn.textContent.trim() === text) || null;

  const dom = {
    wallPreview: q('.wall-preview'),
    splitButtons: qa('.split-buttons button'),
    colorInput: q('.color-input-group input[type="text"]'),
    applyColorButton: findButtonByText(q('.color-input-group'), 'Применить цвет'),

    generateSimilarBtn: findButtonByText(q('.matching-actions'), 'Генерировать похожие'),
    generateContrastBtn: findButtonByText(q('.matching-actions'), 'Генерировать контрастные'),
    similarList: q('.matching-results > div:first-child .color-result-list'),
    contrastList: q('.matching-results > div:last-child .color-result-list'),

    templateModal: q('#templateModal'),
    openTemplateBtn: q('[data-open-template-modal]'),
    closeTemplateBtn: q('[data-close-template-modal]'),
    templateHost: q('.designer-templates details'),

    lightingControls: q('.lighting-controls'),
    warmBtn: findButtonByText(q('.lighting-controls'), 'Теплое'),
    coldBtn: findButtonByText(q('.lighting-controls'), 'Холодное'),
    brightnessSlider: q('.lighting-controls input[type="range"]')
  };

  const state = {
    activeSection: 0,
    sections: Math.max(1, Math.min(4, dom.splitButtons.length || 1)),
    sectionColors: ['#D9D9D9', '#D9D9D9', '#D9D9D9', '#D9D9D9'],
    generationTick: 0,
    templatesRendered: false,
    lighting: {
      mode: 'warm',
      brightness: dom.brightnessSlider ? Number(dom.brightnessSlider.value || 50) : 50,
      off: false
    }
  };

  const getColorDb = () => {
    if (typeof window === 'undefined' || !window.colorDatabase || typeof window.colorDatabase !== 'object') return {};
    return window.colorDatabase;
  };

  const getCatalogMap = () => {
    const db = getColorDb();
    const map = {};

    Object.keys(db || {}).forEach((rawKey) => {
      const normalized = normalizeCatalog(rawKey);
      const canonical = CATALOG_ALIASES[normalized] || normalized.replace(/\s+/g, '');
      if (!ALLOWED_CATALOGS.includes(canonical)) return;
      const source = db[rawKey];
      if (!source || typeof source !== 'object') return;
      map[canonical] = source;
    });

    return map;
  };

  const getTemplates = () => {
    if (typeof window === 'undefined' || !window.designerTemplates || typeof window.designerTemplates !== 'object') return {};
    return window.designerTemplates;
  };

  const resolveColorByCode = (rawInput) => {
    const input = String(rawInput || '').trim();
    if (!input) return null;

    const asHex = normalizeHex(input);
    if (asHex) return { code: 'hex', hex: asHex, catalog: 'manual' };

    const catalogMap = getCatalogMap();
    const withCatalog = input.match(/^([^:]+):\s*(.+)$/);
    const codeOnly = withCatalog ? withCatalog[2].trim() : input;

    if (withCatalog) {
      const catalogName = normalizeCatalog(withCatalog[1]);
      const key = CATALOG_ALIASES[catalogName] || catalogName.replace(/\s+/g, '');
      const source = catalogMap[key];
      if (!source) return null;
      const hex = normalizeHex(String(source[codeOnly] || ''));
      return hex ? { code: codeOnly, hex, catalog: key } : null;
    }

    for (let i = 0; i < ALLOWED_CATALOGS.length; i += 1) {
      const catalog = ALLOWED_CATALOGS[i];
      const source = catalogMap[catalog];
      if (!source) continue;
      const hex = normalizeHex(String(source[codeOnly] || ''));
      if (hex) return { code: codeOnly, hex, catalog };
    }

    return null;
  };

  const getPaletteFromDatabase = () => {
    const catalogMap = getCatalogMap();
    const palette = [];

    ALLOWED_CATALOGS.forEach((catalog) => {
      const source = catalogMap[catalog];
      if (!source) return;
      Object.keys(source).forEach((code) => {
        const hex = normalizeHex(String(source[code] || ''));
        const rgb = parseHex(hex);
        if (!hex || !rgb) return;
        palette.push({ code, hex, catalog, hsl: rgbToHsl(rgb.r, rgb.g, rgb.b) });
      });
    });

    return palette;
  };

  const renderWall = () => {
    if (!dom.wallPreview) return;
    dom.wallPreview.innerHTML = '';
    dom.wallPreview.style.background = 'transparent';

    for (let idx = 0; idx < state.sections; idx += 1) {
      const part = document.createElement('div');
      part.className = 'wall-split-section';
      if (idx === state.activeSection) part.classList.add('is-active');
      part.style.backgroundColor = state.sectionColors[idx] || '#D9D9D9';
      part.setAttribute('data-section', String(idx + 1));
      part.setAttribute('aria-hidden', 'true');
      dom.wallPreview.appendChild(part);
    }
  };

  const renderActiveSection = () => {
    dom.splitButtons.forEach((btn, idx) => {
      const active = idx === state.activeSection;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    renderWall();
  };

  const applyLighting = () => {
    if (!dom.wallPreview) return;
    if (state.lighting.off) {
      dom.wallPreview.style.filter = 'brightness(0.5) saturate(0.7)';
      return;
    }

    const brightness = Math.max(0, Math.min(100, state.lighting.brightness));
    const brightnessFactor = 0.7 + brightness / 100;
    const warmShift = state.lighting.mode === 'warm' ? 'sepia(0.25) hue-rotate(-10deg)' : 'sepia(0.05) hue-rotate(8deg)';
    dom.wallPreview.style.filter = `brightness(${brightnessFactor}) ${warmShift}`;
  };

  const applyColor = ({ code, hex, section }) => {
    const validHex = normalizeHex(hex);
    if (!validHex) return;
    const targetSection = Math.max(0, Math.min(state.sections - 1, Number(section)));
    state.sectionColors[targetSection] = validHex;
    state.activeSection = targetSection;
    renderActiveSection();
    applyLighting();
    console.log('COLOR APPLIED', { code: code || 'manual', hex: validHex, section: targetSection + 1 });
  };

  const createSuggestionBlock = (entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${entry.catalog.toUpperCase()} ${entry.code} · ${entry.hex}`;
    btn.style.background = entry.hex;
    btn.style.border = '1px solid rgba(0,0,0,0.25)';
    btn.style.padding = '8px';
    btn.style.cursor = 'pointer';
    btn.style.marginRight = '6px';
    btn.style.marginBottom = '6px';
    btn.style.color = '#111827';
    btn.addEventListener('click', () => {
      applyColor({ code: `${entry.catalog}:${entry.code}`, hex: entry.hex, section: state.activeSection });
    });
    return btn;
  };

  const renderSuggestions = (container, list) => {
    if (!container) return;
    container.innerHTML = '';
    list.forEach((entry) => {
      container.appendChild(createSuggestionBlock(entry));
    });
  };

  const rankPaletteByHarmony = (baseHex, mode) => {
    const palette = getPaletteFromDatabase();
    const baseRgb = parseHex(baseHex);
    if (!baseRgb || palette.length === 0) return [];

    const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
    const tick = state.generationTick;
    const offsets = mode === 'similar'
      ? [0, 10 + tick * 3, -10 - tick * 2, 22 + tick * 2, -22 - tick * 3]
      : [180, 150 + tick * 4, -150 - tick * 4, 210 + tick * 2, -210 - tick * 2];

    return palette
      .map((entry) => {
        const targetHue = (baseHsl.h + offsets[Math.floor(Math.random() * offsets.length)] + 360) % 360;
        const hueScore = hueDistance(entry.hsl.h, targetHue);
        const satScore = Math.abs(entry.hsl.s - baseHsl.s) * (mode === 'similar' ? 80 : 35);
        const lightScore = Math.abs(entry.hsl.l - baseHsl.l) * (mode === 'similar' ? 70 : 45);
        return { entry, score: hueScore + satScore + lightScore };
      })
      .sort((a, b) => a.score - b.score)
      .map((item) => item.entry);
  };

  const pickFiveUnique = (entries, baseHex) => {
    const unique = [];
    const seen = new Set([String(baseHex || '').toUpperCase()]);

    entries.forEach((entry) => {
      if (unique.length >= 5) return;
      if (seen.has(entry.hex)) return;
      unique.push(entry);
      seen.add(entry.hex);
    });

    return unique.slice(0, 5);
  };

  const generateByMode = (mode) => {
    state.generationTick += 1;
    const base = state.sectionColors[state.activeSection] || '#D9D9D9';
    const ranked = rankPaletteByHarmony(base, mode);
    const colors = pickFiveUnique(ranked, base);
    const target = mode === 'similar' ? dom.similarList : dom.contrastList;
    renderSuggestions(target, colors);
    console.log('SIMILAR GENERATED', { type: mode, base, count: colors.length });
  };

  const applyTemplate = (templateKey) => {
    const templates = getTemplates();
    const tpl = templates[templateKey];
    if (!tpl) return;

    const main = normalizeHex(String(tpl.main || ''));
    const secondary = normalizeHex(String(tpl.secondary || ''));
    if (!main || !secondary) return;

    state.sections = Math.max(1, Math.min(4, dom.splitButtons.length || 4));
    for (let idx = 0; idx < state.sections; idx += 1) {
      state.sectionColors[idx] = idx % 2 === 0 ? main : secondary;
    }

    state.activeSection = 0;
    renderActiveSection();
    applyLighting();
  };

  const setupTemplateUi = () => {
    if (!dom.templateHost || state.templatesRendered) return;
    const templates = getTemplates();
    const keys = Object.keys(templates || {});
    if (keys.length === 0) return;

    const list = document.createElement('div');
    list.setAttribute('data-template-list', 'true');

    keys.forEach((key) => {
      const item = templates[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = item && item.name ? item.name : key;
      btn.style.marginRight = '8px';
      btn.style.marginTop = '8px';
      btn.addEventListener('click', () => applyTemplate(key));
      list.appendChild(btn);
    });

    dom.templateHost.appendChild(list);
    state.templatesRendered = true;
  };

  const bindEvents = () => {
    dom.splitButtons.forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        state.activeSection = idx;
        renderActiveSection();
      });
    });

    if (dom.applyColorButton) {
      dom.applyColorButton.addEventListener('click', () => {
        const input = dom.colorInput ? dom.colorInput.value : '';
        const found = resolveColorByCode(input);
        if (!found) return;
        applyColor({ code: `${found.catalog}:${found.code}`, hex: found.hex, section: state.activeSection });
      });
    }

    if (dom.colorInput) {
      dom.colorInput.addEventListener('keydown', (event) => {
        if (!event || event.key !== 'Enter') return;
        const found = resolveColorByCode(dom.colorInput.value);
        if (!found) return;
        applyColor({ code: `${found.catalog}:${found.code}`, hex: found.hex, section: state.activeSection });
      });
    }

    if (dom.generateSimilarBtn) dom.generateSimilarBtn.addEventListener('click', () => generateByMode('similar'));
    if (dom.generateContrastBtn) dom.generateContrastBtn.addEventListener('click', () => generateByMode('contrast'));

    if (dom.openTemplateBtn && dom.templateModal && typeof dom.templateModal.showModal === 'function') {
      dom.openTemplateBtn.addEventListener('click', () => dom.templateModal.showModal());
    }
    if (dom.closeTemplateBtn && dom.templateModal && typeof dom.templateModal.close === 'function') {
      dom.closeTemplateBtn.addEventListener('click', () => dom.templateModal.close());
    }

    if (dom.warmBtn) {
      dom.warmBtn.addEventListener('click', () => {
        state.lighting.mode = 'warm';
        state.lighting.off = false;
        applyLighting();
      });
    }

    if (dom.coldBtn) {
      dom.coldBtn.addEventListener('click', () => {
        state.lighting.mode = 'cold';
        state.lighting.off = false;
        applyLighting();
      });
    }

    if (dom.brightnessSlider) {
      dom.brightnessSlider.addEventListener('input', (event) => {
        state.lighting.brightness = Number(event && event.target ? event.target.value : state.lighting.brightness);
        state.lighting.off = false;
        applyLighting();
      });
    }

    if (dom.lightingControls) {
      const offBtn = document.createElement('button');
      offBtn.type = 'button';
      offBtn.textContent = 'Выключить свет';
      offBtn.addEventListener('click', () => {
        state.lighting.off = true;
        applyLighting();
      });
      dom.lightingControls.appendChild(offBtn);
    }
  };

  const init = () => {
    renderActiveSection();
    applyLighting();
    setupTemplateUi();
    bindEvents();
    if (typeof window !== 'undefined') {
      window.addEventListener('load', setupTemplateUi, { once: true });
    }
    console.log('INIT OK');
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
