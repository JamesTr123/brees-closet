// SHARED COLOR, PERSONAL STYLE, AND OUTFIT VARIETY RULES
// These are flexible starting points, not universal fashion rules.
// No photos are sent to an AI service. We use the details saved with clothes.
const Styling = { colorCache: new Map(), labCache: new Map() };

Styling.clamp = function (value, low = 0, high = 1) {
  return Math.max(low, Math.min(high, value));
};

// Old color names still work. Their shades are estimates until edited.
Styling.legacyColors = {
  White: "#ffffff", Black: "#171717", Cream: "#f3e7cd",
  Multicolor: "#918798", Blue: "#3976bd", Green: "#438453",
  Red: "#c83e40", Pink: "#df8fae", Purple: "#9358b1",
  Yellow: "#e7c54c", Orange: "#d88339", Brown: "#8b6244", Gray: "#888888"
};

Styling.isHex = function (value) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
};

Styling.rgb = function (hex) {
  return [1, 3, 5].map(function (start) {
    return parseInt(hex.slice(start, start + 2), 16) / 255;
  });
};

Styling.toHex = function (rgb) {
  return "#" + rgb.map(function (value) {
    return Math.round(Styling.clamp(value) * 255).toString(16).padStart(2, "0");
  }).join("");
};

Styling.hsl = function (hex) {
  const rgb = Styling.rgb(hex);
  const high = Math.max(...rgb), low = Math.min(...rgb);
  const delta = high - low, light = (high + low) / 2;
  let hue = 0;
  if (delta) {
    if (high === rgb[0]) hue = ((rgb[1] - rgb[2]) / delta + 6) % 6;
    else if (high === rgb[1]) hue = (rgb[2] - rgb[0]) / delta + 2;
    else hue = (rgb[0] - rgb[1]) / delta + 4;
  }
  return { h: hue * 60, s: delta ? delta / (1 - Math.abs(2 * light - 1)) : 0, l: light };
};

Styling.fromHsl = function (hue, saturation, light) {
  const c = (1 - Math.abs(2 * light - 1)) * saturation;
  const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = light - c / 2;
  const chunks = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]];
  return Styling.toHex(chunks[Math.floor(((hue % 360) + 360) % 360 / 60)].map(function (v) { return v + m; }));
};

Styling.hexFor = function (item) {
  const value = typeof item === "string" ? item : item.colorHex || item.color;
  if (Styling.isHex(value)) return value.toLowerCase();
  const name = String(value || "Gray");
  const family = name.replace(/^(Light |Dark )/, "");
  const base = Styling.rgb(Styling.legacyColors[family] || "#888888");
  if (name.startsWith("Light ")) return Styling.toHex(base.map(function (v) { return v + (1 - v) * 0.52; }));
  if (name.startsWith("Dark ")) return Styling.toHex(base.map(function (v) { return v * 0.52; }));
  return Styling.toHex(base);
};

// Keep broad color names for the existing search filters.
// The exact hex value is stored separately and used in matching.
Styling.info = function (item) {
  // A pattern is not represented well by pretending it is one solid hue.
  if ((typeof item === "string" ? item : item.color) === "Multicolor" &&
      !(typeof item === "object" && Styling.isHex(item.colorHex))) {
    return { hex: "#918798", h: 0, s: 0, l: 0.5, family: "Multicolor", neutral: false, label: "Multicolor" };
  }
  const hex = Styling.hexFor(item);
  if (Styling.colorCache.has(hex)) return Styling.colorCache.get(hex);
  const hsl = Styling.hsl(hex);
  const h = hsl.h, s = hsl.s, l = hsl.l;
  let family;
  if (l < 0.035 || (l < 0.13 && s < 0.35)) family = "Black";
  else if (l > 0.97) family = "White";
  else if (s < 0.12) family = "Gray";
  else if (h >= 25 && h < 65 && l > 0.8 && s < 0.55) family = "Cream";
  else if (h >= 12 && h < 48 && l < 0.5) family = "Brown";
  else if (h >= 48 && h < 90 && l < 0.36) family = "Green"; // Olive shades.
  else if (h < 15 || h >= 350) family = "Red";
  else if (h < 45) family = "Orange";
  else if (h < 70) family = "Yellow";
  else if (h < 165) family = "Green";
  else if (h < 255) family = "Blue";
  else if (h < 285) family = "Purple";
  else family = "Pink";
  const neutral = ["White", "Black", "Gray", "Cream", "Brown"].includes(family) ||
    (family === "Blue" && l < 0.27) || // Navy can anchor other colors.
    (family === "Green" && h < 110 && l < 0.4 && s < 0.85); // Muted olive.
  const label = ["White", "Black", "Cream"].includes(family) ? family
    : (l > 0.72 ? "Light " : l < 0.3 ? "Dark " : "") + family;
  const info = { hex: hex, h: h, s: s, l: l, family: family, neutral: neutral, label: label };
  Styling.colorCache.set(hex, info);
  return info;
};

