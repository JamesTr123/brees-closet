// OUTFIT RECOMMENDATIONS
const Decider = {
  weatherRange: null,
  ranked: [],
  shown: 0,
  previewRequestNumber: 0,
  weatherDate: null,
  requestNumber: 0
};

// The overlapping warmth ranges we agreed on.
// "ideal" affects ranking within the allowed range.
Decider.ranges = {
  warm: { min: 2, max: 4, ideal: 2.5 },
  mild: { min: 2, max: 5, ideal: 3.5 },
  cool: { min: 3, max: 6, ideal: 4.5 },
  freezing: { min: 6, max: 12, ideal: 7 },
  any: { min: 2, max: 12, ideal: null }
};

// Pick a range using the current feels-like temperature.
Decider.rangeForTemperature = function (temperature) {
  if (temperature < 32) return "freezing";
  if (temperature < 50) return "cool";
  if (temperature < 70) return "mild";
  return "warm";
};

// Use calendar days to avoid daylight-saving-time errors.
Decider.dayNumber = function (date) {
  const parts = date.split("-").map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000;
};

// Treat light, normal, and dark shades as one color family.
Decider.family = function (color) {
  return color.replace(/^(Light |Dark )/, "");
};

// Color compatibility improves ranking but never excludes outfits.
Decider.colorScore = function (pieces) {
  const neutrals = ["White", "Black", "Cream", "Gray", "Brown"];

  const friendlyPairs = [
    ["Blue", "Green"],
    ["Blue", "Pink"],
    ["Blue", "Purple"],
    ["Green", "Yellow"],
    ["Pink", "Purple"],
    ["Red", "Blue"],
    ["Orange", "Blue"]
  ];

  let total = 0;
  let comparisons = 0;

  for (let a = 0; a < pieces.length; a++) {
    for (let b = a + 1; b < pieces.length; b++) {
      const first = Decider.family(pieces[a].color);
      const second = Decider.family(pieces[b].color);
      comparisons++;

      if (first === second) {
        total += 1;
      } else if (neutrals.includes(first) || neutrals.includes(second)) {
        total += 0.9;
      } else if (friendlyPairs.some(function (pair) {
        return pair.includes(first) && pair.includes(second);
      })) {
        total += 0.75;
      } else {
        total += 0.35;
      }
    }
  }

  return comparisons ? total / comparisons : 0;
};

// Compare an item with a reference piece from a saved outfit.
Decider.pieceSimilarity = function (item, reference) {
  if (item.category !== reference.category) return 0;

  let points = 0;

  if (
    item.clothingType &&
    item.clothingType === reference.clothingType
  ) points += 4;

  if (Decider.family(item.color) === Decider.family(reference.color)) {
    points += 3;
  }

  if (item.styles.some(function (style) {
    return reference.styles.includes(style);
  })) points += 2;

  if (item.warmth === reference.warmth) points++;

  return points / 10;
};

// Score similarity to saved outfits.
// Favorites and frequently worn references receive more weight.
Decider.similarity = function (pieces, references) {
  let best = 0;

  references.forEach(function (reference) {
    let total = 0;

    pieces.forEach(function (item) {
      let closest = 0;

      reference.pieces.forEach(function (piece) {
        closest = Math.max(
          closest,
          Decider.pieceSimilarity(item, piece)
        );
      });

      total += closest;
    });

    const similarity = total / pieces.length;
    const importance = Math.min(
      1,
      0.55 + (reference.favorite ? 0.3 : 0) +
      Math.min(reference.wears, 5) * 0.03
    );

    best = Math.max(best, similarity * importance);
  });

  return best;
};

// Validate the structure of an outfit.
Decider.validStructure = function (pieces) {
  const tops = pieces.filter(function (item) {
    return item.category === "Top";
  });

  const bottoms = pieces.filter(function (item) {
    return item.category === "Bottom";
  });

  const baseTops = tops.filter(function (item) {
    return !item.canLayer;
  });

  return bottoms.length === 1 &&
    tops.length >= 1 &&
    tops.length <= 3 &&
    (tops.length === 1 || baseTops.length <= 1);
};

