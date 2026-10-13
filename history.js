// OUTFIT LOGGING AND WEAR HISTORY
const History = {
  busy: false,
  outfits: [],
  clothes: [],
  refreshNumber: 0,
  pickerRefresh: 0
};

// Use the device's local date.
History.today = function () {
  const date = new Date();

  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
};

// Reject invalid or future wear dates.
History.validDate = function (value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const date = new Date(value + "T12:00:00");

  return Number.isFinite(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10)) &&
    value <= History.today();
};

History.formatDate = function (value) {
  return new Date(value + "T12:00:00").toLocaleDateString();
};

// Keep this record even if its saved outfit is deleted later.
History.makeEntry = function (outfit, date) {
  return {
    id: crypto.randomUUID(),
    outfitId: outfit.id,
    outfitName: outfit.name,
    // Keep the outfit photo with this history entry too.
outfitPhoto: outfit.photo || "",
    clothingIds: [...outfit.clothingIds],
    date: date
  };
};

// Preview the selected saved outfit.
History.preview = function () {
  const preview = App.get("logOutfitPreview");
  preview.replaceChildren();

  const outfit = History.outfits.find(function (item) {
    return item.id === App.get("logOutfitSelect").value;
  });

  if (!outfit) return;

  let missing = 0;

  outfit.clothingIds.forEach(function (id) {
    const item = History.clothes.find(function (record) {
      return record.id === id;
    });

    if (item) preview.appendChild(App.photo(item));
    else missing++;
  });

  // Use the outfit photo in the logging preview when available.
if (outfit.photo) {
  preview.replaceChildren();

  const image = document.createElement("img");
  image.src = outfit.photo;
  image.alt = outfit.name || "Your outfit photo";
  image.className = "outfit-selfie";
  preview.appendChild(image);
}
  App.get("logStatus").textContent = missing
    ? missing + " piece(s) are no longer in your closet."
    : "Choose the date and log this outfit.";
};

// Fill the saved outfit dropdown.
History.loadPicker = async function () {
  const current = ++History.pickerRefresh;
  const previous = App.get("logOutfitSelect").value;

  try {
    const data = await App.read(["outfits", "clothes"]);
    if (current !== History.pickerRefresh) return;

    History.outfits = data.outfits;
    History.clothes = data.clothes;

    const select = App.get("logOutfitSelect");
    select.replaceChildren();

    data.outfits.forEach(function (outfit, index) {
      const option = document.createElement("option");
      option.value = outfit.id;
      option.textContent = outfit.name || "Unnamed Outfit " + (index + 1);
      select.appendChild(option);
    });

    if (data.outfits.some(function (outfit) {
      return outfit.id === previous;
    })) {
      select.value = previous;
    }

    App.get("logStatus").textContent = data.outfits.length
      ? "Choose a saved outfit, or create a new one."
      : "No saved outfits yet. Create a new one below.";

    History.preview();
  } catch (error) {
    App.get("logStatus").textContent = "Saved outfits could not be loaded.";
  }
};

App.get("logOutfitSelect").addEventListener("change", History.preview);

App.get("openLogButton").addEventListener("click", function () {
  if (History.busy || Outfits.busy) return;

  Outfits.closeBuilder();
  App.get("wearDate").value = History.today();
  App.get("wearDate").max = History.today();
  App.get("logOutfitPanel").hidden = false;

  History.loadPicker();
});

App.get("closeLogButton").addEventListener("click", function () {
  if (History.busy) return;

  History.pickerRefresh++;
  App.get("logOutfitPanel").hidden = true;
});

App.get("createAndLogButton").addEventListener("click", function () {
  const date = App.get("wearDate").value;

  if (!History.validDate(date)) {
    App.get("logStatus").textContent = "Choose today or a valid earlier date.";
    return;
  }

  Outfits.openBuilder(date);
});

