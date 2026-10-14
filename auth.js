// SIGN-IN AND ACCOUNT-SPECIFIC CLOSET ACCESS
const Account = {
  client: null,
  user: null,
  busy: false,
  opening: false,
  attempt: 0
};

// Remember where the signed-in panel originally belongs.
const accountSetupPanel = App.get("signedInPanel").parentElement;

// Add a retry button in case the internet connection fails.
const retryAccountButton = document.createElement("button");
retryAccountButton.type = "button";
retryAccountButton.className = "primary";
retryAccountButton.textContent = "Retry Loading Closet";
retryAccountButton.hidden = true;

App.get("signedInPanel").appendChild(retryAccountButton);

// Replace the old setup message.
const setupMessage = App.get("signedInPanel").querySelectorAll("p")[1];

if (setupMessage) {
  setupMessage.textContent =
    "Your clothes, outfits, and history are saved under this account.";
}

// Hide the app while signing in or changing accounts.
Account.lockApp = function () {
  if (typeof Dashboard !== "undefined") Dashboard.clear();
  // Sign Out remains available if loading the account fails.
  App.get("signedInPanel").appendChild(App.get("signOutButton"));
  document.body.classList.add("account-setup");
  App.get("accountSetupPage").hidden = false;

  // Put sign-out controls on the setup screen while loading.
  accountSetupPanel.appendChild(App.get("signedInPanel"));

  // Close any open popup.
  document.querySelectorAll("dialog[open]").forEach(function (dialog) {
    dialog.close();
  });

  document.body.style.overflow = "";

  // Remove any previously displayed account information.
  [
    "closetGrid",
    "savedOutfitGrid",
    "wearHistoryList",
    "laundryGrid",
    "laundrySwipeCard",
    "outfitClothingGrid",
    "outfitPreview",
    "logOutfitPreview",
    "suggestionGrid",
    "stylePieceResults",
    "clothingInfoDetails"
  ].forEach(function (id) {
    const element = App.get(id);
    if (element) element.replaceChildren();
  });

  // Invalidate unfinished display requests.
  Clothing.refreshNumber++;
  Outfits.refreshNumber++;
  Outfits.builderRefresh++;
  History.refreshNumber++;
  History.pickerRefresh++;
  Laundry.refreshNumber++;
  Decider.requestNumber++;

  // Clear unfinished clothing and outfit selections.
  Clothing.close();
  Outfits.closeBuilder();
  Outfits.clothes = [];
  Outfits.favorite = false;
  Outfits.favoritesOnly = false;

  History.outfits = [];
  History.clothes = [];

  Laundry.clothes = [];
  Laundry.lastWorn = new Map();
  Laundry.queue = [];
  Laundry.position = 0;

  Decider.ranked = [];

  // Hide unfinished sections when the account opens.
  App.get("logOutfitPanel").hidden = true;
  App.get("outfitBuilder").hidden = true;

  App.get("loginPassword").value = "";
};

// Display the login form or the signed-in controls.
Account.showUser = function (user) {
  App.get("loginForm").hidden = Boolean(user);
  App.get("signedInPanel").hidden = !user;

  App.get("signedInEmail").textContent = user
    ? "Signed in as " + user.email
    : "";

  App.get("loginPassword").value = "";
};