// LOCATION AND WEATHER
App.get("useLocationButton").addEventListener("click", function () {
  const button = this;
  const status = App.get("weatherStatus");

  if (!navigator.geolocation) {
    status.textContent = "Location unavailable. Choose warmth manually.";
    return;
  }

  button.disabled = true;
  status.textContent = "Requesting location...";

  navigator.geolocation.getCurrentPosition(
    async function (position) {
      try {
        status.textContent = "Getting weather...";

        const url = new URL("https://api.open-meteo.com/v1/forecast");

        // Send approximate coordinates without saving them.
        url.searchParams.set(
          "latitude", position.coords.latitude.toFixed(2)
        );

        url.searchParams.set(
          "longitude", position.coords.longitude.toFixed(2)
        );

        url.searchParams.set(
          "current", "temperature_2m,apparent_temperature"
        );

        url.searchParams.set("temperature_unit", "fahrenheit");
        url.searchParams.set("timezone", "auto");

        const controller = new AbortController();
        const timer = setTimeout(function () {
          controller.abort();
        }, 15000);

        let response;

        try {
          response = await fetch(url, { signal: controller.signal });
        } finally {
          clearTimeout(timer);
        }

        if (!response.ok) throw new Error("Weather request failed");

        const data = await response.json();
        const temperature = data.current?.temperature_2m;
        const feelsLike = data.current?.apparent_temperature;

        if (
          !Number.isFinite(temperature) ||
          !Number.isFinite(feelsLike)
        ) throw new Error("Missing temperature");

        Decider.weatherRange = Decider.rangeForTemperature(feelsLike);
        Decider.weatherDate = History.today();
        document.dispatchEvent(new Event("closet-weather-changed"));

        const range = Decider.ranges[Decider.weatherRange];

        status.textContent =
          "Now " + Math.round(temperature) + "°F. Feels like " +
          Math.round(feelsLike) + "°F. Preferred total warmth: " +
          range.min + "–" + range.max + ".";

        Decider.invalidate();
      } catch (error) {
        Decider.weatherRange = null;
        Decider.weatherDate = null;
        document.dispatchEvent(new Event("closet-weather-changed"));
        status.textContent =
          "Weather could not be loaded. Choose warmth manually.";
        Decider.invalidate();
      } finally {
        button.disabled = false;
      }
    },
    function () {
      button.disabled = false;
      status.textContent =
        "Location unavailable or permission declined. " +
        "Choose warmth manually.";
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 300000
    }
  );
});

// Clear outdated suggestions after a filter or data change.
Decider.invalidate = function () {
  Decider.requestNumber++;
  Decider.ranked = [];
  Decider.shown = 0;

  App.get("suggestionGrid").replaceChildren();
  App.get("moreSuggestionsButton").hidden = true;

  App.get("deciderStatus").textContent =
    "Tap Suggest Outfits to use the current filters.";
};

App.get("avoidRepeats").addEventListener("change", function () {
  App.get("repeatDays").disabled = !this.checked;
});

[
  "deciderWarmth",
  "avoidRepeats",
  "repeatDays"
].forEach(function (id) {
  App.get(id).addEventListener("change", Decider.invalidate);
});

document.querySelectorAll('input[name="deciderStyle"]').forEach(
  function (checkbox) {
    checkbox.addEventListener("change", Decider.invalidate);
  }
);

// GENERATE AND RANK SUGGESTIONS
Decider.generate = async function (options = {}) {
    // Normally there is no required piece.
// Style This Piece supplies one clothing ID.
const requiredPieceId = options.pieceId || null;
const isPreview = options.preview === true;
// Home requests have their own counter and never alter visible suggestions.
const previewUserId = isPreview ? Account.user?.id : null;
  const request = isPreview
    ? ++Decider.previewRequestNumber
    : ++Decider.requestNumber;
  const isCurrent = function () {
    return isPreview
      ? request === Decider.previewRequestNumber && Account.user?.id === previewUserId
      : request === Decider.requestNumber;
  };
  const status = isPreview ? { textContent: "" } : App.get(
  requiredPieceId ? "stylePieceStatus" : "deciderStatus"
);

  const choice = isPreview ? "any" : App.get("deciderWarmth").value;
  // Style This Piece uses available weather, or any warmth.
// It does not inherit unrelated filters from the Decider page.
const rangeName = isPreview
  ? options.rangeName || "any"
  : requiredPieceId
  ? Decider.weatherRange || "any"
  : choice === "weather" ? Decider.weatherRange : choice;

  if (!rangeName) {
    status.textContent =
      "Use My Location first, or choose a warmth range.";
    return;
  }

  const range = Decider.ranges[rangeName];
  // Generate both kinds for the main suggestions popup.
// Style This Piece still uses its own selected mode.
const source = requiredPieceId
  ? Decider.pieceMode
  : "all";
// Existing outfits can include recently worn combinations.
const avoid = isPreview
  ? true
  : requiredPieceId
  ? Decider.pieceMode === "new"
  : App.get("avoidRepeats").checked;

const days = isPreview
  ? 7
  : requiredPieceId
  ? 7
  : Number(App.get("repeatDays").value);

  if (
    avoid &&
    (!Number.isInteger(days) || days < 1 || days > 365)
  ) {
    status.textContent = "Enter a whole number of days from 1 to 365.";
    return;
  }

 // For styling one piece, use its own styles.
// Otherwise use the styles selected on the Decider page.
const styles = isPreview
  ? []
  : requiredPieceId
  ? options.pieceStyles || []
  : [...document.querySelectorAll(
      'input[name="deciderStyle"]:checked'
    )].map(function (checkbox) {
      return checkbox.value;
    });

 status.textContent = "Finding outfits...";
 // Open the main suggestions screen.
// Style This Piece keeps using its separate popup.
if (!isPreview && !requiredPieceId) {
  Decider.resultsMode = "all";

  // Start with ALL selected every time suggestions are requested.
  document.querySelectorAll("[data-suggestion-mode]").forEach(
    function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.suggestionMode === "all")
      );
    }
  );

  const dialog = App.get("suggestionsDialog");

  if (!dialog.open) {
    dialog.showModal();
  }
}