// Compare shades using a perceptual color space, rather than names alone.
Styling.lab = function (hex) {
  if (Styling.labCache.has(hex)) return Styling.labCache.get(hex);
  const rgb = Styling.rgb(hex).map(function (c) { return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const l = Math.cbrt(0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2]);
  const m = Math.cbrt(0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2]);
  const s = Math.cbrt(0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2]);
  const result = [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  Styling.labCache.set(hex, result);
  return result;
};

Styling.colorSimilarity = function (first, second) {
  const a = Styling.lab(Styling.hexFor(first)), b = Styling.lab(Styling.hexFor(second));
  return Styling.clamp(1 - Math.hypot(...a.map(function (v, i) { return v - b[i]; })) / 0.4);
};

Styling.visibleTop = function (pieces) {
  const priority = { "Vest": 5, "Sweatshirt / Sweater": 4, "Long Sleeve": 3, "T-shirt": 2, "Crop top": 2, "Tank top": 1 };
  return pieces.filter(function (item) { return item.category === "Top"; }).sort(function (a, b) {
    return (priority[b.clothingType] || 0) - (priority[a.clothingType] || 0) || String(a.id).localeCompare(String(b.id));
  })[0];
};

Styling.topPattern = function (pieces) {
  return JSON.stringify(pieces.filter(function (item) { return item.category === "Top"; })
    .map(function (item) { return item.clothingType; }).sort());
};

Styling.describe = function (pieces) {
  const top = Styling.visibleTop(pieces);
  const bottom = pieces.find(function (item) { return item.category === "Bottom"; });
  if (!top || !bottom) return null;
  const topColor = Styling.info(top), bottomColor = Styling.info(bottom);
  return {
    top: top, bottom: bottom, topColor: topColor, bottomColor: bottomColor,
    typeKey: top.clothingType + "|" + bottom.clothingType,
    colorKey: topColor.family + "|" + bottomColor.family,
    // Different blue tops with different blue jeans still make the same look.
    visualKey: topColor.family + "|" + bottom.clothingType + "|" + bottomColor.family,
    layers: pieces.filter(function (item) { return item.category === "Top"; }).length
  };
};

Styling.increment = function (map, key, weight) { map.set(key, (map.get(key) || 0) + weight); };
Styling.relative = function (map, key) {
  let maximum = 0;
  for (const value of map.values()) maximum = Math.max(maximum, value);
  return maximum ? (map.get(key) || 0) / maximum : 0.5;
};

// Save enough style information to remember a dislike even if a piece is deleted.
Styling.feedbackFor = function (pieces) {
  const look = Styling.describe(pieces);
  if (!look) return null;
  return {
    topType: look.top.clothingType || "Unknown",
    bottomType: look.bottom.clothingType || "Unknown",
    topColor: look.topColor.hex,
    bottomColor: look.bottomColor.hex,
    topFamily: look.topColor.family,
    bottomFamily: look.bottomColor.family
  };
};

