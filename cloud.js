// CLOUD STORAGE
// Existing features still use App.read and App.write.
// This file changes those functions to use Supabase.

const Cloud = {
  userId: null,
  generation: 0,

  // Photo caches belong only to the currently signed-in account.
  downloads: new Map(),
  uploads: new Map(),
  photoPaths: new Map(),

  writesInProgress: 0,
  collections: ["clothes", "outfits", "history", "dismissed"]
};

// Start a fresh account context.
// We will call this from auth.js in the next step.
Cloud.activate = function (userId) {
  Cloud.generation++;
  Cloud.userId = userId;

  Cloud.downloads.clear();
  Cloud.uploads.clear();
  Cloud.photoPaths.clear();
};

// Forget the account and its cached photos.
Cloud.deactivate = function () {
  Cloud.activate(null);
};

// Capture which account started an operation.
Cloud.context = function () {
    // Stop new cloud operations while deleting this account.
if (typeof Account !== "undefined" && Account.deleting) {
  throw new Error("Account deletion is in progress.");
}
  if (
    typeof Account === "undefined" ||
    !Account.client ||
    !Account.user ||
    Account.user.id !== Cloud.userId
  ) {
    throw new Error("Sign in before accessing your closet.");
  }

  return {
    userId: Cloud.userId,
    generation: Cloud.generation,
    client: Account.client
  };
};

// Stop an operation if the account changed while it was running.
Cloud.checkContext = function (context) {
  if (
    context.userId !== Cloud.userId ||
    context.generation !== Cloud.generation ||
    !Account.user ||
    Account.user.id !== context.userId
  ) {
    throw new Error("The account changed. Please try again.");
  }
};

// Convert an image file into text for the existing app and backups.
Cloud.blobToDataURL = function (blob) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      resolve(reader.result);
    };

    reader.onerror = function () {
      reject(reader.error || new Error("Photo reading failed."));
    };

    reader.readAsDataURL(blob);
  });
};

// Resize photos before uploading to save free storage space.
// The original file on her phone is not modified.
Cloud.resizePhoto = function (source) {
  return new Promise(function (resolve, reject) {
    const image = new Image();

    image.onload = function () {
      try {
        const scale = Math.min(
          1,
          720 / Math.max(image.naturalWidth, image.naturalHeight)
        );

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(
          1, Math.round(image.naturalWidth * scale)
        );
        canvas.height = Math.max(
          1, Math.round(image.naturalHeight * scale)
        );

        const drawing = canvas.getContext("2d");

        // JPEG has no transparency, so use a white background.
        drawing.fillStyle = "#ffffff";
        drawing.fillRect(0, 0, canvas.width, canvas.height);
        drawing.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(function (blob) {
          if (blob) resolve(blob);
          else reject(new Error("Photo conversion failed."));
        }, "image/jpeg", 0.75);
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = function () {
      reject(new Error("This photo format could not be opened."));
    };

    image.src = source;
  });
};

// Upload a photo and return its private storage path.
Cloud.uploadPhoto = async function (source, context) {
  Cloud.checkContext(context);

  // Reuse an existing file when this photo was already downloaded.
  const knownPath = Cloud.photoPaths.get(source);
  if (knownPath) return knownPath;

  // Reuse an upload if the same image appears in multiple records.
  if (Cloud.uploads.has(source)) {
    return Cloud.uploads.get(source);
  }

  const upload = (async function () {
    if (
      typeof source !== "string" ||
      !/^data:image\/[a-z0-9.+-]+;base64,/i.test(source)
    ) {
      throw new Error("Invalid photo data.");
    }

    const blob = await Cloud.resizePhoto(source);
    Cloud.checkContext(context);

    // Name photos by their content so identical files can be reused.
    const hash = await crypto.subtle.digest(
      "SHA-256",
      await blob.arrayBuffer()
    );

    const filename = [...new Uint8Array(hash)].map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("") + ".jpg";

    const path = context.userId + "/" + filename;

    const result = await context.client.storage
      .from("closet-photos")
      .upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false
      });

    // An identical file may already exist from an earlier session.
    if (
      result.error &&
      String(result.error.statusCode) !== "409"
    ) {
      throw result.error;
    }

    Cloud.checkContext(context);
    Cloud.photoPaths.set(source, path);
    return path;
  })();

  Cloud.uploads.set(source, upload);

  try {
    return await upload;
  } catch (error) {
    if (Cloud.generation === context.generation) {
      Cloud.uploads.delete(source);
    }
    throw error;
  }
};

