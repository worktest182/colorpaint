import paradeColors from './parade.json' with { type: 'json' };

const parseRgb = (value) => {
  if (Array.isArray(value)) {
    return value.slice(0, 3).map((channel) => Number(channel));
  }

  const matches = String(value || '').match(/\d+/g);
  return matches ? matches.slice(0, 3).map(Number) : [];
};

const normalizeHex = (value) => String(value || '').trim().toLowerCase();

const normalizeColor = (color) => ({
  ...color,
  id: String(color?.id || '').trim(),
  rgb: parseRgb(color?.rgb),
  hex: normalizeHex(color?.hex),
  hsl: color?.hsl,
  hueBucket: color?.hueBucket,
  main: normalizeHex(color?.main || color?.hex),
  accent: normalizeHex(color?.accent || color?.hex),
  accentTarget: normalizeHex(color?.accentTarget || color?.hex)
});

export const colorDatabase = paradeColors.map(normalizeColor);

const getDistance = (sourceRgb, targetRgb) => Math.sqrt(
  sourceRgb.reduce((sum, channel, index) => sum + ((channel || 0) - (targetRgb[index] || 0)) ** 2, 0)
);

export const findNearestColorByRgb = (inputRgb) => {
  const normalizedInput = parseRgb(inputRgb);
  if (normalizedInput.length !== 3 || colorDatabase.length === 0) return null;

  return colorDatabase.reduce((closestColor, currentColor) => {
    if (!closestColor) return currentColor;

    const currentDistance = getDistance(normalizedInput, currentColor.rgb);
    const closestDistance = getDistance(normalizedInput, closestColor.rgb);
    return currentDistance < closestDistance ? currentColor : closestColor;
  }, null);
};

export const findColorById = (colorId) => {
  const normalizedId = String(colorId || '').trim().toLowerCase();
  if (!normalizedId) return null;
  return colorDatabase.find((color) => color.id.toLowerCase() === normalizedId) || null;
};

if (typeof window !== 'undefined') {
  window.colorDatabase = colorDatabase;
  window.findNearestColorByRgb = findNearestColorByRgb;
  window.findColorById = findColorById;
}