Styling.validFeedback = function (feedback) {
  return feedback && Styling.isHex(feedback.topColor) &&
    Styling.isHex(feedback.bottomColor) &&
    ["topType", "bottomType", "topFamily", "bottomFamily"].every(function (field) {
      return typeof feedback[field] === "string" &&
        feedback[field].length > 0 && feedback[field].length <= 80;
    });
};

// Similar COLORS and similar CLOTHING TYPES each lower the score.
// The strongest effect is for an outfit similar in both ways.
// One rejected jeans outfit should not rule out all jeans.
Styling.feedbackPenalty = function (look, profile) {
  const cacheKey = look.typeKey + "|" + look.topColor.hex + "|" + look.bottomColor.hex +
    "|" + look.topColor.family + "|" + look.bottomColor.family;
  if (profile.feedbackCache?.has(cacheKey)) return profile.feedbackCache.get(cacheKey);
  let total = 0, strongest = 0;
  (profile.negativeExamples || []).forEach(function (example) {
    function shadeSimilarity(item, color, family) {
      if (Styling.info(item).family === "Multicolor" || family === "Multicolor") return 0;
      const exact = Styling.colorSimilarity(item, color);
      return Styling.info(item).family === family ? 0.7 + exact * 0.3 : exact;
    }
    const topSimilarity = shadeSimilarity(look.top, example.topColor, example.topFamily);
    const bottomSimilarity = shadeSimilarity(look.bottom, example.bottomColor, example.bottomFamily);
    // Both halves need to resemble the disliked palette.
    const palette = Math.sqrt(topSimilarity * bottomSimilarity);
    const colorMatch = Styling.clamp((palette - 0.55) / 0.45);
    const types = (look.top.clothingType === example.topType ? 0.5 : 0) +
      (look.bottom.clothingType === example.bottomType ? 0.5 : 0);
    const penalty = colorMatch * 7 + (types === 1 ? 2.5 : 0) + colorMatch * types * 5;
    total += penalty;
    strongest = Math.max(strongest, penalty);
  });
  // Repeated dislikes strengthen the evidence, with a ceiling of 25 points.
  const result = Math.min(25, strongest + (total - strongest) * 0.4);
  profile.feedbackCache?.set(cacheKey, result);
  return result;
};

// Learn from the signed-in account's examples only.
// Worn outfits carry more evidence than an outfit merely being saved.
Styling.profile = function (data, today) {
  const profile = { typePairs: new Map(), colorPairs: new Map(), topTypes: new Map(), bottomTypes: new Map(),
    topColors: new Map(), bottomColors: new Map(), samples: [], recent: [], negativeExamples: [], feedbackCache: new Map(), personalCache: new Map(), weight: 0 };
  const byId = new Map(data.clothes.map(function (item) { return [item.id, item]; }));
  const todayNumber = Date.parse(today + "T12:00:00Z") / 86400000;
  function add(ids, weight, date) {
    const pieces = ids.map(function (id) { return byId.get(id); });
    if (pieces.some(function (item) { return !item; })) return;
    const look = Styling.describe(pieces);
    if (!look) return;
    [[profile.typePairs, look.typeKey], [profile.colorPairs, look.colorKey],
      [profile.topTypes, look.top.clothingType], [profile.bottomTypes, look.bottom.clothingType],
      [profile.topColors, look.topColor.family], [profile.bottomColors, look.bottomColor.family]]
      .forEach(function ([map, key]) { Styling.increment(map, key, weight); });
    profile.samples.push({ look: look, weight: weight });
    profile.weight += weight;
    if (date) {
      const age = todayNumber - Date.parse(date + "T12:00:00Z") / 86400000;
      if (age >= 0 && age < 7) profile.recent.push(look);
    }
  }
  // Group duplicate saved outfits so old copies don't amplify preferences.
  const saved = new Map();
  data.outfits.forEach(function (outfit) {
    const key = JSON.stringify([...outfit.clothingIds].sort());
    if (!saved.has(key) || outfit.favorite) saved.set(key, outfit);
  });
  for (const outfit of saved.values()) add(outfit.clothingIds, outfit.favorite ? 3 : 1);
  const logged = new Set();
  data.history.forEach(function (entry) {
    const identity = JSON.stringify([...entry.clothingIds].sort()) + "|" + entry.date;
    if (logged.has(identity)) return;
    logged.add(identity);
    const age = todayNumber - Date.parse(entry.date + "T12:00:00Z") / 86400000;
    if (!Number.isFinite(age) || age < 0) return;
    add(entry.clothingIds, 4 * Math.max(0.3, Math.exp(-age / 180)), entry.date);
  });
  const seenDislikes = new Set();
  (data.dismissed || []).forEach(function (entry) {
    if (seenDislikes.has(entry.id)) return;
    seenDislikes.add(entry.id);
    if (Styling.validFeedback(entry.styleFeedback)) {
      profile.negativeExamples.push(entry.styleFeedback);
      return;
    }
    // Old dismissals still teach us when their clothing remains in the closet.
    try {
      const pieces = JSON.parse(entry.id).map(function (id) { return byId.get(id); });
      if (pieces.some(function (item) { return !item; })) return;
      const feedback = Styling.feedbackFor(pieces);
      if (feedback) profile.negativeExamples.push(feedback);
    } catch (error) { /* Ignore a malformed old dismissal. */ }
  });
  profile.confidence = 1 - Math.exp(-profile.weight / 12);
  return profile;
};

