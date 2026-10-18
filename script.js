// SHARED CODE, CLOTHING, AND BACKUPS
const App = {};

// Find a page element using its ID.
App.get = function (id) {
  return document.getElementById(id);
};

App.styles = ["Fancy", "Athletic", "Casual", "Laid Back"];

App.types = {
  Top: [
    "Sweatshirt / Sweater",
    "T-shirt",
    "Long Sleeve",
    "Tank top",
    "Crop top",
    "Vest"
  ],
  Bottom: [
    "Jeans",
    "Leggings",
    "Shorts",
    "Skirt",
    "Sweatpants"
  ]
};

App.colors = ["White", "Black", "Cream", "Multicolor"];

[
  "Blue", "Green", "Red", "Pink", "Purple",
  "Yellow", "Orange", "Brown", "Gray"
].forEach(function (color) {
  App.colors.push("Light " + color, color, "Dark " + color);
});

// Fill a dropdown with color choices.
App.fillColors = function (select) {
  App.colors.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  });
};

// Create an image for a clothing item.
App.photo = function (item) {
  const image = document.createElement("img");
  image.src = item.photo;
  image.alt = item.name;
  image.title = item.name;
  image.className = "clothing-photo";
  return image;
};

// Tell other files that the saved information changed.
App.changed = function () {
  document.dispatchEvent(new Event("closet-data-changed"));
};

// Disable controls during a save.
App.busy = function (section, busy) {
  section.querySelectorAll("button, input, select").forEach(
    function (control) {
      control.disabled = busy;
    }
  );
};

// Identify an outfit by its pieces, ignoring their order.
App.signature = function (ids) {
  return JSON.stringify([...ids].sort());
};

// Add every piece's warmth rating together.
App.totalWarmth = function (pieces) {
  return pieces.reduce(function (total, item) {
    return total + Number(item.warmth);
  }, 0);
};

// Open the existing database.
// Version 4 adds dismissed suggestions without deleting other data.
App.database = new Promise(function (resolve, reject) {
  const request = indexedDB.open("BreesCloset", 4);

  request.onupgradeneeded = function () {
    ["clothes", "outfits", "history", "dismissed"].forEach(
      function (name) {
        if (!request.result.objectStoreNames.contains(name)) {
          request.result.createObjectStore(name, { keyPath: "id" });
        }
      }
    );
  };

  request.onsuccess = function () {
    const database = request.result;

    database.onversionchange = function () {
      database.close();
    };

    resolve(database);
  };

  request.onerror = function () {
    reject(request.error);
  };

  request.onblocked = function () {
    alert("Close other tabs showing this app, then refresh.");
  };
});

// Read one or more collections together.
App.read = async function (names) {
  const database = await App.database;

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(names, "readonly");
    const result = {};

    names.forEach(function (name) {
      const request = transaction.objectStore(name).getAll();

      request.onsuccess = function () {
        result[name] = request.result;
      };
    });

    transaction.oncomplete = function () {
      resolve(result);
    };

    transaction.onabort = function () {
      reject(transaction.error || new Error("Reading failed."));
    };
  });
};

// Save or delete records in one transaction.
App.write = async function (changes) {
  if (!changes.length) return;

  const database = await App.database;

  const names = [...new Set(changes.map(function (change) {
    return change.store;
  }))];

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(names, "readwrite");

    changes.forEach(function (change) {
      const collection = transaction.objectStore(change.store);

      if (change.deleteId !== undefined) {
        collection.delete(change.deleteId);
      } else {
        collection.put(change.value);
      }
    });

    transaction.oncomplete = function () {
      resolve();
    };

    transaction.onabort = function () {
      reject(transaction.error || new Error("Saving failed."));
    };
  });
};

// PAGE NAVIGATION
const pageIds = [
  "homePage", "closetPage", "outfitsPage",
  "deciderPage", "laundryPage"
];

document.querySelectorAll(".bottom-tabs button").forEach(
  function (button) {
    button.addEventListener("click", function () {
      pageIds.forEach(function (id) {
        App.get(id).hidden = id !== button.dataset.page;
      });

      document.querySelectorAll(".bottom-tabs button").forEach(
        function (tab) {
          const selected = tab === button;
          tab.classList.toggle("active", selected);

          if (selected) {
            tab.setAttribute("aria-current", "page");
          } else {
            tab.removeAttribute("aria-current");
          }
        }
      );

      document.dispatchEvent(new Event("closet-page-changed"));
      window.scrollTo(0, 0);
    });
  }
);

// CLOTHING FORM
const Clothing = {
  photo: "",
  editingId: null,
  busy: false,
  photoRequest: 0,
  refreshNumber: 0
};

App.fillColors(App.get("color"));

