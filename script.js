(() => {
  'use strict';

  const CATALOG_ALIASES = {
    dulux: 'dulux',
    vision: 'vision',
    ral: 'ral',
    'ice parade': 'iceparade',
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

  const normalizeCatalog = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

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

  const shiftHex = (hex, delta = 0) => {
    const rgb = parseHex(hex);
    if (!rgb) return '#CCCCCC';
    return rgbToHex(rgb.r + delta, rgb.g + delta, rgb.b + delta);
  };

  const findButtonByText = (container, text) => qa('button', container).find((btn) => btn.textContent && btn.textContent.trim() === text) || null;

  const dom = {
    wallPreview: q('.wall-preview'),
    splitButtonsWrap: q('.split-buttons'),
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

    lightingSection: q('.lighting-section'),
    lightingControls: q('.lighting-controls'),
    warmBtn: findButtonByText(q('.lighting-controls'), 'Теплое'),
    coldBtn: findButtonByText(q('.lighting-controls'), 'Холодное'),
    brightnessSlider: q('.lighting-controls input[type="range"]')
  };

  const state = {
    activeSection: 0,
    sections: Math.max(1, Math.min(4, dom.splitButtons.length || 1)),
    sectionColors: ['#D9D9D9', '#D9D9D9', '#D9D9D9', '#D9D9D9'],
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

  const getTemplates = () => {
    if (typeof window === 'undefined' || !window.designerTemplates || typeof window.designerTemplates !== 'object') return {};
    return window.designerTemplates;
  };

  const resolveColorByCode = (rawInput) => {
    const input = String(rawInput || '').trim();
    if (!input) return null;

    const db = getColorDb();
    const withCatalog = input.match(/^([^:]+):\s*(.+)$/);
    const codeOnly = withCatalog ? withCatalog[2].trim() : input;

    if (withCatalog) {
      const catalogName = normalizeCatalog(withCatalog[1]);
      const key = CATALOG_ALIASES[catalogName];
      if (!key || !db[key]) return null;
      const hex = normalizeHex(String(db[key][codeOnly] || ''));
      return hex ? { code: codeOnly, hex, catalog: key } : null;
    }

    const catalogs = ['dulux', 'vision', 'iceparade', 'ral'];
    for (let i = 0; i < catalogs.length; i += 1) {
      const catalog = catalogs[i];
      const source = db[catalog];
      if (!source || typeof source !== 'object') continue;
      const hex = normalizeHex(String(source[codeOnly] || ''));
      if (hex) return { code: codeOnly, hex, catalog };
    }

    return null;
  };

  const renderWall = () => {
    if (!dom.wallPreview) return;
    const slice = state.sectionColors.slice(0, state.sections);
    const gradient = slice.length === 1
      ? slice[0]
      : `linear-gradient(90deg, ${slice.map((hex, idx) => {
          const start = (idx * 100) / state.sections;
          const end = ((idx + 1) * 100) / state.sections;
          return `${hex} ${start}%, ${hex} ${end}%`;
        }).join(', ')})`;
    dom.wallPreview.style.background = gradient;
  };

  const renderActiveSection = () => {
    dom.splitButtons.forEach((btn, idx) => {
      const active = idx === state.activeSection;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
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

  const logApplied = (payload) => {
    console.log('COLOR APPLIED', payload);
  };

  const applyColor = ({ code, hex, section }) => {
    const validHex = normalizeHex(hex);
    if (!validHex) return;
    const targetSection = Math.max(0, Math.min(state.sections - 1, Number(section)));
    state.sectionColors[targetSection] = validHex;
    state.activeSection = targetSection;
    renderActiveSection();
    renderWall();
    applyLighting();
    logApplied({ code: code || 'manual', hex: validHex, section: targetSection + 1 });
  };

  const createSuggestionBlock = (hex) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = hex;
    btn.style.background = hex;
    btn.style.border = '1px solid rgba(0,0,0,0.2)';
    btn.style.padding = '8px';
    btn.style.cursor = 'pointer';
    btn.style.marginRight = '6px';
    btn.style.marginBottom = '6px';
    btn.addEventListener('click', () => {
      applyColor({ code: 'generated', hex, section: state.activeSection });
    });
    return btn;
  };

  const renderSuggestions = (container, list) => {
    if (!container) return;
    container.innerHTML = '';
    list.forEach((hex) => {
      container.appendChild(createSuggestionBlock(hex));
    });
  };

  const generateSimilar = () => {
    const base = state.sectionColors[state.activeSection] || '#D9D9D9';
    const colors = [shiftHex(base, 15), shiftHex(base, 30), shiftHex(base, -10), shiftHex(base, -25)];
    renderSuggestions(dom.similarList, colors);
    console.log('SIMILAR GENERATED', { type: 'similar', base, count: colors.length });
  };

  const generateContrast = () => {
    const base = parseHex(state.sectionColors[state.activeSection] || '#D9D9D9');
    if (!base) return;
    const inv = rgbToHex(255 - base.r, 255 - base.g, 255 - base.b);
    const colors = [inv, shiftHex(inv, 20), shiftHex(inv, -20)];
    renderSuggestions(dom.contrastList, colors);
    console.log('SIMILAR GENERATED', { type: 'contrast', base: state.sectionColors[state.activeSection], count: colors.length });
  };

  const applyTemplate = (templateKey) => {
    const templates = getTemplates();
    const tpl = templates[templateKey];
    if (!tpl) return;

    const main = normalizeHex(String(tpl.main || ''));
    const secondary = normalizeHex(String(tpl.secondary || ''));
    const accent = normalizeHex(String(tpl.accent || ''));
    if (!main || !secondary || !accent) return;

    state.sections = Math.max(1, Math.min(4, dom.splitButtons.length || 4));
    const total = state.sections;
    const mainCount = Math.max(1, Math.round(total * 0.6));
    const secondaryCount = Math.max(1, Math.round(total * 0.3));
    let accentCount = Math.max(1, total - mainCount - secondaryCount);

    let idx = 0;
    for (; idx < mainCount && idx < total; idx += 1) state.sectionColors[idx] = main;
    for (let j = 0; j < secondaryCount && idx < total; j += 1, idx += 1) state.sectionColors[idx] = secondary;
    for (let k = 0; k < accentCount && idx < total; k += 1, idx += 1) state.sectionColors[idx] = accent;

    while (idx < total) {
      state.sectionColors[idx] = accent;
      idx += 1;
    }

    state.activeSection = 0;
    renderActiveSection();
    renderWall();
    applyLighting();
    console.log('TEMPLATE APPLIED', { template: templateKey, rule: '60/30/10', colors: { main, secondary, accent } });
  };

  const setupTemplateUi = () => {
    const templates = getTemplates();
    const keys = Object.keys(templates);
    if (!dom.templateHost || keys.length === 0) return;

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

    if (dom.generateSimilarBtn) dom.generateSimilarBtn.addEventListener('click', generateSimilar);
    if (dom.generateContrastBtn) dom.generateContrastBtn.addEventListener('click', generateContrast);

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
    renderWall();
    applyLighting();
    setupTemplateUi();
    bindEvents();
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
