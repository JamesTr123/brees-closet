// PHOTO PROMPT AFTER SAVING OR LOGGING
const OutfitPhotos = {
  outfitId: null,
  historyId: null,
  busy: false,
  finish: null
};

// Open the prompt.
// A history ID means this photo also belongs to a logged wear entry.
OutfitPhotos.offer = function (outfitId, historyId = null) {
  const dialog = App.get("afterOutfitPhotoDialog");

  // Avoid opening a second prompt over an existing one.
  if (dialog.open) return Promise.resolve();

  OutfitPhotos.outfitId = outfitId;
  OutfitPhotos.historyId = historyId;

  App.get("afterPhotoStatus").textContent = "";
  App.get("takeOutfitPhoto").value = "";
  App.get("uploadOutfitPhoto").value = "";

  dialog.showModal();
  document.body.style.overflow = "hidden";

  // Let the calling function wait until this popup closes.
  return new Promise(function (resolve) {
    OutfitPhotos.finish = resolve;
  });
};

// Read the chosen photo from the device.
OutfitPhotos.readPhoto = function (file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      resolve(reader.result);
    };

    reader.onerror = function () {
      reject(reader.error);
    };

    reader.readAsDataURL(file);
  });
};

// Save the newest photo to the outfit and, when logging,
// to the specific wear-history entry.
OutfitPhotos.save = async function (file) {
  if (!file || OutfitPhotos.busy) return;

  const dialog = App.get("afterOutfitPhotoDialog");
  OutfitPhotos.busy = true;
  App.busy(dialog, true);
  App.get("afterPhotoStatus").textContent = "Saving your photo...";

  try {
    const photo = await OutfitPhotos.readPhoto(file);
    const data = await App.read(["outfits", "history"]);
    const changes = [];

    const outfit = data.outfits.find(function (item) {
      return item.id === OutfitPhotos.outfitId;
    });

    if (outfit) {
      changes.push({
        store: "outfits",
        value: { ...outfit, photo: photo }
      });
    }

    if (OutfitPhotos.historyId) {
      const entry = data.history.find(function (item) {
        return item.id === OutfitPhotos.historyId;
      });

      if (entry) {
        changes.push({
          store: "history",
          value: { ...entry, outfitPhoto: photo }
        });
      }
    }

    if (!changes.length) {
      throw new Error("The outfit or history entry was removed.");
    }

    // Update both records together when both exist.
    await App.write(changes);
    App.changed();
    dialog.close();
  } catch (error) {
    App.get("afterPhotoStatus").textContent =
      "The photo could not be saved. Try another photo or choose Not Now.";
  } finally {
    OutfitPhotos.busy = false;
    App.busy(dialog, false);
  }
};

// Both camera and upload choices use the same save function.
["takeOutfitPhoto", "uploadOutfitPhoto"].forEach(function (id) {
  App.get(id).addEventListener("change", function () {
    const file = this.files[0];
    this.value = "";
    OutfitPhotos.save(file);
  });
});

// Skipping leaves the outfit's existing photo unchanged.
App.get("skipOutfitPhoto").addEventListener("click", function () {
  if (!OutfitPhotos.busy) {
    App.get("afterOutfitPhotoDialog").close();
  }
});

// Allow Escape to skip, unless a photo is currently saving.
App.get("afterOutfitPhotoDialog").addEventListener(
  "cancel", function (event) {
    if (OutfitPhotos.busy) event.preventDefault();
  }
);

// Finish the pending prompt when it closes.
App.get("afterOutfitPhotoDialog").addEventListener("close", function () {
  document.body.style.overflow = "";

  const finish = OutfitPhotos.finish;
  OutfitPhotos.finish = null;

  if (finish) finish();
});