// Load the signed-in account's closet before revealing the app.
Account.openCloset = async function (user) {
  const attempt = ++Account.attempt;
  Account.opening = true;

  Account.lockApp();
  Account.user = user;
  Cloud.activate(user.id);

  Account.showUser(user);
  retryAccountButton.hidden = true;
  App.get("loginStatus").textContent = "Loading your closet...";

  try {
    // Verify that the account can read its cloud records.
    // A new account returns an empty list, which is normal.
    await App.read(["clothes"]);

    if (attempt !== Account.attempt) return;

    // Fill the closet with this account's clothing.
    await Clothing.render();

    if (attempt !== Account.attempt) return;

    // Put account details and Sign Out on Home.
    // Put the account email and Sign Out inside Settings.
App.get("settingsAccountControls").appendChild(
  App.get("signedInPanel")
);
// Keep Sign Out beside Delete Account above all Settings tabs.
App.get("openDeleteAccountButton").before(App.get("signOutButton"));
Settings.renderAccount();

    // Open Home and highlight its navigation tab.
    document.querySelector(
      '.bottom-tabs button[data-page="homePage"]'
    ).click();

    App.get("loginStatus").textContent = "";
    App.get("accountSetupPage").hidden = true;

    // The cloud connection is ready, so reveal the app.
    document.body.classList.remove("account-setup");
    // Personalize Home, asking for a name if this account lacks one.
await Profile.ensureName();

// Stop if the user signed out while the name popup was open.
if (
  attempt !== Account.attempt ||
  Account.user?.id !== user.id
) return;
    // Show the first tutorial only after the account's app is visible.
// A short delay also lets the remaining script files finish loading.
setTimeout(function () {
  if (
    attempt === Account.attempt &&
    Account.user?.id === user.id &&
    typeof Tour !== "undefined" &&
    Tour.shouldStart(Account.user) &&
    !document.body.classList.contains("account-setup")
  ) {
    Tour.start();
  }
}, 0);
  } catch (error) {
    if (attempt !== Account.attempt) return;

    App.get("loginStatus").textContent =
      "Your closet could not be loaded: " + error.message;

    retryAccountButton.hidden = false;
  } finally {
    if (attempt === Account.attempt) {
      Account.opening = false;
    }
  }
};

// Connect to Supabase and restore an existing signed-in session.
Account.initialize = async function () {
  try {
    Account.lockApp();

    if (!window.supabase || typeof SUPABASE_CONFIG === "undefined") {
      throw new Error("Connection files did not load.");
    }

    if (
      !SUPABASE_CONFIG.url ||
      !SUPABASE_CONFIG.publishableKey ||
      SUPABASE_CONFIG.url.includes("PASTE_") ||
      SUPABASE_CONFIG.publishableKey.includes("PASTE_")
    ) {
      throw new Error("Fill in the project settings in config.js.");
    }

    Account.client = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.publishableKey
    );

    // React if this browser is signed out elsewhere.
    // Keep this callback synchronous.
    Account.client.auth.onAuthStateChange(function (event, session) {
      if (event === "SIGNED_OUT") {
        Account.attempt++;
        Account.user = null;
        Cloud.deactivate();

        Account.lockApp();
        Account.showUser(null);

        retryAccountButton.hidden = true;
        App.get("loginStatus").textContent = "Signed out.";
      }

      // A different browser tab may change the signed-in account.
      if (
        event === "SIGNED_IN" &&
        session &&
        Account.user &&
        session.user.id !== Account.user.id
      ) {
        Account.attempt++;
        Cloud.deactivate();
        Account.lockApp();

        // Reload to discard every old account's in-memory state.
        window.location.reload();
      }
    });

    // Validate a saved session with Supabase.
    const result = await Account.client.auth.getUser();

    if (result.data.user) {
      await Account.openCloset(result.data.user);
    } else {
      Account.user = null;
      Cloud.deactivate();
      Account.showUser(null);
      App.get("loginStatus").textContent = "";
    }
  } catch (error) {
    Account.showUser(null);

    App.get("loginStatus").textContent =
      "Connection setup failed: " + error.message;
  }
};

