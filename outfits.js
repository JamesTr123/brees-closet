// SAVED OUTFITS AND THE OUTFIT BUILDER
const Outfits = {
  clothes: [],
  selected: new Set(),
  favorite: false,
  favoritesOnly: false,
  logDate: null,
  busy: false,
  refreshNumber: 0,
  builderRefresh: 0
};

App.fillColors(App.get("outfitColorFilter"));

// Add both top and bottom clothing types to the filter.
Object.values(App.types).flat().forEach(function (type) {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type;
  App.get("outfitTypeFilter").appendChild(option);
});

// Show selected pieces together and add their warmth ratings.
Outfits.preview = function () {
  const preview = App.get("outfitPreview");
  preview.replaceChildren();

  const pieces = Outfits.clothes.filter(function (item) {
    return Outfits.selected.has(item.id);
  });

  pieces.forEach(function (item) {
    preview.appendChild(App.photo(item));
  });

  if (!pieces.length) {
    preview.textContent = "Your selected clothes will appear here.";
  }

  App.get("outfitTotalWarmth").textContent =
    "Total warmth: " + App.totalWarmth(pieces);
};

Outfits.clearFilters = function () {
  [
    "outfitSearch",
    "outfitCategoryFilter",
    "outfitTypeFilter",
    "outfitColorFilter",
    "outfitWarmthFilter",
    "outfitStyleFilter"
  ].forEach(function (id) {
    App.get(id).value = "";
  });
};

// Display only clothes matching the active filters.
Outfits.renderChoices = function () {
  const grid = App.get("outfitClothingGrid");
  grid.replaceChildren();

  const search = App.get("outfitSearch").value.trim().toLowerCase();
  const category = App.get("outfitCategoryFilter").value;
  const type = App.get("outfitTypeFilter").value;
  const color = App.get("outfitColorFilter").value;
  const warmth = App.get("outfitWarmthFilter").value;
  const style = App.get("outfitStyleFilter").value;

  const matches = Outfits.clothes.filter(function (item) {
    return item.name.toLowerCase().includes(search) &&
      (!category || item.category === category) &&
      (!type || item.clothingType === type) &&
      (!color || item.color === color) &&
      (!warmth || item.warmth === Number(warmth)) &&
      (!style || item.styles.includes(style));
  });

  App.get("outfitStatus").textContent =
    matches.length + " matching item(s). " +
    Outfits.selected.size + " selected. Laundry items can be used for planning.";

  matches.forEach(function (item) {
    const card = document.createElement("label");
    card.className = "outfit-choice";

    const name = document.createElement("span");
    name.textContent = item.name +
      (item.inLaundry ? " — In laundry" : "");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Outfits.selected.has(item.id);
    checkbox.disabled = Outfits.busy;

    checkbox.addEventListener("change", function () {
      if (checkbox.checked) {
        const selectedPieces = Outfits.clothes.filter(function (piece) {
          return Outfits.selected.has(piece.id);
        });

        if (
          item.category === "Bottom" &&
          selectedPieces.some(function (piece) {
            return piece.category === "Bottom";
          })
        ) {
          checkbox.checked = false;
          alert("Uncheck the current bottom before choosing another.");
          return;
        }

        if (
          item.category === "Top" &&
          selectedPieces.filter(function (piece) {
            return piece.category === "Top";
          }).length >= 3
        ) {
          checkbox.checked = false;
          alert("Choose up to three tops.");
          return;
        }

        Outfits.selected.add(item.id);
      } else {
        Outfits.selected.delete(item.id);
      }

      Outfits.preview();
      Outfits.renderChoices();
    });

    card.append(
      App.photo(item),
      name,
      checkbox,
      document.createTextNode(" Include in outfit")
    );

    grid.appendChild(card);
  });
};