Styling.pairHarmony = function (a, b) {
  if (a.family === "Multicolor" || b.family === "Multicolor") return (a.neutral || b.neutral) ? 0.76 : 0.5;
  // Matching chromatic hues are an option, but aren't our default favorite.
  // A learned preference can raise their score later.
  if (a.family === b.family && !["Black", "White", "Gray", "Cream", "Brown"].includes(a.family)) {
    return Math.abs(a.l - b.l) > 0.32 ? 0.36 : 0.18;
  }
  if (a.neutral && b.neutral) return a.family === b.family ? 0.78 : 0.94;
  if (a.neutral || b.neutral) return 0.9;
  const pairs = {
    "Blue|Pink": 0.86, "Blue|Red": 0.82, "Blue|Orange": 0.76,
    "Blue|Green": 0.69, "Blue|Purple": 0.68, "Green|Pink": 0.82,
    "Green|Purple": 0.7, "Green|Yellow": 0.77, "Pink|Purple": 0.8,
    "Purple|Yellow": 0.76, "Pink|Red": 0.69, "Orange|Purple": 0.66
  };
  const key = [a.family, b.family].sort().join("|");
  let score = pairs[key];
  if (score === undefined) {
    const difference = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
    score = difference > 145 ? 0.71 : difference > 35 ? 0.61 : 0.42;
  }
  // Two very bright saturated colors are a bolder, less default choice.
  if (a.s > 0.78 && b.s > 0.78 && a.l > 0.4 && b.l > 0.4) score -= 0.1;
  return Styling.clamp(score);
};

Styling.colors = function (pieces, profile) {
  const look = Styling.describe(pieces);
  if (!look) return 0;
  let score = Styling.pairHarmony(look.topColor, look.bottomColor);
  // Reward exact shade relationships that resemble her own examples.
  if (profile?.weight) {
    const learnedPair = Styling.relative(profile.colorPairs, look.colorKey);
    score += (0.9 - score) * profile.confidence * learnedPair * 0.8;
  }
  const otherTops = pieces.filter(function (item) { return item.category === "Top" && item.id !== look.top.id; });
  if (otherTops.length) {
    const layerScore = otherTops.reduce(function (sum, item) {
      return sum + Styling.pairHarmony(Styling.info(item), look.topColor);
    }, 0) / otherTops.length;
    score = score * 0.8 + layerScore * 0.2;
  }
  return score;
};