// Fill the clothing type dropdown for the chosen category.
Clothing.fillTypes = function (selected = "") {
  const select = App.get("clothingType");
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a clothing type";
  select.appendChild(placeholder);

  App.types[App.get("category").value].forEach(function (type) {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    select.appendChild(option);
  });

  if (App.types[App.get("category").value].includes(selected)) {
    select.value = selected;
  }
};

// Clear the form and return to adding new clothing.
Clothing.close = function () {
  Clothing.photoRequest++;
  Clothing.photo = "";
  Clothing.editingId = null;

  App.get("clothingForm").reset();
  if (typeof ColorPicker !== "undefined") ColorPicker.reset();
  App.get("clothingForm").hidden = true;
  App.get("preview").removeAttribute("src");
  App.get("layerQuestion").hidden = false;
  App.get("saveClothingButton").textContent = "Save to Closet";

  Clothing.fillTypes();
};

App.get("category").addEventListener("change", function () {
  const bottom = this.value === "Bottom";
  App.get("layerQuestion").hidden = bottom;

  if (bottom) App.get("canLayer").checked = false;

  Clothing.fillTypes();
});

// Read a new photo locally.
App.get("photoInput").addEventListener("change", function () {
  const file = this.files[0];
  this.value = "";

  if (!file || Clothing.busy) return;

  Clothing.close();

  const current = Clothing.photoRequest;
  const reader = new FileReader();

  reader.onload = function () {
    if (current !== Clothing.photoRequest) return;

    Clothing.photo = reader.result;
    App.get("preview").src = Clothing.photo;
    App.get("clothingForm").hidden = false;
  };

  reader.onerror = function () {
    if (current === Clothing.photoRequest) {
      alert("That photo could not be opened.");
    }
  };

  reader.readAsDataURL(file);
});