// Load fresh clothing while preserving current selections.
Outfits.loadChoices = async function () {
  const current = ++Outfits.builderRefresh;

  try {
    const data = await App.read(["clothes"]);
    if (current !== Outfits.builderRefresh) return;

    Outfits.clothes = data.clothes;

    Outfits.selected.forEach(function (id) {
      if (!data.clothes.some(function (item) {
        return item.id === id;
      })) {
        Outfits.selected.delete(id);
      }
    });

    Outfits.renderChoices();
    Outfits.preview();
  } catch (error) {
    App.get("outfitStatus").textContent = "Clothing could not be loaded.";
  }
};

// Open the builder normally, or with a date to also log the outfit.
Outfits.openBuilder = function (date = null) {
  if (Outfits.busy || History.busy) return;

  Outfits.selected.clear();
  Outfits.favorite = false;
  Outfits.logDate = date;
  Outfits.clearFilters();

  App.get("outfitName").value = "";
  // A canceled photo load must not leave Save disabled.
App.get("saveOutfitButton").disabled = false;
  App.get("favoriteStar").textContent = "☆ Add to favorites";
  App.get("favoriteStar").setAttribute("aria-pressed", "false");

  App.get("builderHeading").textContent =
    date ? "Create an Outfit to Log" : "Create an Outfit";

  App.get("saveOutfitButton").textContent =
    date ? "Save & Log — " + History.formatDate(date) : "Save Outfit";

  App.get("logOutfitPanel").hidden = true;
  App.get("outfitBuilder").hidden = false;
  // Start with no outfit photo for each new outfit.
Outfits.resetPhoto();

// Open the builder as a popup above the page.
if (!App.get("outfitDialog").open) {
  App.get("outfitDialog").showModal();
}

// Stop the background page from scrolling.
document.body.style.overflow = "hidden";
  Outfits.loadChoices();
};

Outfits.closeBuilder = function () {
  Outfits.builderRefresh++;
  Outfits.selected.clear();
  Outfits.logDate = null;
  App.get("outfitBuilder").hidden = true;
  // Close the popup and allow the background page to scroll again.
if (App.get("outfitDialog").open) {
  App.get("outfitDialog").close();
}

document.body.style.overflow = "";
Outfits.resetPhoto();
};

App.get("addOutfitButton").addEventListener("click", function () {
  Outfits.openBuilder();
});

App.get("cancelOutfitButton").addEventListener("click", function () {
  if (!Outfits.busy) Outfits.closeBuilder();
});

App.get("favoriteStar").addEventListener("click", function () {
  Outfits.favorite = !Outfits.favorite;
  this.textContent = Outfits.favorite ? "★ Favorite" : "☆ Add to favorites";
  this.setAttribute("aria-pressed", String(Outfits.favorite));
});

App.get("outfitSearch").addEventListener("input", Outfits.renderChoices);

[
  "outfitCategoryFilter",
  "outfitTypeFilter",
  "outfitColorFilter",
  "outfitWarmthFilter",
  "outfitStyleFilter"
].forEach(function (id) {
  App.get(id).addEventListener("change", Outfits.renderChoices);
});

App.get("clearOutfitFilters").addEventListener("click", function () {
  Outfits.clearFilters();
  Outfits.renderChoices();
});

// Save or log a combination, reusing it if already saved.
App.get("saveOutfitButton").addEventListener("click", async function () {
  if (Outfits.busy) return;

  Outfits.busy = true;
  App.busy(App.get("outfitBuilder"), true);
  App.get("saveOutfitButton").textContent = "Saving...";

  let saved = null;

  try {
    const data = await App.read(["clothes"]);

    const pieces = data.clothes.filter(function (item) {
      return Outfits.selected.has(item.id);
    });

    if (pieces.length !== Outfits.selected.size) {
      throw new Error("A selected item was deleted. Please choose again.");
    }

    const tops = pieces.filter(function (item) {
      return item.category === "Top";
    });

    const baseTops = tops.filter(function (item) {
      return !item.canLayer;
    });

    if (tops.length > 1 && baseTops.length > 1) {
      throw new Error(
        "Extra tops must be marked as able to go over another top."
      );
    }

    saved = await History.commitCombination(
      [...Outfits.selected],
      Outfits.logDate,
      Outfits.favorite,
      Outfits.photo || ""
    );

    Outfits.favoritesOnly = false;
    Outfits.closeBuilder();
    App.changed();
  } catch (error) {
    alert(error.message);
  } finally {
    Outfits.busy = false;
    App.busy(App.get("outfitBuilder"), false);

    App.get("saveOutfitButton").textContent = Outfits.logDate
      ? "Log Outfit — " + History.formatDate(Outfits.logDate)
      : "Save Outfit";
  }

  if (saved) {
    try {
      await OutfitPhotos.offer(
        saved.outfit.id,
        saved.entry ? saved.entry.id : null
      );
    } catch (error) {
      alert("Outfit saved, but the photo prompt could not open.");
    }
  }
});