// Log a saved outfit without creating another saved copy.
App.get("logSavedButton").addEventListener("click", async function () {
  if (History.busy) return;

  const date = App.get("wearDate").value;
  const outfitId = App.get("logOutfitSelect").value;

  if (!History.validDate(date)) {
    App.get("logStatus").textContent = "Choose today or a valid earlier date.";
    return;
  }

  History.busy = true;
  App.busy(App.get("logOutfitPanel"), true);

  try {
    const data = await App.read(["outfits", "history"]);

    const outfit = data.outfits.find(function (item) {
      return item.id === outfitId;
    });

    if (!outfit) {
      App.get("logStatus").textContent = "Choose a saved outfit first.";
      return;
    }

    const key = App.signature(outfit.clothingIds);

    const duplicate = data.history.some(function (entry) {
      return App.signature(entry.clothingIds) === key &&
        entry.date === date;
    });

    if (duplicate) {
      App.get("logStatus").textContent = "Already logged for that date.";
      return;
    }

    // Keep the entry's ID for the photo prompt.
const wearEntry = History.makeEntry(outfit, date);

await App.write([{
  store: "history",
  value: wearEntry
}]);

    App.get("logOutfitPanel").hidden = true;
    App.changed();
    // Update this wear entry and the saved outfit with the newest photo.
await OutfitPhotos.offer(outfit.id, wearEntry.id);
  } catch (error) {
    App.get("logStatus").textContent = "The outfit could not be logged.";
  } finally {
    History.busy = false;
    App.busy(App.get("logOutfitPanel"), false);
  }
});

// Display history with newest wear dates first.
History.render = async function () {
  const current = ++History.refreshNumber;

  try {
    const data = await App.read(["history", "clothes"]);
    if (current !== History.refreshNumber) return;

    const list = App.get("wearHistoryList");
    list.replaceChildren();

    data.history.sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });

    App.get("wearHistoryStatus").textContent =
      data.history.length ? "" : "No outfits logged yet.";

    data.history.forEach(function (entry) {
      const card = document.createElement("div");
      card.className = "wear-history-card";

      const title = document.createElement("h3");
      title.textContent = entry.outfitName || "Unnamed Outfit";

      const photos = document.createElement("div");
      photos.className = "outfit-photos";

      entry.clothingIds.forEach(function (id) {
        const item = data.clothes.find(function (record) {
          return record.id === id;
        });

        if (item) photos.appendChild(App.photo(item));
      });

      // Prefer the photo recorded with this wear-history entry.
if (entry.outfitPhoto) {
  photos.replaceChildren();

  const image = document.createElement("img");
  image.src = entry.outfitPhoto;
  image.alt = entry.outfitName || "Your outfit photo";
  image.className = "outfit-selfie";
  photos.appendChild(image);
}
      const dateInput = document.createElement("input");
      dateInput.type = "date";
      dateInput.value = entry.date;
      dateInput.max = History.today();

      const dateLabel = document.createElement("label");
      dateLabel.textContent = "Date worn";
      dateLabel.appendChild(dateInput);

      const update = document.createElement("button");
      update.type = "button";
      update.textContent = "Update Date";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "card-button";
      remove.textContent = "Delete Entry";

      update.addEventListener("click", async function () {
        const date = dateInput.value;

        if (!History.validDate(date)) {
          alert("Choose today or a valid earlier date.");
          return;
        }

        App.busy(card, true);

        try {
          const fresh = await App.read(["history"]);

          const latest = fresh.history.find(function (item) {
            return item.id === entry.id;
          });

          if (!latest) throw new Error("Entry was deleted");

          const key = App.signature(latest.clothingIds);

          const duplicate = fresh.history.some(function (other) {
            return other.id !== entry.id &&
              App.signature(other.clothingIds) === key &&
              other.date === date;
          });

          if (duplicate) {
            alert("This combination is already logged for that date.");
            return;
          }

          await App.write([{
            store: "history",
            value: { ...latest, date: date }
          }]);

          App.changed();
        } catch (error) {
          alert("The date could not be updated.");
        } finally {
          App.busy(card, false);
        }
      });

      remove.addEventListener("click", async function () {
        if (!confirm(
          "Delete this history entry? The saved outfit will stay."
        )) return;

        App.busy(card, true);

        try {
          await App.write([{ store: "history", deleteId: entry.id }]);
          App.changed();
        } catch (error) {
          alert("The entry could not be deleted.");
        } finally {
          App.busy(card, false);
        }
      });

      card.append(title, photos, dateLabel, update, remove);
      list.appendChild(card);
    });
  } catch (error) {
    App.get("wearHistoryStatus").textContent = "History could not be loaded.";
  }
};

function refreshHistoryIfVisible() {
  if (!App.get("outfitsPage").hidden) History.render();
}

document.addEventListener("closet-page-changed", refreshHistoryIfVisible);

document.addEventListener("closet-data-changed", function () {
  refreshHistoryIfVisible();

  if (!App.get("logOutfitPanel").hidden && !History.busy) {
    History.loadPicker();
  }
});