// Open an existing clothing item in the same form.
Clothing.edit = function (item) {
  if (Clothing.busy) return;

  Clothing.close();
  Clothing.editingId = item.id;
  Clothing.photo = item.photo;

  App.get("preview").src = item.photo;
  App.get("itemName").value = item.name;
  App.get("category").value = item.category;
  App.get("color").value = item.color;
  ColorPicker.setItem(item);
  App.get("warmth").value = String(item.warmth);
  App.get("canLayer").checked = item.canLayer;
  App.get("layerQuestion").hidden = item.category !== "Top";

  Clothing.fillTypes(item.clothingType || "");

  document.querySelectorAll('input[name="style"]').forEach(
    function (checkbox) {
      checkbox.checked = item.styles.includes(checkbox.value);
    }
  );

  App.get("saveClothingButton").textContent = "Save Changes";
  App.get("clothingForm").hidden = false;
  App.get("clothingForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
};

App.get("cancelClothingButton").addEventListener(
  "click", Clothing.close
);

// Save a new item or update the existing item.
App.get("clothingForm").addEventListener("submit", async function (event) {
  event.preventDefault();
  if (Clothing.busy || !Clothing.photo) return;

  const name = App.get("itemName").value.trim();

  const styles = [...document.querySelectorAll(
    'input[name="style"]:checked'
  )].map(function (checkbox) {
    return checkbox.value;
  });

  if (!name || !styles.length) {
    alert("Enter a name and choose at least one style.");
    return;
  }

  // Make sure a typed custom shade is valid before saving.
  if (!ColorPicker.validate()) return;

  const item = {
    id: Clothing.editingId || crypto.randomUUID(),
    name: name,
    photo: Clothing.photo,
    category: App.get("category").value,
    clothingType: App.get("clothingType").value,
    color: App.get("color").value,
    // The color name keeps old filters working; this stores the precise shade.
    colorHex: ColorPicker.exact || "",
    warmth: Number(App.get("warmth").value),
    styles: styles,
    canLayer: App.get("category").value === "Top" &&
      App.get("canLayer").checked,
    inLaundry: false
  };

  Clothing.busy = true;
  // Make it clear that the photo and clothing details are saving.
App.get("saveClothingButton").textContent = "Saving...";
  App.busy(App.get("clothingForm"), true);
  App.get("photoInput").disabled = true;

  try {
    let savedItem = item;

    if (Clothing.editingId) {
      const data = await App.read(["clothes"]);

      const existing = data.clothes.find(function (record) {
        return record.id === Clothing.editingId;
      });

      if (!existing) throw new Error("Item was deleted");

      // Preserve its current laundry status while editing.
      savedItem = {
        ...existing,
        ...item,
        inLaundry: existing.inLaundry
      };
    }

    await App.write([{ store: "clothes", value: savedItem }]);
    Clothing.close();
    App.changed();
  } catch (error) {
    alert("Clothing could not be saved. Please try again.");
  } finally {
    Clothing.busy = false;
    // Restore the correct label after success or failure.
App.get("saveClothingButton").textContent =
  Clothing.editingId ? "Save Changes" : "Save to Closet";
    App.busy(App.get("clothingForm"), false);
    App.get("photoInput").disabled = false;
  }
});

// Display the clothing cards.
Clothing.render = async function () {
  const current = ++Clothing.refreshNumber;

  try {
    const data = await App.read(["clothes"]);
    if (current !== Clothing.refreshNumber) return;

    const grid = App.get("closetGrid");
    grid.replaceChildren();

    const missingTypes = data.clothes.filter(function (item) {
      return !item.clothingType;
    }).length;

    App.get("closetStatus").textContent = !data.clothes.length
      ? "Your closet is empty. Add your first item."
      : missingTypes
        ? missingTypes + " item(s) need a clothing type. Use Edit."
        : "";

    data.clothes.forEach(function (item) {
      const card = document.createElement("div");
      card.className = "clothing-card";
      // Show full details only when she asks for them.
const info = document.createElement("button");
info.type = "button";
info.className = "clothing-info-button";
// Use a plain i inside our pink circle.
info.textContent = "i";
info.setAttribute("aria-label", "Details for " + item.name);

info.addEventListener("click", function () {
  // Read the latest information in case the item was edited.
  Clothing.showInformation(item.id);
});

card.appendChild(info);

      const title = document.createElement("h3");
      title.textContent = item.name;

      const details = document.createElement("p");
      // Keep the card brief: styles and availability only.
details.textContent =
  item.styles.join(" • ") +
  (item.inLaundry ? " • In laundry" : " • Available");

// Find the three strongest outfits using this exact piece.
const stylePiece = document.createElement("button");
stylePiece.type = "button";
stylePiece.className = "card-button style-piece-button";
stylePiece.textContent = "✦ Style This Piece";

stylePiece.addEventListener("click", function () {
    // Start each newly opened clothing popup on New Outfits.
Decider.pieceMode = "new";
  Decider.stylePiece(item.id);
});

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "card-button";
      edit.textContent = "Edit";
      edit.addEventListener("click", function () {
        Clothing.edit(item);
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "card-button";
      remove.textContent = "Delete";

      remove.addEventListener("click", async function () {
        if (!confirm('Delete "' + item.name + '" from your closet?')) return;

        edit.disabled = true;
        remove.disabled = true;

        try {
          await App.write([{ store: "clothes", deleteId: item.id }]);
          App.changed();
        } catch (error) {
          alert("The item could not be deleted.");
        } finally {
          edit.disabled = false;
          remove.disabled = false;
        }
      });

      card.append(
  App.photo(item), title, details, stylePiece, edit, remove
);
      grid.appendChild(card);
    });
  } catch (error) {
    App.get("closetStatus").textContent = "Your closet could not be loaded.";
  }
};

Clothing.fillTypes();


document.addEventListener("closet-data-changed", Clothing.render);

// BACKUP VALIDATION
function validIds(ids) {
  return Array.isArray(ids) && ids.length >= 2 &&
    ids.every(function (id) {
      return typeof id === "string" && id.length > 0;
    }) &&
    new Set(ids).size === ids.length;
}

function validClothing(item) {
  return item &&
    typeof item.id === "string" && item.id.length > 0 &&
    typeof item.name === "string" && item.name.trim().length > 0 &&
    typeof item.photo === "string" &&
    /^data:image\/[a-z0-9.+-]+;base64,/i.test(item.photo) &&
    ["Top", "Bottom"].includes(item.category) &&
    (item.clothingType === undefined ||
      App.types[item.category].includes(item.clothingType)) &&
    App.colors.includes(item.color) &&
    (item.colorHex === undefined || item.colorHex === "" ||
      Styling.isHex(item.colorHex)) &&
    [1, 2, 3].includes(item.warmth) &&
    Array.isArray(item.styles) && item.styles.length > 0 &&
    item.styles.every(function (style) {
      return App.styles.includes(style);
    }) &&
    typeof item.canLayer === "boolean" &&
    typeof item.inLaundry === "boolean";
}

function validOutfit(item) {
  return item &&
    typeof item.id === "string" && item.id.length > 0 &&
    typeof item.name === "string" &&
    typeof item.favorite === "boolean" &&
    validOptionalPhoto(item.photo) &&
    typeof item.createdAt === "string" &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    validIds(item.clothingIds);
}

function validHistory(item) {
  return item &&
    typeof item.id === "string" && item.id.length > 0 &&
    typeof item.outfitId === "string" && item.outfitId.length > 0 &&
    typeof item.outfitName === "string" &&
    validOptionalPhoto(item.outfitPhoto) &&
    validIds(item.clothingIds) &&
    History.validDate(item.date);
}

function validDismissal(item) {
  try {
    return item &&
      typeof item.id === "string" &&
      validIds(JSON.parse(item.id));
  } catch (error) {
    return false;
  }
}

function validCollection(items, checker) {
  return Array.isArray(items) &&
    items.every(checker) &&
    new Set(items.map(function (item) {
      return item.id;
    })).size === items.length;
}

// Download everything in a backup file.
App.get("backupButton").addEventListener("click", async function () {
  this.disabled = true;
  App.get("backupStatus").textContent = "Preparing backup...";

  try {
    const data = await App.read([
      "clothes", "outfits", "history", "dismissed"
    ]);

    const backup = {
      app: "BreesCloset",
      version: 4,
      createdAt: new Date().toISOString(),
      ...data
    };

    const file = new Blob(
      [JSON.stringify(backup)],
      { type: "application/json" }
    );

    const address = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = address;
    link.download = "Brees-Closet-Backup-" + History.today() + ".json";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(function () {
      URL.revokeObjectURL(address);
    }, 60000);

    App.get("backupStatus").textContent =
      "Backup download requested. Keep the file somewhere safe.";
  } catch (error) {
    App.get("backupStatus").textContent = "Backup could not be created.";
  } finally {
    this.disabled = false;
  }
});

// Restore old or new backup versions.
App.get("restoreInput").addEventListener("change", async function () {
  const file = this.files[0];
  this.value = "";
  if (!file) return;

  this.disabled = true;
  App.get("backupButton").disabled = true;

  try {
    const backup = JSON.parse(await file.text());

    if (
      !backup || backup.app !== "BreesCloset" ||
      ![1, 2, 3, 4].includes(backup.version)
    ) {
      throw new Error("Wrong backup");
    }

    const outfits = backup.version >= 2 ? backup.outfits : [];
    const history = backup.version >= 3 ? backup.history : [];
    const dismissed = backup.version >= 4 ? backup.dismissed : [];

    if (
      !validCollection(backup.clothes, validClothing) ||
      !validCollection(outfits, validOutfit) ||
      !validCollection(history, validHistory) ||
      !validCollection(dismissed, validDismissal)
    ) {
      throw new Error("Invalid records");
    }

    if (!confirm(
      "Restore this backup? Matching IDs will use backup details. " +
      "Other items already saved will stay."
    )) {
      App.get("backupStatus").textContent = "Restore canceled.";
      return;
    }

    const changes = [];

    [
      ["clothes", backup.clothes],
      ["outfits", outfits],
      ["history", history],
      ["dismissed", dismissed]
    ].forEach(function (group) {
      group[1].forEach(function (item) {
        changes.push({ store: group[0], value: item });
      });
    });

    await App.write(changes);
    App.changed();
    App.get("backupStatus").textContent = "Backup restored!";
  } catch (error) {
    App.get("backupStatus").textContent =
      "Restore failed. Select a valid Bree's Closet backup.";
  } finally {
    this.disabled = false;
    App.get("backupButton").disabled = false;
  }
});
// Older records may have no photo.
// New records may have an empty photo or a saved image.
function validOptionalPhoto(photo) {
  return photo === undefined ||
    photo === "" ||
    (
      typeof photo === "string" &&
      /^data:image\/[a-z0-9.+-]+;base64,/i.test(photo)
    );
}
// Load and display the selected item's full details.
Clothing.showInformation = async function (itemId) {
  try {
    const data = await App.read(["clothes"]);

    const item = data.clothes.find(function (clothing) {
      return clothing.id === itemId;
    });

    if (!item) {
      alert("This item is no longer in your closet.");
      return;
    }

    App.get("clothingInfoTitle").textContent = item.name;

    const details = App.get("clothingInfoDetails");
    details.replaceChildren();

    // Create one readable line for each detail.
    const lines = [
      "Category: " + item.category,
      "Type: " + (item.clothingType || "Not set"),
      "Color: " + item.color + (item.colorHex ? " (" + item.colorHex + ")" : ""),
      "Warmth: " + item.warmth + " out of 3",
      "Styles: " + item.styles.join(", "),
      "Status: " + (item.inLaundry ? "In laundry" : "Available")
    ];

    if (item.category === "Top") {
      lines.push(
        "Can go over another top: " + (item.canLayer ? "Yes" : "No")
      );
    }

    lines.forEach(function (line) {
      const paragraph = document.createElement("p");
      paragraph.textContent = line;
      details.appendChild(paragraph);
    });

    const dialog = App.get("clothingInfoDialog");
    if (!dialog.open) dialog.showModal();
  } catch (error) {
    alert("Clothing details could not be loaded.");
  }
};

// Close the information popup.
App.get("closeClothingInfo").addEventListener("click", function () {
  App.get("clothingInfoDialog").close();
});