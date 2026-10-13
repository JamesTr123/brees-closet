// SETTINGS AND ACCOUNT DELETION
const Settings = {
  deleting: false
};

// Open Settings.
App.get("openSettingsButton").addEventListener("click", function () {
  if (!Account.user) return;

  // The old tutorial area is no longer used.
  App.get("tutorialPanel").hidden = true;

  if (!App.get("settingsDialog").open) {
    App.get("settingsDialog").showModal();
  }
});

// Close Settings.
App.get("closeSettingsButton").addEventListener("click", function () {
  App.get("settingsDialog").close();
});

// Close Settings and start the guided tour.
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