// Show saved outfits, favorites, and last worn dates.
Outfits.renderSaved = async function () {
  const current = ++Outfits.refreshNumber;

  try {
    const data = await App.read(["outfits", "clothes", "history"]);
    if (current !== Outfits.refreshNumber) return;

    const grid = App.get("savedOutfitGrid");
    grid.replaceChildren();

    const visible = data.outfits.filter(function (outfit) {
      return !Outfits.favoritesOnly || outfit.favorite;
    });

    App.get("showAllOutfits").setAttribute(
      "aria-pressed", String(!Outfits.favoritesOnly)
    );

    App.get("showFavoriteOutfits").setAttribute(
      "aria-pressed", String(Outfits.favoritesOnly)
    );

    App.get("savedOutfitStatus").textContent = visible.length
      ? visible.length + " outfit(s)"
      : Outfits.favoritesOnly
        ? "No favorite outfits yet."
        : "No saved outfits yet. Tap ♡ Add Outfit.";

    visible.forEach(function (outfit) {
      const card = document.createElement("div");
      card.className = "saved-outfit-card";

      const title = document.createElement("h3");
      // Outfit photos identify the outfit instead of a name.
title.hidden = true;

      const key = App.signature(outfit.clothingIds);

      // Compare pieces rather than outfit names.
      const dates = data.history.filter(function (entry) {
        return App.signature(entry.clothingIds) === key;
      }).map(function (entry) {
        return entry.date;
      }).sort();

      const lastWorn = document.createElement("p");
      lastWorn.textContent = dates.length
        ? "Last worn: " + History.formatDate(dates[dates.length - 1])
        : "Not logged yet";

      const photos = document.createElement("div");
      photos.className = "outfit-photos";

      let missing = 0;
      let laundry = 0;
      const pieces = [];

      outfit.clothingIds.forEach(function (id) {
        const item = data.clothes.find(function (record) {
          return record.id === id;
        });

        if (!item) {
          missing++;
          return;
        }

        pieces.push(item);
        if (item.inLaundry) laundry++;
        photos.appendChild(App.photo(item));
      });

      // Prefer her outfit photo when one was saved.
// Otherwise keep the individual clothing photos already added.
if (outfit.photo) {
  photos.replaceChildren();

  const image = document.createElement("img");
  image.src = outfit.photo;
  image.alt = outfit.name || "Your outfit photo";
  image.className = "outfit-selfie";
  photos.appendChild(image);
}
      const note = document.createElement("p");
      const messages = ["Total warmth: " + App.totalWarmth(pieces)];

      if (missing) messages.push(missing + " piece(s) removed");
      if (laundry) messages.push(laundry + " piece(s) in laundry");

      note.textContent = messages.join(" • ");

      const star = document.createElement("button");
      star.type = "button";
      star.className = "card-button";
      star.textContent = outfit.favorite ? "★ Favorite" : "☆ Favorite";
      star.setAttribute("aria-pressed", String(outfit.favorite));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "card-button";
      remove.textContent = "Delete Outfit";

      star.addEventListener("click", async function () {
        star.disabled = true;
        remove.disabled = true;

        try {
          await App.write([{
            store: "outfits",
            value: { ...outfit, favorite: !outfit.favorite }
          }]);
          App.changed();
        } catch (error) {
          alert("Favorite could not be updated.");
        } finally {
          star.disabled = false;
          remove.disabled = false;
        }
      });

      remove.addEventListener("click", async function () {
        if (!confirm(
          "Delete this outfit? Its clothes and wear history will stay."
        )) return;

        star.disabled = true;
        remove.disabled = true;

        try {
          await App.write([{ store: "outfits", deleteId: outfit.id }]);
          App.changed();
        } catch (error) {
          alert("The outfit could not be deleted.");
        } finally {
          star.disabled = false;
          remove.disabled = false;
        }
      });

const log = document.createElement("button");
log.type = "button";
log.className = "primary";
log.textContent = "Log Outfit";

log.addEventListener("click", function () {
  History.openLog(outfit.clothingIds);
});

card.appendChild(log);

      card.append(title, lastWorn, photos, note, star, remove);
      grid.appendChild(card);
    });
  } catch (error) {
    App.get("savedOutfitStatus").textContent = "Outfits could not be loaded.";
  }
};

