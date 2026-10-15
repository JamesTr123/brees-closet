// LOGGING POPUP AND WEAR HISTORY
const History = {
  busy: false,
  outfits: [],
  clothes: [],
  selectedIds: [],
  extraIds: [],
  refreshNumber: 0,
  pickerRefresh: 0
};

// Put the dialog directly in the body so it can open from any tab.
document.body.appendChild(App.get("logOutfitDialog"));

// Local calendar dates avoid time-zone shifts.
History.today = function () {
  const date = new Date();

  return date.getFullYear() + "-" +
    String(date.getMonth() + 1).padStart(2, "0") + "-" +
    String(date.getDate()).padStart(2, "0");
};

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

// Keep names empty for compatibility with existing backups.
// The interface identifies outfits by their photos.
History.makeEntry = function (outfit, date) {
  return {
    id: crypto.randomUUID(),
    outfitId: outfit.id,
    outfitName: "",
    outfitPhoto: outfit.photo || "",
    clothingIds: [...outfit.clothingIds],
    date: date
  };
};

// Find a saved outfit containing exactly these pieces.
// Prefer a favorite if older duplicate records exist.
History.findSaved = function (outfits, ids) {
  const key = App.signature(ids);

  return outfits.filter(function (outfit) {
    return App.signature(outfit.clothingIds) === key;
  }).sort(function (a, b) {
    return Number(b.favorite) - Number(a.favorite);
  })[0];
};

// Save a combination, optionally recording when it was worn.
// Reuse an existing saved combination instead of adding a duplicate.
History.commitCombination = async function (
  ids,
  date = null,
  favorite = false,
  photo = ""
) {
  if (date !== null && !History.validDate(date)) {
    throw new Error("Choose today or a valid earlier date.");
  }

  const uniqueIds = [...new Set(ids)];

  const data = await App.read(["clothes", "outfits", "history"]);
  const pieces = uniqueIds.map(function (id) {
    return data.clothes.find(function (item) {
      return item.id === id;
    });
  });

  if (pieces.some(function (item) {
    return !item;
  })) {
    throw new Error(
      "A piece is no longer in your closet. Choose another outfit."
    );
  }

  const tops = pieces.filter(function (item) {
    return item.category === "Top";
  });

  const bottoms = pieces.filter(function (item) {
    return item.category === "Bottom";
  });

  if (!tops.length || tops.length > 3 || bottoms.length !== 1) {
    throw new Error("Choose one bottom and one to three tops.");
  }

  let outfit = History.findSaved(data.outfits, uniqueIds);
  const changes = [];

  if (!outfit) {
    // New combinations become saved outfits automatically.
    outfit = {
      id: crypto.randomUUID(),
      name: "",
      clothingIds: uniqueIds,
      favorite: Boolean(favorite),
      photo: photo || "",
      createdAt: new Date().toISOString()
    };

    changes.push({ store: "outfits", value: outfit });
  } else if (
    (favorite && !outfit.favorite) ||
    (photo && photo !== outfit.photo)
  ) {
    // Preserve its existing photo and favorite unless updating them.
    outfit = {
      ...outfit,
      favorite: outfit.favorite || favorite,
      photo: photo || outfit.photo || ""
    };

    changes.push({ store: "outfits", value: outfit });
  }

  let entry = null;

  if (date !== null) {
    const key = App.signature(uniqueIds);

    const duplicate = data.history.some(function (record) {
      return App.signature(record.clothingIds) === key &&
        record.date === date;
    });

    if (duplicate) {
      throw new Error("This outfit is already logged for that date.");
    }

    entry = History.makeEntry(outfit, date);
    changes.push({ store: "history", value: entry });
  }

  // New outfit and history entry save together.
  await App.write(changes);

  return { outfit: outfit, entry: entry };
};

// Fill the logging filters.
App.fillColors(App.get("logColorFilter"));

Object.values(App.types).flat().forEach(function (type) {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type;
  App.get("logTypeFilter").appendChild(option);
});