if (isPreview) {
  // No popup, grid, or filters are changed for Home.
} else if (requiredPieceId) {
  App.get("stylePieceResults").replaceChildren();
} else {
  App.get("suggestionGrid").replaceChildren();
  App.get("moreSuggestionsButton").hidden = true;
  Decider.ranked = [];
  Decider.shown = 0;
}
  try {
    const data = options.data || await App.read([
      "clothes", "outfits", "history", "dismissed"
    ]);

    if (!isCurrent()) return;

    const byId = new Map(data.clothes.map(function (item) {
      return [item.id, item];
    }));

    const dismissed = new Set(data.dismissed.map(function (item) {
      return item.id;
    }));

    const clean = data.clothes.filter(function (item) {
      return !item.inLaundry;
    });

    // Untyped old clothing can appear in saved outfit suggestions,
    // but needs a type before generating new combinations.
    const typed = clean.filter(function (item) {
      return App.types[item.category]?.includes(item.clothingType);
    });

    const tops = typed.filter(function (item) {
      return item.category === "Top";
    });

    const bottoms = typed.filter(function (item) {
      return item.category === "Bottom";
    });

    const saved = new Map();
    const wearStats = new Map();

    data.outfits.forEach(function (outfit) {
      const key = App.signature(outfit.clothingIds);
      const previous = saved.get(key);

      if (!previous || outfit.favorite) saved.set(key, outfit);
    });

    // Count recorded wear days and find the latest date.
    data.history.forEach(function (entry) {
      const key = App.signature(entry.clothingIds);

      if (!wearStats.has(key)) {
        wearStats.set(key, { dates: new Set(), last: "" });
      }

      const stats = wearStats.get(key);
      stats.dates.add(entry.date);
      if (entry.date > stats.last) stats.last = entry.date;
    });

    const references = data.outfits.map(function (outfit) {
      const pieces = outfit.clothingIds.map(function (id) {
        return byId.get(id);
      }).filter(Boolean);

      const stats = wearStats.get(App.signature(outfit.clothingIds));

      return {
        outfit: outfit,
        pieces: pieces,
        favorite: outfit.favorite,
        wears: stats ? stats.dates.size : 0,
        complete: pieces.length === outfit.clothingIds.length
      };
    });

    const candidates = new Map();
    const today = Decider.dayNumber(History.today());

    // Validate and score one combination.
    function consider(ids, threeTopTemplate = false) {
        // Every result must contain the exact selected clothing item.
if (requiredPieceId && !ids.includes(requiredPieceId)) return;
      const key = App.signature(ids);
      if (candidates.has(key) || dismissed.has(key)) return;

      const pieces = ids.map(function (id) {
        return byId.get(id);
      });

      if (
        pieces.some(function (item) {
          return !item || item.inLaundry;
        }) ||
        !Decider.validStructure(pieces)
      ) return;

      const savedOutfit = saved.get(key);
      // Check whether these tops make sense together.
const outfitTops = pieces.filter(function (item) {
  return item.category === "Top";
});

// Never recommend a sweatshirt/sweater over another one.
const sweatshirtCount = outfitTops.filter(function (item) {
  return item.clothingType === "Sweatshirt / Sweater";
}).length;

if (sweatshirtCount > 1) return;

if (outfitTops.length > 1) {
  // Layered suggestions need clothing types assigned first.
  if (outfitTops.some(function (item) {
    return !item.clothingType;
  })) return;

  // These types can form the bottom layer.
  const baseTypes = ["T-shirt", "Tank top", "Crop top"];

  // Only sweatshirts/sweaters and vests act as outer layers.
  const outerTypes = ["Sweatshirt / Sweater", "Vest"];

  const bases = outfitTops.filter(function (item) {
    return baseTypes.includes(item.clothingType);
  });

  const outers = outfitTops.filter(function (item) {
    return outerTypes.includes(item.clothingType);
  });

  // Allow one lightweight base with outer layers,
  // or one sweatshirt/sweater with a vest.
  const lightweightBasePattern =
    bases.length === 1 &&
    outers.length === outfitTops.length - 1;

  const sweatshirtAndVestPattern =
    outfitTops.length === 2 &&
    sweatshirtCount === 1 &&
    outfitTops.some(function (item) {
      return item.clothingType === "Vest";
    });

  if (!lightweightBasePattern && !sweatshirtAndVestPattern) return;

  // Outer pieces still need her permission to act as layers.
  const layeringItems = sweatshirtAndVestPattern
    ? outfitTops.filter(function (item) {
        return item.clothingType === "Vest";
      })
    : outers;

  if (layeringItems.some(function (item) {
    return !item.canLayer;
  })) return;

  // For NEW combinations, only use layering patterns
  // she has demonstrated by saving or logging them.
  if (!savedOutfit) {
    function topPattern(items) {
      return JSON.stringify(
        items.map(function (item) {
          return item.clothingType;
        }).sort()
      );
    }

    const requestedPattern = topPattern(outfitTops);
    const examples = [...data.outfits, ...data.history];

    const familiarPattern = examples.some(function (example) {
      const examplePieces = example.clothingIds.map(function (id) {
        return byId.get(id);
      });

      // Do not learn from incomplete outfits with deleted pieces.
      if (examplePieces.some(function (item) {
        return !item;
      })) return false;

      const exampleTops = examplePieces.filter(function (item) {
        return item.category === "Top";
      });

      return exampleTops.every(function (item) {
        return Boolean(item.clothingType);
      }) &&
        topPattern(exampleTops) === requestedPattern;
    });

    if (!familiarPattern) return;
  }
}
      const topCount = pieces.filter(function (item) {
        return item.category === "Top";
      }).length;

      // New three-top outfits require a saved three-top template.
      if (topCount === 3 && !savedOutfit && !threeTopTemplate) return;

      const totalWarmth = App.totalWarmth(pieces);
      if (totalWarmth < range.min || totalWarmth > range.max) return;

      // All pieces must share at least one selected style.
      // Selecting Fancy + Casual means either complete style works.
      const allowedStyles = styles.length ? styles : App.styles;

      const sharedStyle = allowedStyles.some(function (style) {
        return pieces.every(function (item) {
          return item.styles.includes(style);
        });
      });

      if (!sharedStyle) return;

      const stats = wearStats.get(key);
      const last = stats?.last || "";

      if (avoid && last) {
        const age = today - Decider.dayNumber(last);
        if (age >= 0 && age < days) return;
      }

      if (source === "saved" && !savedOutfit) return;
      // Existing means saved OR recorded in wear history.
if (source === "existing" && !savedOutfit && !stats) return;

      // New means unsaved and with no recorded wear history.
      if (source === "new" && (savedOutfit || stats)) return;

      // Weather fit contributes up to 30 points.
      // Cold days favor warmer totals without always choosing maximum.
      const weatherFit = range.ideal === null
        ? 1
        : Math.max(
            0.4,
            1 - Math.abs(totalWarmth - range.ideal) * 0.16
          );

      const similarity = Decider.similarity(pieces, references);
      const colors = Decider.colorScore(pieces);
      const wears = stats ? stats.dates.size : 0;

      // Score out of 100:
      // weather 30, favorite 30, similarity 15,
      // colors 15, recorded frequency 10.
      const score = Math.min(100, Math.round(
        weatherFit * 30 +
        (savedOutfit?.favorite ? 30 : 0) +
        similarity * 15 +
        colors * 15 +
        Math.min(wears / 5, 1) * 10
      ));

      candidates.set(key, {
        key: key,
        ids: ids,
        pieces: pieces,
        saved: savedOutfit,
        score: score,
        warmth: totalWarmth,
        last: last,
        similarity: similarity,
        wears: wears
      });
    }

    // First consider complete saved outfits.
    data.outfits.forEach(function (outfit) {
      consider(outfit.clothingIds);
    });
    // Include previously worn combinations even if their saved outfit
// was deleted. Missing or laundry clothing is still excluded.
if (source === "existing") {
  data.history.forEach(function (entry) {
    consider(entry.clothingIds);
  });
}

    // Yield occasionally so large closets do not freeze the page.
    let work = 0;

    async function pauseIfNeeded() {
      work++;

      if (work % 500 === 0) {
        await new Promise(function (resolve) {
          setTimeout(resolve, 0);
        });
      }

      return isCurrent();
    }

    if (source !== "saved") {
      // Generate one-top outfits.
      for (const top of tops) {
        for (const bottom of bottoms) {
          consider([top.id, bottom.id]);

          if (!await pauseIfNeeded()) return;
        }
      }

      // Generate two-top outfits when at least one top can layer.
      for (let a = 0; a < tops.length; a++) {
        for (let b = a + 1; b < tops.length; b++) {
          if (!tops[a].canLayer && !tops[b].canLayer) continue;

          for (const bottom of bottoms) {
            consider([tops[a].id, tops[b].id, bottom.id]);

            if (!await pauseIfNeeded()) return;
          }
        }
      }

      // Make similar variations by replacing one piece
      // in any complete saved outfit.
      for (const reference of references) {
        if (!reference.complete) continue;

        const topCount = reference.pieces.filter(function (item) {
          return item.category === "Top";
        }).length;

        for (let index = 0; index < reference.pieces.length; index++) {
          const original = reference.pieces[index];

          for (const replacement of typed) {
            if (
              replacement.category !== original.category ||
              replacement.clothingType !== original.clothingType ||
              reference.outfit.clothingIds.includes(replacement.id)
            ) continue;

            // Keep the base-top/layering-top role when swapping.
            if (
              original.category === "Top" &&
              replacement.canLayer !== original.canLayer
            ) continue;

            const ids = [...reference.outfit.clothingIds];
            ids[index] = replacement.id;

            consider(ids, topCount === 3);

            if (!await pauseIfNeeded()) return;
          }
        }
      }
    }

    if (!isCurrent()) return;

   // Sort once, without rendering anything inside the sort function.
const rankedResults = [...candidates.values()].sort(function (a, b) {
  return b.score - a.score || a.key.localeCompare(b.key);
});

// Home uses the same scores as ALL, without changing Decider's screen.
if (isPreview) {
  return rankedResults.filter(function (candidate) {
    return Boolean(candidate.saved) || !candidate.last;
  });
}

// Style This Piece gets its own results area.
if (requiredPieceId) {
  const destination = App.get("stylePieceResults");
  destination.replaceChildren();

  const visible = Decider.pieceMode === "new"
    ? rankedResults.slice(0, 3)
    : rankedResults;

  visible.forEach(function (candidate, index) {
    Decider.renderCard(candidate, index + 1, destination);
  });

  status.textContent = visible.length
    ? visible.length + " matching outfit(s), strongest first."
    : "No matching outfits for this piece.";

  return;
}

// Main Outfit Decider gets a fresh list and starts at the first result.
Decider.ranked = rankedResults;
Decider.shown = 0;

App.get("suggestionGrid").replaceChildren();

status.textContent = rankedResults.length
  ? rankedResults.length + " matching outfit(s), strongest first."
  : "No matches. Try another warmth range or adjust your filters.";

Decider.showMore();
  } catch (error) {
    if (isPreview) throw error;
    if (isCurrent()) {
      status.textContent = "Suggestions could not be loaded.";
    }
  }
};

