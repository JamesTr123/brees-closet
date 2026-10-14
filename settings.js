// SETTINGS TABS AND ACCOUNT DELETION
const Settings = { deleting: false, activeTab: "profile" };

// Display account text safely, without putting names into HTML strings.
Settings.renderAccount = function () {
  const user = typeof Account !== "undefined" ? Account.user : null;
  App.get("settingsProfileName").textContent =
    user?.user_metadata?.display_name?.trim() || "Your Profile";
  App.get("settingsProfileEmail").textContent = user?.email || "";
};

// Only the selected Settings section is visible.
Settings.selectTab = function (name) {
  const panels = {
    profile: "settingsProfilePanel",
    navigation: "settingsNavigationPanel",
    storage: "settingsStoragePanel"
  };
  if (!panels[name]) return;
  Settings.activeTab = name;
  for (const [key, id] of Object.entries(panels)) {
    App.get(id).hidden = key !== name;
  }
  document.querySelectorAll("[data-settings-tab]").forEach(function (button) {
    const selected = button.dataset.settingsTab === name;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  App.get("settingsDialog").scrollTop = 0;
};

const settingsTabButtons = [...document.querySelectorAll("[data-settings-tab]")];
settingsTabButtons.forEach(function (button, index) {
  button.addEventListener("click", function () {
    Settings.selectTab(this.dataset.settingsTab);
  });
  // Arrow keys make these tabs usable without a mouse.
  button.addEventListener("keydown", function (event) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % settingsTabButtons.length;
    else if (event.key === "ArrowLeft") next = (index + settingsTabButtons.length - 1) % settingsTabButtons.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = settingsTabButtons.length - 1;
    else return;
    event.preventDefault();
    Settings.selectTab(settingsTabButtons[next].dataset.settingsTab);
    settingsTabButtons[next].focus();
  });
});

App.get("openSettingsButton").addEventListener("click", function () {
  if (!Account.user) return;
  Settings.renderAccount();
  Settings.selectTab("profile");
  if (!App.get("settingsDialog").open) App.get("settingsDialog").showModal();
  Dashboard.refresh();
});

App.get("closeSettingsButton").addEventListener("click", function () {
  App.get("settingsDialog").close();
});

App.get("openTutorialButton").addEventListener("click", function () {
  App.get("settingsDialog").close();
  Tour.start();
});

// Open the deletion confirmation.
App.get("openDeleteAccountButton").addEventListener("click", function () {
  App.get("deleteAccountForm").reset();
  App.get("deleteAccountStatus").textContent = "";
  App.get("deleteAccountDialog").showModal();
});

App.get("cancelDeleteAccountButton").addEventListener("click", function () {
  if (!Settings.deleting) App.get("deleteAccountDialog").close();
});

// Prevent dismissing the dialog during deletion.
App.get("deleteAccountDialog").addEventListener(
  "cancel", function (event) {
    if (Settings.deleting) event.preventDefault();
  }
);

// Request deletion through our SERVER function.
// No administrator key belongs in this browser file.
App.get("deleteAccountForm").addEventListener(
  "submit", async function (event) {
    event.preventDefault();

    if (Settings.deleting || !Account.user) return;

    if (App.get("deleteAccountConfirmation").value.trim() !== "DELETE") {
      App.get("deleteAccountStatus").textContent =
        "Type DELETE exactly to confirm.";
      return;
    }

    if (Cloud.writesInProgress > 0) {
      App.get("deleteAccountStatus").textContent =
        "A save is still finishing. Please try again shortly.";
      return;
    }

    Settings.deleting = true;
    Account.deleting = true;
    Account.busy = true;

    const form = App.get("deleteAccountForm");
    App.busy(form, true);

    App.get("deleteAccountStatus").textContent =
      "Deleting your account. Please keep this window open...";

    try {
      const sessionResult = await Account.client.auth.getSession();

      if (sessionResult.error) throw sessionResult.error;

      const token = sessionResult.data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const response = await fetch(
        SUPABASE_CONFIG.url.replace(/\/$/, "") +
          "/functions/v1/bright-action",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
            "apikey": SUPABASE_CONFIG.publishableKey
          },
          body: JSON.stringify({
            password: App.get("deleteAccountPassword").value,
            confirmation: "DELETE"
          })
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Deletion failed.");
      }

      // Clear this browser's signed-in session.
      await Account.client.auth.signOut({ scope: "local" });

      // Discard cached account information.
      Cloud.deactivate();
      window.location.reload();
    } catch (error) {
      App.get("deleteAccountStatus").textContent =
        error.message;
    } finally {
      Settings.deleting = false;
      Account.deleting = false;
      Account.busy = false;

      App.busy(form, false);
      App.get("deleteAccountPassword").value = "";
    }
  }
);