// Show an outfit photo, or fall back to clothing-piece photos.
History.addPhotos = function (container, outfit, ids) {
  if (outfit?.photo) {
    const image = document.createElement("img");
    image.src = outfit.photo;
    image.alt = "Outfit photo";
    image.className = "outfit-selfie";
    container.appendChild(image);
    return;
  }

  ids.forEach(function (id) {
    const item = History.clothes.find(function (clothing) {
      return clothing.id === id;
    });

    if (item) container.appendChild(App.photo(item));
  });
};

// Update the selected outfit preview.
History.preview = function () {
  const preview = App.get("logOutfitPreview");
  preview.replaceChildren();

  if (!History.selectedIds.length) {
    preview.textContent = "Select an outfit above.";
    App.get("logSavedButton").disabled = true;
    return;
  }

  const outfit = History.findSaved(
    History.outfits,
    History.selectedIds
  );

  History.addPhotos(preview, outfit, History.selectedIds);

  App.get("logSavedButton").disabled = History.busy;
};

// Render selectable saved outfits using the current filters.
History.renderPicker = function () {
  const grid = App.get("logOutfitGrid");
  grid.replaceChildren();

  const search = App.get("logSearch").value.trim().toLowerCase();
  const color = App.get("logColorFilter").value;
  const type = App.get("logTypeFilter").value;
  const style = App.get("logStyleFilter").value;
  const favoritesOnly = App.get("logFavoritesOnly").checked;

  // Group old duplicate saved records by their clothing combination.
  const combinations = new Map();

  History.outfits.forEach(function (outfit) {
    const key = App.signature(outfit.clothingIds);
    const previous = combinations.get(key);

    if (!previous || outfit.favorite) {
      combinations.set(key, outfit);
    }
  });

  // A suggestion can be selected even before it has been saved.
  if (
    History.extraIds.length &&
    !combinations.has(App.signature(History.extraIds))
  ) {
    combinations.set(App.signature(History.extraIds), {
      clothingIds: History.extraIds,
      favorite: false
    });
  }

  const visible = [...combinations.values()].filter(function (outfit) {
    const pieces = outfit.clothingIds.map(function (id) {
      return History.clothes.find(function (item) {
        return item.id === id;
      });
    }).filter(Boolean);

    const names = pieces.map(function (item) {
      return item.name.toLowerCase();
    }).join(" ");

    return (!search || names.includes(search)) &&
      (!color || pieces.some(function (item) {
        return item.color === color;
      })) &&
      (!type || pieces.some(function (item) {
        return item.clothingType === type;
      })) &&
      (!style || (
        pieces.length > 0 &&
        pieces.every(function (item) {
          return item.styles.includes(style);
        })
      )) &&
      (!favoritesOnly || outfit.favorite);
  });

  App.get("logResultsStatus").textContent = visible.length
    ? visible.length + " outfit(s). Tap one to select it."
    : "No matching outfits. Change filters or put one together.";

  visible.forEach(function (outfit) {
    const choice = document.createElement("button");
    choice.type = "button";
    choice.className = "log-outfit-choice";

    const selected =
      History.selectedIds.length > 0 &&
      App.signature(outfit.clothingIds) ===
      App.signature(History.selectedIds);

    choice.setAttribute("aria-pressed", String(selected));

    const pieces = outfit.clothingIds.map(function (id) {
      return History.clothes.find(function (item) {
        return item.id === id;
      });
    }).filter(Boolean);

    choice.setAttribute(
      "aria-label",
      "Select outfit: " + pieces.map(function (item) {
        return item.name;
      }).join(", ")
    );

    const photos = document.createElement("div");
    photos.className = "outfit-photos";
    History.addPhotos(photos, outfit, outfit.clothingIds);

    const caption = document.createElement("p");
    caption.textContent = selected
      ? "✓ Selected"
      : outfit.favorite ? "★ Favorite" : "Select";

    choice.append(photos, caption);

    choice.addEventListener("click", function () {
      History.selectedIds = [...outfit.clothingIds];
      App.get("logStatus").textContent = "";
      History.renderPicker();
      History.preview();
    });

    grid.appendChild(choice);
  });

  History.preview();
};