// Broad garment-type priors. Fit, fabric, or prints aren't inferred from photos.
Styling.garments = function (look) {
  const table = {
    "T-shirt": { Jeans: 0.95, Leggings: 0.91, Shorts: 0.95, Skirt: 0.85, Sweatpants: 0.93 },
    "Long Sleeve": { Jeans: 0.95, Leggings: 0.93, Shorts: 0.8, Skirt: 0.9, Sweatpants: 0.92 },
    "Sweatshirt / Sweater": { Jeans: 0.95, Leggings: 0.96, Shorts: 0.74, Skirt: 0.78, Sweatpants: 0.94 },
    "Tank top": { Jeans: 0.88, Leggings: 0.95, Shorts: 0.96, Skirt: 0.9, Sweatpants: 0.86 },
    "Crop top": { Jeans: 0.94, Leggings: 0.93, Shorts: 0.94, Skirt: 0.91, Sweatpants: 0.9 },
    "Vest": { Jeans: 0.9, Leggings: 0.8, Shorts: 0.72, Skirt: 0.8, Sweatpants: 0.76 }
  };
  return table[look.top.clothingType]?.[look.bottom.clothingType] || 0.78;
};

Styling.personal = function (look, profile) {
  if (!profile?.weight) return 0.5;
  const cacheKey = look.typeKey + "|" + look.topColor.hex + "|" + look.bottomColor.hex;
  if (profile.personalCache.has(cacheKey)) return profile.personalCache.get(cacheKey);
  let nearestPalette = 0;
  profile.samples.forEach(function (sample) {
    const similarity = (Styling.colorSimilarity(look.top, sample.look.top) +
      Styling.colorSimilarity(look.bottom, sample.look.bottom)) / 2;
    nearestPalette = Math.max(nearestPalette, similarity * Math.min(1, 0.65 + sample.weight * 0.09));
  });
  const evidence = Styling.relative(profile.typePairs, look.typeKey) * 0.3 +
    Styling.relative(profile.colorPairs, look.colorKey) * 0.15 + nearestPalette * 0.1 +
    Styling.relative(profile.topTypes, look.top.clothingType) * 0.15 +
    Styling.relative(profile.bottomTypes, look.bottom.clothingType) * 0.1 +
    Styling.relative(profile.topColors, look.topColor.family) * 0.1 +
    Styling.relative(profile.bottomColors, look.bottomColor.family) * 0.1;
  const result = 0.5 + profile.confidence * (evidence - 0.5);
  profile.personalCache.set(cacheKey, result);
  return result;
};

Styling.lookSimilarity = function (a, b) {
  if (a.visualKey === b.visualKey) return 1;
  return (a.top.clothingType === b.top.clothingType ? 0.2 : 0) +
    (a.bottom.clothingType === b.bottom.clothingType ? 0.2 : 0) +
    Styling.colorSimilarity(a.top, b.top) * 0.3 + Styling.colorSimilarity(a.bottom, b.bottom) * 0.3;
};

Styling.score = function (pieces, saved, range, profile) {
  const look = Styling.describe(pieces);
  if (!look) return { score: 0, reasons: [], personal: 0 };
  const colors = Styling.colors(pieces, profile);
  const personal = Styling.personal(look, profile);
  const warmth = pieces.reduce(function (sum, item) { return sum + Number(item.warmth || 1); }, 0);
  const weather = range.ideal === null ? 1 : Styling.clamp(1 - Math.abs(warmth - range.ideal) / 5);
  const typeEvidence = profile.weight ? Styling.relative(profile.typePairs, look.typeKey) : 0;
  const garment = Styling.garments(look) * (1 - profile.confidence * 0.3) + typeEvidence * profile.confidence * 0.3;
  const feedbackPenalty = Styling.feedbackPenalty(look, profile);
  const recentSimilarity = profile.recent.reduce(function (best, example) {
    return Math.max(best, Styling.lookSimilarity(look, example));
  }, 0);
  // Out of 100: colors 30, garment pairing 20, personal taste 25,
  // saved favorite 15, weather 10. Recent lookalikes get a small penalty.
  const score = Math.round(Styling.clamp(
    colors * 30 + garment * 20 + personal * 25 + (saved?.favorite ? 15 : 0) + weather * 10 -
    feedbackPenalty - Math.max(0, recentSimilarity - 0.7) * 20, 0, 100
  ));
  const reasons = [];
  if (feedbackPenalty >= 4) reasons.push("Similar to an outfit you dismissed");
  if (profile.confidence > 0.25 && personal > 0.64) reasons.push("Fits colors and clothing types you often choose");
  if (colors > 0.76) reasons.push("A coordinated color pairing");
  else if (look.topColor.family === look.bottomColor.family && !look.topColor.neutral) reasons.push("A tonal color combination");
  if (garment > 0.86) reasons.push("A classic top-and-bottom pairing");
  if (range.ideal !== null && weather < 0.45) reasons.push(warmth < range.ideal ? "Lighter than today's weather preference" : "Warmer than today's weather preference");
  return { score: score, reasons: reasons, personal: personal };
};