// Download a private photo using the signed-in account.
Cloud.downloadPhoto = async function (path, context) {
  Cloud.checkContext(context);

  if (
    typeof path !== "string" ||
    !path.startsWith(context.userId + "/")
  ) {
    throw new Error("Photo does not belong to this account.");
  }

  if (!Cloud.downloads.has(path)) {
    const download = (async function () {
      const result = await context.client.storage
        .from("closet-photos")
        .download(path);

      if (result.error) throw result.error;

      const source = await Cloud.blobToDataURL(result.data);
      Cloud.checkContext(context);

      Cloud.photoPaths.set(source, path);
      return source;
    })();

    Cloud.downloads.set(path, download);
  }

  try {
    return await Cloud.downloads.get(path);
  } catch (error) {
    if (Cloud.generation === context.generation) {
      Cloud.downloads.delete(path);
    }
    throw error;
  }
};

// Turn a cloud record into the form the existing app expects.
Cloud.decodeRecord = async function (record, context) {
  const item = { ...record };
  const photoFields = item._cloudPhotos || {};

  for (const field of ["photo", "outfitPhoto"]) {
    if (photoFields[field]) {
      item[field] = await Cloud.downloadPhoto(
        photoFields[field],
        context
      );
    }
  }

  // Keep storage details out of the normal app records and backups.
  delete item._cloudPhotos;

  Cloud.checkContext(context);
  return item;
};

// Move image text into private photo storage before saving a record.
Cloud.encodeRecord = async function (record, context) {
  const item = { ...record };
  delete item._cloudPhotos;

  const photoFields = {};

  for (const field of ["photo", "outfitPhoto"]) {
    if (item[field]) {
      photoFields[field] = await Cloud.uploadPhoto(
        item[field],
        context
      );

      // The database stores a path instead of the full photo text.
      delete item[field];
    }
  }

  if (Object.keys(photoFields).length) {
    item._cloudPhotos = photoFields;
  }

  Cloud.checkContext(context);
  return item;
};

// Replace local reads with account-specific cloud reads.
App.read = async function (names) {
  const context = Cloud.context();

  if (!names.every(function (name) {
    return Cloud.collections.includes(name);
  })) {
    throw new Error("Unknown collection.");
  }

  const response = await context.client.rpc("read_closet_records", {
    p_collections: names
  });

  if (response.error) throw response.error;
  Cloud.checkContext(context);

  const result = {};

  // Read photos sequentially to avoid launching hundreds of downloads.
  for (const name of names) {
    result[name] = [];

    for (const record of response.data[name] || []) {
      result[name].push(
        await Cloud.decodeRecord(record, context)
      );
    }
  }

  Cloud.checkContext(context);
  return result;
};

// Replace local writes with account-specific cloud writes.
App.write = async function (changes) {
  if (!changes.length) return;
  // Avoid saving a photo while cleanup is checking its references.
if (Cloud.cleaningPhotos) {
  throw new Error("Photo cleanup is running. Please try saving again shortly.");
}

  const context = Cloud.context();
  Cloud.writesInProgress++;

  try {
    const prepared = [];

    for (const change of changes) {
      if (!Cloud.collections.includes(change.store)) {
        throw new Error("Unknown collection.");
      }

      if (change.deleteId !== undefined) {
        prepared.push({
          store: change.store,
          deleteId: change.deleteId
        });
      } else {
        prepared.push({
          store: change.store,
          value: await Cloud.encodeRecord(change.value, context)
        });
      }
    }

    Cloud.checkContext(context);

    // The SQL function saves all related records together.
    const response = await context.client.rpc("write_closet_records", {
      p_changes: prepared
    });

    if (response.error) throw response.error;
    Cloud.checkContext(context);
  } finally {
    Cloud.writesInProgress--;
  }
};
// PHOTO CLEANUP
// This runs only when the user presses the Settings button.
Cloud.cleaningPhotos = false;