// Reload the picker without discarding its selected outfit or date.
History.loadPicker = async function () {
  const request = ++History.pickerRefresh;

  try {
    const data = await App.read(["outfits", "clothes"]);

    if (
      request !== History.pickerRefresh ||
      !App.get("logOutfitDialog").open
    ) return;

    History.outfits = data.outfits;
    History.clothes = data.clothes;

    History.renderPicker();
  } catch (error) {
    App.get("logStatus").textContent =
      "Outfits could not be loaded. Close and try again.";
  }
};

// Open logging from My Outfits, a saved card, or a suggestion.
History.openLog = function (ids = []) {
  if (History.busy || Outfits.busy || !Account.user) return;
  // Remember the main page that opened logging.
const currentTab = document.querySelector(".bottom-tabs button.active");

History.logReturnPage =
  currentTab?.dataset.page || "homePage";

  // Close the builder and any suggestion popup first.
  Outfits.closeBuilder();

  if (App.get("stylePieceDialog").open) {
    App.get("stylePieceDialog").close();
  }

  History.selectedIds = [...ids];
  History.extraIds = [...ids];

  [
    "logSearch",
    "logColorFilter",
    "logTypeFilter",
    "logStyleFilter"
  ].forEach(function (id) {
    App.get(id).value = "";
  });

  App.get("logFavoritesOnly").checked = false;
  App.get("wearDate").value = History.today();
  App.get("wearDate").max = History.today();

  App.get("logStatus").textContent = "Loading outfits...";
  App.get("logOutfitGrid").replaceChildren();
  App.get("logOutfitPreview").replaceChildren();
  App.get("logSavedButton").disabled = true;
  App.get("logOutfitPanel").hidden = false;

  const dialog = App.get("logOutfitDialog");
  if (!dialog.open) dialog.showModal();

  History.loadPicker();
};

App.get("openLogButton").addEventListener("click", function () {
  History.openLog();
});

App.get("logSearch").addEventListener("input", History.renderPicker);

[
  "logColorFilter",
  "logTypeFilter",
  "logStyleFilter",
  "logFavoritesOnly"
].forEach(function (id) {
  App.get(id).addEventListener("change", History.renderPicker);
});

App.get("closeLogButton").addEventListener("click", function () {
  if (!History.busy) App.get("logOutfitDialog").close();
});

App.get("logOutfitDialog").addEventListener("cancel", function (event) {
  if (History.busy) event.preventDefault();
});

App.get("logOutfitDialog").addEventListener("close", function () {
  History.pickerRefresh++;
  App.get("logOutfitPanel").hidden = true;
});

// Put together clothing using the date selected in the logging popup.
App.get("createAndLogButton").addEventListener("click", function () {
  if (History.busy) return;

  const date = App.get("wearDate").value;

  if (!History.validDate(date)) {
    App.get("logStatus").textContent =
      "Choose today or a valid earlier date.";
    return;
  }

  App.get("logOutfitDialog").close();
  Outfits.openBuilder(date);
});

// Save the selected outfit's wear entry.
App.get("logSavedButton").addEventListener("click", async function () {
  if (History.busy || !History.selectedIds.length) return;

  const date = App.get("wearDate").value;

  if (!History.validDate(date)) {
    App.get("logStatus").textContent =
      "Choose today or a valid earlier date.";
    return;
  }

  const ids = [...History.selectedIds];
  let saved = null;

  History.busy = true;
  App.busy(App.get("logOutfitPanel"), true);
  App.get("logSavedButton").textContent = "Logging...";

  try {
    saved = await History.commitCombination(ids, date);
    App.get("logOutfitDialog").close();
    App.changed();
  } catch (error) {
    App.get("logStatus").textContent = error.message;
  } finally {
    History.busy = false;
    App.busy(App.get("logOutfitPanel"), false);
    App.get("logSavedButton").textContent = "Log Outfit";
  }

 // Show success, return to the original tab, then offer a photo.
if (saved) {
  await History.finishLogging(saved);
}
});