// Display only the strongest outfits for the selected tab.
// Keep the old function name because existing code calls it.
Decider.showMore = function () {
  const mode = Decider.resultsMode || "all";

  // Maximum number of cards shown in each tab.
  const limits = {
    all: 8,
    saved: 5,
    new: 3
  };

  // The list is already sorted from strongest to weakest.
  // Filtering it keeps that same order.
  const matching = Decider.ranked.filter(function (candidate) {
    if (mode === "saved") {
      return Boolean(candidate.saved);
    }

    if (mode === "new") {
      // New combinations have not been saved or worn before.
      return !candidate.saved && !candidate.last;
    }

    // ALL combines saved outfits and new combinations.
    return Boolean(candidate.saved) || !candidate.last;
  });

  // Take only the requested number, or fewer if fewer qualify.
  const visible = matching.slice(0, limits[mode]);

  const grid = App.get("suggestionGrid");
  grid.replaceChildren();

  visible.forEach(function (candidate, index) {
    Decider.renderCard(candidate, index + 1, grid);
  });

  // Update which switch is highlighted.
  document.querySelectorAll("[data-suggestion-mode]").forEach(
    function (button) {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.suggestionMode === mode)
      );
    }
  );

  Decider.shown = visible.length;

  // There is no Show More button with these fixed limits.
  App.get("moreSuggestionsButton").hidden = true;

  App.get("deciderStatus").textContent = visible.length
    ? "Showing " + visible.length + " of " +
      matching.length + " matching outfits, strongest first."
    : "No matching outfits in this tab. Try another tab " +
      "or use Back to adjust your filters.";
};