Cloud.cleanupUnusedPhotos = async function () {
  // Wait until this browser has finished its current saves.
  if (Cloud.cleaningPhotos || Cloud.writesInProgress > 0) {
    throw new Error(
      "A save or cleanup is still finishing. Try again shortly."
    );
  }

  // Remember which account started cleanup.
  const context = Cloud.context();

  Cloud.cleaningPhotos = true;

  // Account deletion also checks this counter.
  Cloud.writesInProgress++;

  try {
    const bucket = context.client.storage.from("closet-photos");

    // Give newly uploaded photos 24 hours before considering removal.
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const files = [];
    let offset = 0;

    // List every photo in this account's folder.
    // Read 100 at a time so large closets are fully checked.
    while (true) {
      Cloud.checkContext(context);

      const result = await bucket.list(context.userId, {
        limit: 100,
        offset: offset,
        sortBy: {
          column: "name",
          order: "asc"
        }
      });

      if (result.error) throw result.error;

      if (!Array.isArray(result.data)) {
        throw new Error("The photo list could not be checked.");
      }

      files.push(...result.data);

      if (result.data.length < 100) break;

      offset += result.data.length;
    }

    // Read storage paths directly from the database.
    // We don't need to download the pictures to check their paths.
    const readUsedPaths = async function () {
      const result = await context.client.rpc(
        "read_closet_records",
        {
          p_collections: Cloud.collections
        }
      );

      if (result.error) throw result.error;

      Cloud.checkContext(context);

      const used = new Set();

      // Check clothing, outfits, history, and dismissed records.
      for (const collection of Cloud.collections) {
        const records = result.data?.[collection];

        // Stop if we couldn't read the complete account.
        // Missing data must never be mistaken for unused photos.
        if (!Array.isArray(records)) {
          throw new Error(
            "Your closet could not be fully checked. " +
            "No more photos were removed."
          );
        }

        for (const record of records) {
          if (!record || typeof record !== "object") {
            throw new Error(
              "A closet record could not be checked."
            );
          }

          const photos = record._cloudPhotos;

          if (
            photos !== undefined &&
            (
              !photos ||
              typeof photos !== "object" ||
              Array.isArray(photos)
            )
          ) {
            throw new Error(
              "A photo reference could not be checked."
            );
          }

          // Keep every photo referenced by this record.
          for (const path of Object.values(photos || {})) {
            if (
              typeof path !== "string" ||
              !path.startsWith(context.userId + "/")
            ) {
              throw new Error(
                "A photo reference could not be checked."
              );
            }

            used.add(path);
          }
        }
      }

      return used;
    };

    const used = await readUsedPaths();

    // Find old files that no record currently uses.
    const unused = files.filter(function (file) {
      // Only consider the JPEG filenames created by our uploader.
      // Ignore folders and any other files.
      if (
        !file.id ||
        !/^[a-f0-9]{64}\.jpg$/.test(file.name)
      ) {
        return false;
      }

      const modified = Date.parse(
        file.updated_at || file.created_at
      );

      // Keep recent photos and photos with an unknown date.
      if (
        !Number.isFinite(modified) ||
        modified >= cutoff
      ) {
        return false;
      }

      const path = context.userId + "/" + file.name;

      return !used.has(path);
    });

    let removed = 0;

    // Delete in small groups.
    for (let start = 0; start < unused.length; start += 100) {
      // Recheck the records before each group of deletions.
      const currentUsed = await readUsedPaths();

      const paths = unused
        .slice(start, start + 100)
        .map(function (file) {
          return context.userId + "/" + file.name;
        })
        .filter(function (path) {
          return !currentUsed.has(path);
        });

      if (!paths.length) continue;

      Cloud.checkContext(context);

      const result = await bucket.remove(paths);

      if (result.error) throw result.error;

      Cloud.checkContext(context);

      // Don't report success if Storage denied the deletions.
      if (
        !Array.isArray(result.data) ||
        result.data.length !== paths.length
      ) {
        throw new Error(
          "Not all unused photos were removed. " +
          "Check your Storage permissions, then try again."
        );
      }

      removed += result.data.length;

      // Forget cached paths so removed files aren't reused.
      // Photos still used by records can be downloaded again.
      Cloud.downloads.clear();
      Cloud.uploads.clear();
      Cloud.photoPaths.clear();
    }

    return removed;
  } finally {
    // Allow normal saves again, even if cleanup encountered an error.
    Cloud.cleaningPhotos = false;
    Cloud.writesInProgress--;
  }
};

// Connect the Settings button to cleanup.
App.get("cleanupPhotosButton").addEventListener(
  "click",
  async function () {
    if (!Account.user) return;

    const button = this;
    const status = App.get("cleanupPhotosStatus");

    button.disabled = true;
    status.textContent = "Checking for unused photos...";

    try {
      const removed = await Cloud.cleanupUnusedPhotos();

      status.textContent = removed > 0
        ? "Removed " + removed + " unused photo" +
          (removed === 1 ? "." : "s.")
        : "No unused photos are ready to remove. " +
          "Photos uploaded within the last 24 hours are kept.";
    } catch (error) {
      status.textContent = "Cleanup stopped: " + error.message;
    } finally {
      button.disabled = false;
    }
  }
);