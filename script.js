import { colorDatabase, findColorById, findNearestColorByRgb } from './colorDatabase.js';

(() => {
  'use strict';

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
    const hex = value.trim().toLowerCase();
    return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
  };

  const parseHexToRgb = (hex) => {
    const validHex = normalizeHex(hex);
    if (!validHex) return null;

    return [
      parseInt(validHex.slice(1, 3), 16),
      parseInt(validHex.slice(3, 5), 16),
      parseInt(validHex.slice(5, 7), 16)
    ];
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
    body: typeof document !== 'undefined' ? document.body : null,
    wallContainer: q('.wall-container'),
    wallPreview: q('.wall-preview'),
    fullscreenToggle: q('.fullscreen-toggle'),
    colorInput: q('.color-input-group input[type="text"]'),
    applyColorButton: findButtonByText(q('.color-input-group'), 'Применить цвет'),
    generateSimilarBtn: findButtonByText(q('.matching-actions'), 'Генерировать похожие'),
    generateContrastBtn: findButtonByText(q('.matching-actions'), 'Генерировать контрастные'),
    similarList: q('.matching-results > div:first-child .color-result-list'),
    contrastList: q('.matching-results > div:last-child .color-result-list'),
    templateHost: q('.designer-templates details'),
    lightingControls: q('.lighting-controls'),
    warmBtn: findButtonByText(q('.lighting-controls'), 'Теплое'),
    coldBtn: findButtonByText(q('.lighting-controls'), 'Холодное'),
    brightnessSlider: q('.lighting-controls input[type="range"]')
  };

  const DEFAULT_SPLIT_COLOR = '#d9d9d9';

  const state = {
    activeSection: 0,
    sections: 4,
    sectionColors: Array(4).fill(DEFAULT_SPLIT_COLOR),
    isFullscreen: false,
    generationTick: 0,
    templatesRendered: false,
    lighting: {
      mode: 'warm',
      brightness: dom.brightnessSlider ? Number(dom.brightnessSlider.value || 50) : 50,
      off: false
    }
  };

  const setSectionColors = (updater) => {
    const nextColors = typeof updater === 'function' ? updater(state.sectionColors.slice()) : updater;
    if (!Array.isArray(nextColors) || nextColors.length !== state.sections) return;

    state.sectionColors = nextColors.map((color, index) => normalizeHex(color) || state.sectionColors[index] || DEFAULT_SPLIT_COLOR);
    renderWall();
    applyLighting();
  };

  const createSplitPalette = (palette) => {
    if (!palette) return null;

    const nextColors = [palette.main, palette.main, palette.accent, palette.accentTarget].map(normalizeHex);
    return nextColors.some((value) => !value) ? null : nextColors;
  };

  const applySplitPalette = (palette) => {
    const nextColors = createSplitPalette(palette);
    if (!nextColors) {
      console.log('Цвет не найден');
      return null;
    }

    setSectionColors(nextColors);
    return nextColors;
  };

  const applyColorToWallSplits = (color) => {
    if (!color) {
      console.log('Цвет не найден');
      return null;
    }

    if (!applySplitPalette(color)) return null;

    state.activeSection = 0;
    renderWall();
    return color;
  };

  const applyColorByIdToWall = (colorId) => {
    const color = findColorById(colorId);
    if (!color) {
      console.log('Цвет не найден');
      return null;
    }

    return applyColorToWallSplits(color);
  };

  const applyNearestColorToWall = (inputRgb) => {
    const color = findNearestColorByRgb(inputRgb);
    return applyColorToWallSplits(color);
  };

  const getPaletteFromDatabase = () => colorDatabase
    .filter((entry) => normalizeHex(entry.hex) && Array.isArray(entry.rgb) && entry.rgb.length === 3)
    .map((entry) => ({
      ...entry,
      code: entry.id,
      hex: normalizeHex(entry.hex),
      hslObject: rgbToHsl(entry.rgb[0], entry.rgb[1], entry.rgb[2])
    }));

  const renderWall = () => {
    if (!dom.wallPreview) return;
    dom.wallPreview.innerHTML = '';
    dom.wallPreview.style.background = 'transparent';

    for (let idx = 0; idx < state.sections; idx += 1) {
      const part = document.createElement('div');
      part.className = 'wall-split-section';
      if (idx === state.activeSection) part.classList.add('is-active');
      part.style.backgroundColor = state.sectionColors[idx] || '#d9d9d9';
      part.setAttribute('data-section', String(idx + 1));
      part.setAttribute('role', 'button');
      part.setAttribute('tabindex', '0');
      part.setAttribute('aria-label', `Split ${idx + 1}`);
      part.setAttribute('aria-pressed', idx === state.activeSection ? 'true' : 'false');
      part.addEventListener('click', () => {
        state.activeSection = idx;
        renderWall();
      });
      part.addEventListener('keydown', (event) => {
        if (!event || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        state.activeSection = idx;
        renderWall();
      });
      dom.wallPreview.appendChild(part);
    }
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

  const createSuggestionBlock = (entry) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = `${entry.code} · ${entry.hex}`;
    btn.style.background = entry.hex;
    btn.style.color = '#111827';
    btn.addEventListener('click', () => {
      applyColorToWallSplits(entry);
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
    const baseRgb = parseHexToRgb(baseHex);
    if (!baseRgb || palette.length === 0) return [];

    const baseHsl = rgbToHsl(baseRgb[0], baseRgb[1], baseRgb[2]);
    const tick = state.generationTick;
    const offsets = mode === 'similar'
      ? [0, 10 + tick * 3, -10 - tick * 2, 22 + tick * 2, -22 - tick * 3]
      : [180, 150 + tick * 4, -150 - tick * 4, 210 + tick * 2, -210 - tick * 2];

    return palette
      .map((entry) => {
        const offset = offsets[(state.generationTick + entry.code.length) % offsets.length];
        const targetHue = (baseHsl.h + offset + 360) % 360;
        const hueScore = hueDistance(entry.hslObject.h, targetHue);
        const satScore = Math.abs(entry.hslObject.s - baseHsl.s) * (mode === 'similar' ? 80 : 35);
        const lightScore = Math.abs(entry.hslObject.l - baseHsl.l) * (mode === 'similar' ? 70 : 45);
        return { entry, score: hueScore + satScore + lightScore };
      })
      .sort((a, b) => a.score - b.score)
      .map((item) => item.entry);
  };

  const pickFiveUnique = (entries, baseHex) => {
    const unique = [];
    const seen = new Set([String(baseHex || '').toLowerCase()]);

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
    const base = state.sectionColors[state.activeSection] || DEFAULT_SPLIT_COLOR;
    const ranked = rankPaletteByHarmony(base, mode);
    const colors = pickFiveUnique(ranked, base);
    const target = mode === 'similar' ? dom.similarList : dom.contrastList;
    renderSuggestions(target, colors);
  };

  const getTemplates = () => {
    if (typeof window === 'undefined' || !window.designerTemplates || typeof window.designerTemplates !== 'object') return {};
    return window.designerTemplates;
  };

  const applyTemplate = (templateKey) => {
    const template = getTemplates()[templateKey];
    if (!template) return;

    const mainColor = findColorById(template.mainId);
    const accentColor = findColorById(template.accentId);
    const accentTargetColor = findColorById(template.accentTargetId);

    const palette = {
      main: mainColor?.hex || mainColor?.main,
      accent: accentColor?.hex || accentColor?.main,
      accentTarget: accentTargetColor?.hex || accentTargetColor?.main
    };

    applySplitPalette(palette);
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

  const handleApplyColor = () => {
    const inputValue = dom.colorInput ? dom.colorInput.value : '';
    applyColorByIdToWall(inputValue);
  };

  const bindEvents = () => {
    if (dom.fullscreenToggle && dom.wallPreview && dom.wallContainer && dom.body) {
      const syncFullscreenState = () => {
        const isNativeFullscreen = document.fullscreenElement === dom.wallContainer;
        const isFallbackFullscreen = dom.wallContainer.classList.contains('wall-container-fullscreen');
        state.isFullscreen = isNativeFullscreen || isFallbackFullscreen;
        dom.wallContainer.classList.toggle('wall-container-fullscreen', state.isFullscreen);
        dom.wallPreview.classList.toggle('wall-fullscreen', state.isFullscreen);
        dom.body.classList.toggle('fullscreen-active', state.isFullscreen);
        dom.fullscreenToggle.setAttribute('aria-pressed', state.isFullscreen ? 'true' : 'false');
        dom.fullscreenToggle.setAttribute('aria-label', state.isFullscreen ? 'Свернуть стену' : 'Развернуть стену на весь экран');
      };

      dom.fullscreenToggle.addEventListener('click', async () => {
        try {
          if (document.fullscreenElement === dom.wallContainer && document.exitFullscreen) {
            await document.exitFullscreen();
          } else if (!document.fullscreenElement && dom.wallContainer.requestFullscreen) {
            await dom.wallContainer.requestFullscreen();
          } else {
            dom.wallContainer.classList.toggle('wall-container-fullscreen');
          }
        } catch (error) {
          dom.wallContainer.classList.toggle('wall-container-fullscreen');
        }

        syncFullscreenState();
      });

      document.addEventListener('fullscreenchange', syncFullscreenState);
      syncFullscreenState();
    }

    if (dom.applyColorButton) {
      dom.applyColorButton.addEventListener('click', handleApplyColor);
    }

    if (dom.colorInput) {
      dom.colorInput.addEventListener('keydown', (event) => {
        if (!event || event.key !== 'Enter') return;
        handleApplyColor();
      });
    }

    if (dom.generateSimilarBtn) dom.generateSimilarBtn.addEventListener('click', () => generateByMode('similar'));
    if (dom.generateContrastBtn) dom.generateContrastBtn.addEventListener('click', () => generateByMode('contrast'));

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
    renderWall();
    applyLighting();
    setupTemplateUi();
    bindEvents();

    if (typeof window !== 'undefined') {
      window.applyColorById = applyColorByIdToWall;
      window.applyNearestColorByRgb = applyNearestColorToWall;
      window.applyColorToWallSplits = applyColorToWallSplits;
      window.addEventListener('load', setupTemplateUi, { once: true });
    }
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
  }
})();