// Build the side meter.
// Low scores are blue; high scores transition toward red.
Decider.meter = function (score) {
  const column = document.createElement("div");
  column.className = "match-column";

  const label = document.createElement("span");
  label.textContent = "Match";

  const track = document.createElement("div");
  track.className = "match-track";
  track.setAttribute("role", "meter");
  track.setAttribute("aria-label", "Recommendation strength");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(score));

  const fill = document.createElement("div");
  fill.className = "match-fill";
  fill.style.height = score + "%";

  // Increase red and decrease blue as the score increases.
  const red = Math.round(40 + score / 100 * 195);
  const blue = Math.round(220 - score / 100 * 170);
  fill.style.backgroundColor = "rgb(" + red + ", 55, " + blue + ")";

  const number = document.createElement("span");
  number.textContent = score + "/100";

  track.appendChild(fill);
  column.append(label, track, number);
  return column;
};

// Display a suggestion, save controls, and dismissal button.
Decider.renderCard = function (
  candidate,
  rank,
  destination = App.get("suggestionGrid")
) {
    // Never show saved or previously worn combinations in this popup.
// Apply popup-only rules only when rendering into the popup.
const stylingPiece =
  destination === App.get("stylePieceResults") &&
  Boolean(Decider.activePieceId);

if (stylingPiece) {
  // Both views must contain the exact selected piece.
  if (!candidate.ids.includes(Decider.activePieceId)) return;

  const existing = Boolean(candidate.saved || candidate.last);

  if (Decider.pieceMode === "new" && existing) return;
  if (Decider.pieceMode === "existing" && !existing) return;

  destination = App.get("stylePieceResults");
}
// Identify this outfit by its clothing pieces, ignoring their order.
const combinationKey = App.signature(candidate.ids);

// Do not display the same combination twice in this results area.
const alreadyDisplayed = [...destination.children].some(
  function (existingCard) {
    return existingCard.dataset.combinationKey === combinationKey;
  }
);

if (alreadyDisplayed) return;
  const card = document.createElement("div");
  // Remember which combination this card represents.
card.dataset.combinationKey = combinationKey;
  card.className = "saved-outfit-card";

  const layout = document.createElement("div");
  layout.className = "suggestion-layout";

  const content = document.createElement("div");

  const title = document.createElement("h3");
  title.textContent = "#" + rank + " — " +
  (candidate.saved ? "Saved Outfit" : "New Combination");

  const photos = document.createElement("div");
  photos.className = "outfit-photos";

  candidate.pieces.forEach(function (item) {
    photos.appendChild(App.photo(item));
  });

  // Saved suggestions use her outfit photo when available.
// New combinations continue showing individual clothing pieces.
if (candidate.saved && candidate.saved.photo) {
  photos.replaceChildren();

  const image = document.createElement("img");
  image.src = candidate.saved.photo;
  image.alt = candidate.saved.name || "Your outfit photo";
  image.className = "outfit-selfie";
  photos.appendChild(image);
}
  const reasons = [
    candidate.saved
      ? candidate.saved.favorite ? "★ Favorite" : "Saved outfit"
      : "New combination",
    "Total warmth: " + candidate.warmth
  ];

  if (!candidate.saved && candidate.similarity >= 0.65) {
    reasons.push("Similar to outfits you like");
  }

  if (candidate.wears >= 3) reasons.push("Frequently worn");

  reasons.push(candidate.last
    ? "Last worn " + History.formatDate(candidate.last)
    : "No recorded wears");

  const explanation = document.createElement("p");
  explanation.textContent = reasons.join(" • ");

  content.append(title, photos, explanation);
  // Log this suggestion directly, whether saved or new.
const log = document.createElement("button");
log.type = "button";
log.className = "primary";
log.textContent = "Log Outfit";

log.addEventListener("click", function () {
  History.openLog(candidate.ids);
});

content.appendChild(log);

  if (!candidate.saved) {
    const nameLabel = document.createElement("label");
    nameLabel.textContent = "Name — optional";

    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 80;
    nameLabel.appendChild(name);

    const starLabel = document.createElement("label");
    starLabel.className = "check-label";

    const star = document.createElement("input");
    star.type = "checkbox";

    starLabel.append(
      star,
      document.createTextNode(" ★ Save as a favorite")
    );

    const save = document.createElement("button");
    save.type = "button";
    save.className = "primary";
    save.textContent = "Add to My Outfits";

    save.addEventListener("click", async function () {
      App.busy(card, true);

      try {
        const data = await App.read(["clothes", "outfits"]);

        if (!candidate.ids.every(function (id) {
          return data.clothes.some(function (item) {
            return item.id === id;
          });
        })) throw new Error("Clothing was deleted");

        const exists = data.outfits.some(function (outfit) {
          return App.signature(outfit.clothingIds) === candidate.key;
        });

        if (!exists) {
          await App.write([{
            store: "outfits",
            value: {
              id: crypto.randomUUID(),
              // Keep this field empty for compatibility with existing records.
name: "",
              clothingIds: candidate.ids,
              favorite: star.checked,
              createdAt: new Date().toISOString()
            }
          }]);

          App.changed();
        } else {
          alert("This combination is already in My Outfits.");
          Decider.invalidate();
        }
      } catch (error) {
        alert("The outfit could not be saved. Refresh suggestions.");
      } finally {
        App.busy(card, false);
      }
    });

    // No outfit naming field.
content.append(starLabel, save);
  }

  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.className = "card-button";
  dismiss.textContent = "Don't suggest this outfit";

  dismiss.addEventListener("click", async function () {
    dismiss.disabled = true;

    try {
      await App.write([{
        store: "dismissed",
        value: {
          id: candidate.key,
          createdAt: new Date().toISOString()
        }
      }]);

      App.changed();
    } catch (error) {
      alert("This suggestion could not be dismissed.");
      dismiss.disabled = false;
    }
  });

  content.appendChild(dismiss);
  layout.append(content, Decider.meter(candidate.score));
  card.appendChild(layout);
  // Use either the main suggestions grid or the small popup.
// Store the score so the popup can keep only its strongest results.
card.dataset.matchScore = String(candidate.score);
// Keep the correct title when the top three cards are reordered.
card.dataset.outfitLabel = candidate.saved
  ? "Saved Outfit"
  : candidate.last
    ? "Previously Worn Outfit"
    : "New Combination";

    // Show the completed outfit card in the results grid.
destination.appendChild(card);

// Only NEW combinations are limited to three.
if (stylingPiece && Decider.pieceMode === "new") {
  // Sort every card currently in the popup by recommendation score.
  const cards = [...destination.children].sort(function (a, b) {
    return Number(b.dataset.matchScore) - Number(a.dataset.matchScore);
  });

  // Keep exactly the best three available cards.
  cards.forEach(function (result, index) {
    if (index >= 3) {
      result.remove();
    } else {
      destination.appendChild(result);

      // Update the displayed ranking after sorting.
      const heading = result.querySelector("h3");
      if (heading) {
        heading.textContent =
  "#" + (index + 1) + " — " + result.dataset.outfitLabel;
      }
    }
  });

  App.get("stylePieceStatus").textContent =
    "Top " + Math.min(3, cards.length) +
    (Decider.pieceMode === "new" ? " new" : " existing") +
" outfit(s), ranked by match score.";
}
};