App.get("showAllOutfits").addEventListener("click", function () {
  Outfits.favoritesOnly = false;
  Outfits.renderSaved();
});

App.get("showFavoriteOutfits").addEventListener("click", function () {
  Outfits.favoritesOnly = true;
  Outfits.renderSaved();
});

function refreshOutfitsIfVisible() {
  if (App.get("outfitsPage").hidden) return;

  Outfits.renderSaved();

  if (!App.get("outfitBuilder").hidden) Outfits.loadChoices();
}

document.addEventListener("closet-page-changed", refreshOutfitsIfVisible);
document.addEventListener("closet-data-changed", refreshOutfitsIfVisible);
// Hold the optional photo while she builds an outfit.
Outfits.photo = "";
Outfits.photoRequest = 0;

// Remove an unfinished outfit photo.
Outfits.resetPhoto = function () {
  // Ignore any older photo reading that is still finishing.
  Outfits.photoRequest++;

  Outfits.photo = "";
  App.get("outfitPhotoInput").value = "";

  App.get("outfitPhotoPreview").removeAttribute("src");
  App.get("outfitPhotoPreview").hidden = true;
  App.get("removeOutfitPhotoButton").hidden = true;
};

// Read a photo chosen or taken from her phone.
App.get("outfitPhotoInput").addEventListener("change", function () {
  const file = this.files[0];
  this.value = "";

  if (!file || Outfits.busy) return;

  const request = ++Outfits.photoRequest;
  const reader = new FileReader();

  // Prevent saving before the selected photo has finished loading.
  App.get("saveOutfitButton").disabled = true;

  reader.onload = function () {
    if (request !== Outfits.photoRequest) return;

    Outfits.photo = reader.result;
    App.get("outfitPhotoPreview").src = Outfits.photo;
    App.get("outfitPhotoPreview").hidden = false;
    App.get("removeOutfitPhotoButton").hidden = false;
    App.get("saveOutfitButton").disabled = false;
  };

  reader.onerror = function () {
    if (request !== Outfits.photoRequest) return;

    App.get("saveOutfitButton").disabled = false;
    alert("That outfit photo could not be opened.");
  };

  // Read locally without uploading it to a server.
  reader.readAsDataURL(file);
});

App.get("removeOutfitPhotoButton").addEventListener(
  "click", function () {
    Outfits.resetPhoto();
    App.get("saveOutfitButton").disabled = false;
  }
);

// Handle Escape or the phone/browser's dialog cancel action.
App.get("outfitDialog").addEventListener("cancel", function (event) {
  event.preventDefault();

  // Keep the popup open while saving.
  if (!Outfits.busy) Outfits.closeBuilder();
});

// Restore scrolling if the dialog is closed.
App.get("outfitDialog").addEventListener("close", function () {
  document.body.style.overflow = "";
});