// WEAR HISTORY
History.render = async function () {
  const request = ++History.refreshNumber;

  try {
    const data = await App.read(["history", "clothes"]);
    if (request !== History.refreshNumber) return;

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

      const photos = document.createElement("div");
      photos.className = "outfit-photos";

      if (entry.outfitPhoto) {
        const image = document.createElement("img");
        image.src = entry.outfitPhoto;
        image.alt = "Logged outfit photo";
        image.className = "outfit-selfie";
        photos.appendChild(image);
      } else {
        entry.clothingIds.forEach(function (id) {
          const item = data.clothes.find(function (clothing) {
            return clothing.id === id;
          });

          if (item) photos.appendChild(App.photo(item));
        });
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

          if (!latest) throw new Error("This entry was removed.");

          const key = App.signature(latest.clothingIds);

          const duplicate = fresh.history.some(function (other) {
            return other.id !== entry.id &&
              App.signature(other.clothingIds) === key &&
              other.date === date;
          });

          if (duplicate) {
            throw new Error("This outfit is already logged for that date.");
          }

          await App.write([{
            store: "history",
            value: { ...latest, date: date }
          }]);

          App.changed();
        } catch (error) {
          alert(error.message);
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

      card.append(photos, dateLabel, update, remove);
      list.appendChild(card);
    });
  } catch (error) {
    App.get("wearHistoryStatus").textContent =
      "History could not be loaded.";
  }
};

function refreshHistoryIfVisible() {
  if (!App.get("outfitsPage").hidden) History.render();
}

document.addEventListener("closet-page-changed", refreshHistoryIfVisible);

document.addEventListener("closet-data-changed", function () {
  refreshHistoryIfVisible();

  if (App.get("logOutfitDialog").open && !History.busy) {
    History.loadPicker();
  }
});
// Move the existing button above the filters.
// This moves it; it does not create a duplicate.
const loggingFilters = App.get("logOutfitPanel").querySelector(
  ".filter-grid"
);

loggingFilters.before(App.get("createAndLogButton"));
// Remember the main tab where logging started.
History.logReturnPage = "homePage";

// Create the success popup once.
const loggedOutfitDialog = document.createElement("dialog");

loggedOutfitDialog.id = "loggedOutfitDialog";

loggedOutfitDialog.setAttribute(
  "aria-labelledby",
  "loggedOutfitHeading"
);

loggedOutfitDialog.innerHTML = `
  <span class="logged-outfit-check" aria-hidden="true">✓</span>
  <h2 id="loggedOutfitHeading">Outfit Logged!</h2>
  <p>Taking you back...</p>
  <button id="finishLoggedOutfitButton" type="button">
    Continue
  </button>
`;

document.body.appendChild(loggedOutfitDialog);

App.get("finishLoggedOutfitButton").addEventListener(
  "click",
  function () {
    loggedOutfitDialog.close();
  }
);

// Used by both saved outfits and Put Together an Outfit.
History.finishLogging = async function (saved) {
  const userId = Account.user?.id;
  if (!userId) return;

  const returnPage = History.logReturnPage;

  // Close the pickers so they don't reappear after the photo prompt.
  [
    "logOutfitDialog",
    "outfitDialog",
    "suggestionsDialog",
    "stylePieceDialog"
  ].forEach(function (id) {
    const dialog = App.get(id);

    if (dialog?.open) dialog.close();
  });

  document.body.style.overflow = "";

  // Continue closes it sooner; otherwise it closes automatically.
  await new Promise(function (resolve) {
    let timer;

    loggedOutfitDialog.addEventListener(
      "close",
      function () {
        clearTimeout(timer);
        resolve();
      },
      { once: true }
    );

    loggedOutfitDialog.showModal();

    timer = setTimeout(function () {
      if (loggedOutfitDialog.open) {
        loggedOutfitDialog.close();
      }
    }, 1400);
  });

  // Don't reopen an account's screens after signing out.
  if (
    Account.user?.id !== userId ||
    document.body.classList.contains("account-setup")
  ) {
    return;
  }

  // Return to the original Home, My Outfits, or other main tab.
  const tab = document.querySelector(
    '.bottom-tabs button[data-page="' + returnPage + '"]'
  );

  if (tab) tab.click();

  // Keep the existing optional outfit photo feature.
  try {
    await OutfitPhotos.offer(saved.outfit.id, saved.entry.id);
  } catch (error) {
    alert("Outfit logged, but the photo prompt could not open.");
  }
};