// Allow all dismissed combinations again.
App.get("resetDismissedButton").addEventListener(
  "click", async function () {
    if (!confirm("Allow previously dismissed combinations again?")) return;

    this.disabled = true;

    try {
      const data = await App.read(["dismissed"]);

      await App.write(data.dismissed.map(function (item) {
        return { store: "dismissed", deleteId: item.id };
      }));

      App.changed();
    } catch (error) {
      alert("Dismissed suggestions could not be reset.");
    } finally {
      this.disabled = false;
    }
  }
);

App.get("suggestOutfitsButton").addEventListener(
  "click", Decider.generate
);

App.get("moreSuggestionsButton").addEventListener(
  "click", Decider.showMore
);

// Refresh suggestions after saving, deleting, or changing laundry.
document.addEventListener("closet-data-changed", Decider.invalidate);

// Clear stale suggestions when opening the page.
document.addEventListener("closet-page-changed", function () {
  if (!App.get("deciderPage").hidden) Decider.invalidate();
});
// Open recommendations for a single clothing item.
Decider.stylePiece = async function (itemId) {
  const dialog = App.get("stylePieceDialog");
  const status = App.get("stylePieceStatus");

  App.get("stylePieceResults").replaceChildren();
  // Make the selected toggle match the current view.
App.get("stylePieceNew").setAttribute(
  "aria-pressed", String(Decider.pieceMode === "new")
);

App.get("stylePieceExisting").setAttribute(
  "aria-pressed", String(Decider.pieceMode === "existing")
);
  App.get("stylePieceHeading").textContent = "Style This Piece";
  status.textContent = "Finding outfits...";

  if (!dialog.open) dialog.showModal();

  try {
    // Read fresh information rather than using an old card's data.
    const data = await App.read(["clothes"]);

    const item = data.clothes.find(function (clothing) {
      return clothing.id === itemId;
    });

    if (!dialog.open) return;

    if (!item) {
      status.textContent = "This item is no longer in your closet.";
      return;
    }

    App.get("stylePieceHeading").textContent = "Style " + item.name;
    // Existing outfits are a complete list, not newly generated suggestions.
Decider.activePieceId = item.id;

if (Decider.pieceMode === "existing") {
  await Decider.showExistingForPiece(item.id);
  return;
}

    if (item.inLaundry) {
      status.textContent =
        "This piece is in the laundry. Mark it clean to get suggestions.";
      return;
    }

    // Reuse the ranking system with this item required.
    // Remember the exact piece required in this popup.
Decider.activePieceId = item.id;
    await Decider.generate({
      pieceId: item.id,
      pieceStyles: item.styles
    });
  } catch (error) {
    status.textContent = "Suggestions could not be loaded.";
  }
};