// Pick different LOOKS, not merely different clothing IDs.
// A required piece may repeat only inside Style This Piece.
Styling.selectDistinct = function (candidates, limit, requiredPieceId = null, retained = []) {
  const remaining = [...candidates];
  const selected = [], looks = [], keys = new Set(), visualKeys = new Set();
  const usedTops = new Set(), bottomCounts = new Map(), topColorCounts = new Map();
  function remember(candidate) {
    const look = candidate._look || (candidate._look = Styling.describe(candidate.pieces));
    if (!look || keys.has(candidate.key)) return;
    selected.push(candidate); looks.push(look); keys.add(candidate.key);
    visualKeys.add(requiredPieceId === look.top.id
      ? look.visualKey + "|" + look.layers + "|" + Styling.topPattern(candidate.pieces) : look.visualKey);
    candidate.pieces.filter(function (item) { return item.category === "Top" && item.id !== requiredPieceId; })
      .forEach(function (item) { usedTops.add(item.id); });
    bottomCounts.set(look.bottom.id, (bottomCounts.get(look.bottom.id) || 0) + 1);
    Styling.increment(topColorCounts, look.topColor.family, 1);
  }
  retained.forEach(remember);
  while (remaining.length && selected.length < limit) {
    let bestIndex = -1, bestAdjusted = -Infinity;
    remaining.forEach(function (candidate, index) {
      if (keys.has(candidate.key)) return;
      const look = candidate._look || (candidate._look = Styling.describe(candidate.pieces));
      if (!look) return;
      const tops = candidate.pieces.filter(function (item) { return item.category === "Top"; });
      if (tops.some(function (item) { return item.id !== requiredPieceId && usedTops.has(item.id); })) return;
      const visualKey = requiredPieceId === look.top.id
        ? look.visualKey + "|" + look.layers + "|" + Styling.topPattern(candidate.pieces)
        : look.visualKey;
      if (visualKeys.has(visualKey)) return;
      // Keep one color family from dominating the whole recommendation page.
      if (look.top.id !== requiredPieceId && (topColorCounts.get(look.topColor.family) || 0) >= 2) return;
      const bottomCount = bottomCounts.get(look.bottom.id) || 0;
      if (look.bottom.id !== requiredPieceId && bottomCount >= 2) return;
      const similarity = looks.reduce(function (best, previous) {
        return Math.max(best, Styling.lookSimilarity(look, previous));
      }, 0);
      // Almost-identical shades and cuts still count as lookalikes even
      // when the colors fall on opposite sides of a family boundary.
      if (similarity >= 0.92) return;
      const adjusted = candidate.score - similarity * 9 - bottomCount * 4;
      if (adjusted > bestAdjusted) { bestAdjusted = adjusted; bestIndex = index; }
    });
    if (bestIndex < 0) break;
    const candidate = remaining.splice(bestIndex, 1)[0];
    remember(candidate);
  }
  // Keep the strongest displayed Match score at the top.
  return selected.sort(function (a, b) { return b.score - a.score || String(a.key).localeCompare(String(b.key)); });
};