// Sign in and open this account's cloud closet.
App.get("loginForm").addEventListener("submit", async function (event) {
  event.preventDefault();

  if (Account.busy || Account.opening) return;

  if (!Account.client) {
    App.get("loginStatus").textContent =
      "Connection not ready. Check config.js and refresh.";
    return;
  }

  Account.busy = true;
  App.busy(App.get("loginForm"), true);
  App.get("loginStatus").textContent = "Signing in...";

  try {
    const result = await Account.client.auth.signInWithPassword({
      email: App.get("loginEmail").value.trim(),
      password: App.get("loginPassword").value
    });

    if (result.error) throw result.error;

    await Account.openCloset(result.data.user);
  } catch (error) {
    App.get("loginStatus").textContent = error.message;
  } finally {
    Account.busy = false;
    App.busy(App.get("loginForm"), false);
    App.get("loginPassword").value = "";
    // Always return to a hidden password when opening sign-in.
App.get("showLoginPassword").checked = false;
App.get("loginPassword").type = "password";
App.get("accountName").value = "";
// Keep the personalized greeting after a successful sign-in.
Profile.renderGreeting();
  }
});

// Retry loading after a temporary connection problem.
retryAccountButton.addEventListener("click", async function () {
  if (!Account.user || Account.opening) return;
  await Account.openCloset(Account.user);
});

// Sign out and discard this account's displayed information.
App.get("signOutButton").addEventListener("click", async function () {
  if (Account.busy || !Account.client) return;

  // Let an active upload or save finish before signing out.
  if (Cloud.writesInProgress > 0) {
    alert("A save is still finishing. Please try signing out again shortly.");
    return;
  }

  Account.busy = true;
  this.disabled = true;

  try {
    const result = await Account.client.auth.signOut({
      scope: "local"
    });

    if (result.error) throw result.error;

    // Reload clears remaining photo caches and unfinished feature state.
    window.location.reload();
  } catch (error) {
    alert("Sign-out failed: " + error.message);
    Account.busy = false;
    this.disabled = false;
  }
});

// Refresh cloud data when returning to the app on this device.
// Saves from another device become visible on return or refresh.
document.addEventListener("visibilitychange", function () {
  if (
    document.visibilityState === "visible" &&
    Account.user &&
    !Account.opening &&
    !document.body.classList.contains("account-setup")
  ) {
    App.changed();
  }
});

Account.initialize();
// Create a new account and open its own empty cloud closet.
App.get("createAccountButton").addEventListener(
  "click", async function () {
    if (Account.busy || Account.opening) return;

    if (!Account.client) {
      App.get("loginStatus").textContent =
        "Connection not ready. Please refresh.";
      return;
    }

    // Use the existing email and password fields.
    const form = App.get("loginForm");

    // Check that the email is valid and both fields are filled.
    if (!form.reportValidity()) return;

    const email = App.get("loginEmail").value.trim();
    const password = App.get("loginPassword").value;
    // Names are required for new accounts, but not ordinary sign-in.
const displayName = App.get("accountName").value.trim();

if (!displayName) {
  App.get("loginStatus").textContent =
    "Enter your name to create an account.";
  App.get("accountName").focus();
  return;
}

    if (password.length < 8) {
      App.get("loginStatus").textContent =
        "Choose a password with at least 8 characters.";
      return;
    }

    Account.busy = true;
    App.busy(form, true);
    App.get("loginStatus").textContent = "Creating your account...";

    try {
    // New accounts get the tutorial after their closet opens.
const result = await Account.client.auth.signUp({
  email: email,
  password: password,
  options: {
    data: {
      tutorial_pending: true,
display_name: displayName
    }
  }
});
      if (result.error) throw result.error;

      if (result.data.session && result.data.user) {
        // This account receives its own closet.
        // Existing local data is not automatically imported.
        await Account.openCloset(result.data.user);
      } else {
        // Handles confirmation being enabled later.
        App.get("loginStatus").textContent =
          "No signed-in session was returned. If email confirmation " +
          "is enabled, check your email. Otherwise try Sign In " +
          "or check the signup settings.";
      }
    } catch (error) {
      App.get("loginStatus").textContent = error.message;
    } finally {
      Account.busy = false;
      App.busy(form, false);
      App.get("loginPassword").value = "";
    }
  }
);