App.get("closeStylePiece").addEventListener("click", function () {
  App.get("stylePieceDialog").close();
});

// Stop an unfinished search when the popup closes.
App.get("stylePieceDialog").addEventListener("close", function () {
  Decider.requestNumber++;
});
// Remember which view is selected in the clothing popup.
Decider.pieceMode = "new";

Decider.changePieceMode = function (mode) {
  Decider.pieceMode = mode;

  App.get("stylePieceNew").setAttribute(
    "aria-pressed", String(mode === "new")
  );

  App.get("stylePieceExisting").setAttribute(
    "aria-pressed", String(mode === "existing")
  );

  // Run a fresh search for the same clothing item.
  if (Decider.activePieceId) {
    Decider.stylePiece(Decider.activePieceId);
  }
};

App.get("stylePieceNew").addEventListener("click", function () {
  Decider.changePieceMode("new");
});

App.get("stylePieceExisting").addEventListener("click", function () {
  Decider.changePieceMode("existing");
});
// Show every saved combination containing the selected piece.
// Weather affects ranking, but does not exclude existing outfits.
Decider.showExistingForPiece = async function (itemId) {
  const request = ++Decider.requestNumber;
  const status = App.get("stylePieceStatus");
  const destination = App.get("stylePieceResults");

  destination.replaceChildren();
  status.textContent = "Loading existing outfits...";

  try {
    const data = await App.read(["outfits", "clothes", "history"]);

    // Ignore a result if she switched views or closed the popup.
    if (
      request !== Decider.requestNumber ||
      !App.get("stylePieceDialog").open ||
      Decider.pieceMode !== "existing"
    ) return;

    const byId = new Map(data.clothes.map(function (item) {
      return [item.id, item];
    }));

    const range = Decider.weatherRange
      ? Decider.ranges[Decider.weatherRange]
      : Decider.ranges.any;

    // Build references used by our normal similarity scoring.
    const references = data.outfits.map(function (outfit) {
      const key = App.signature(outfit.clothingIds);

      const wearDays = new Set(
        data.history.filter(function (entry) {
          return App.signature(entry.clothingIds) === key;
        }).map(function (entry) {
          return entry.date;
        })
      );

      return {
        pieces: outfit.clothingIds.map(function (id) {
          return byId.get(id);
        }).filter(Boolean),
        favorite: outfit.favorite,
        wears: wearDays.size
      };
    });

    const combinations = new Map();

    data.outfits.forEach(function (outfit) {
      // Only include outfits containing this exact clothing item.
      if (!outfit.clothingIds.includes(itemId)) return;

      const key = App.signature(outfit.clothingIds);

      const pieces = outfit.clothingIds.map(function (id) {
        return byId.get(id);
      }).filter(Boolean);

      const dates = data.history.filter(function (entry) {
        return App.signature(entry.clothingIds) === key;
      }).map(function (entry) {
        return entry.date;
      }).sort();

      const wears = new Set(dates).size;
      const warmth = App.totalWarmth(pieces);

      const complete = pieces.length === outfit.clothingIds.length;

      // Weather fit changes the score, not whether the outfit appears.
      const weatherFit = !complete
        ? 0
        : range.ideal === null
          ? 1
          : Math.max(
              0,
              1 - Math.abs(warmth - range.ideal) * 0.16
            );

      const similarity = Decider.similarity(pieces, references);

      const score = Math.min(100, Math.round(
        weatherFit * 30 +
        (outfit.favorite ? 30 : 0) +
        similarity * 15 +
        Decider.colorScore(pieces) * 15 +
        Math.min(wears / 5, 1) * 10
      ));

      const candidate = {
        key: key,
        ids: outfit.clothingIds,
        pieces: pieces,
        saved: outfit,
        score: score,
        warmth: warmth,
        last: dates.length ? dates[dates.length - 1] : "",
        similarity: similarity,
        wears: wears
      };

      // Show duplicate saved combinations only once.
      const previous = combinations.get(key);

      if (!previous || candidate.score > previous.score) {
        combinations.set(key, candidate);
      }
    });

    const ranked = [...combinations.values()].sort(function (a, b) {
      return b.score - a.score || a.key.localeCompare(b.key);
    });

    ranked.forEach(function (candidate, index) {
      Decider.renderCard(candidate, index + 1, destination);
    });

    status.textContent = ranked.length
      ? ranked.length + " saved outfit(s), strongest match first."
      : "No saved outfits contain this piece yet.";
  } catch (error) {
    if (request === Decider.requestNumber) {
      status.textContent = "Existing outfits could not be loaded.";
    }
  }
};
// Place the popup outside the individual app pages.
document.body.appendChild(App.get("suggestionsDialog"));

// ALL is the default results tab.
Decider.resultsMode = "all";

// Back closes the popup without changing any filters.
App.get("backFromSuggestionsButton").addEventListener(
  "click",
  function () {
    App.get("suggestionsDialog").close();

    // Return keyboard focus to the button that opened it.
    App.get("suggestOutfitsButton").focus();
  }
);

// Switch between the already-ranked outfit lists.
document.querySelectorAll("[data-suggestion-mode]").forEach(
  function (button) {
    button.addEventListener("click", function () {
      Decider.resultsMode = this.dataset.suggestionMode;

      document.querySelectorAll("[data-suggestion-mode]").forEach(
        function (switchButton) {
          switchButton.setAttribute(
            "aria-pressed",
            String(
              switchButton.dataset.suggestionMode ===
              Decider.resultsMode
            )
          );
        }
      );

      // If generation is still running, it will use this selection
      // when it finishes. Otherwise, display the selected list now.
      if (Decider.ranked.length > 0) {
        Decider.showMore();
      }

      // Start each tab at the top of the popup.
      App.get("suggestionsDialog").scrollTop = 0;
    });
  }
);