// SETTINGS, TUTORIAL, AND ACCOUNT DELETION
const Settings = {
  tutorialPosition: 0,
  deleting: false
};

// Simple tutorial pages.
Settings.tutorial = [
  {
    title: "Build Your Closet",
    text: "Open My Closet and tap Add Clothing. Choose or take a photo, " +
      "then fill in the item's type, color, warmth, and styles. " +
      "Use Edit to change an item and i to see its details."
  },
  {
    title: "Save Your Outfits",
    text: "Open My Outfits and tap Add Outfit. Choose one bottom and " +
      "your tops, optionally name it, and tap the star for a favorite. " +
      "After saving, you can add a photo of yourself in the outfit."
  },
  {
    title: "Log What You Wore",
    text: "Tap Log an Outfit in My Outfits. Choose a saved outfit or " +
      "create a new one, then select the date. Wear History remembers " +
      "when you wore it. A new outfit photo updates its main picture."
  },
  {
    title: "Find Something to Wear",
    text: "Use Outfit Decider to choose styles and a warmth range. " +
      "Use My Location to consider current weather. Suggestions exclude " +
      "laundry items and can avoid recently worn combinations."
  },
  {
    title: "Style One Piece",
    text: "Tap Style This Piece on a clothing card. New Outfits shows " +
      "up to three new combinations. Existing Outfits shows your saved " +
      "combinations containing that item."
  },
  {
    title: "Update Your Laundry",
    text: "Open Laundry Basket and tap Update Laundry. Recently worn " +
      "clothes appear first. Swipe Mode reviews clothing worn in the " +
      "last four days: left for laundry, right for clean."
  },
  {
    title: "Accounts and Backups",
    text: "Use the same email and password on another device to access " +
      "the same cloud closet. Refresh to load updates from another device. " +
      "Back Up Closet downloads a separate copy for safekeeping."
  }
];

Settings.showTutorial = function () {
  const page = Settings.tutorial[Settings.tutorialPosition];

  App.get("tutorialHeading").textContent = page.title;
  App.get("tutorialText").textContent = page.text;
  App.get("tutorialProgress").textContent =
    (Settings.tutorialPosition + 1) + " of " + Settings.tutorial.length;

  App.get("previousTutorialButton").disabled =
    Settings.tutorialPosition === 0;

  App.get("nextTutorialButton").textContent =
    Settings.tutorialPosition === Settings.tutorial.length - 1
      ? "Done"
      : "Next";
};

App.get("openSettingsButton").addEventListener("click", function () {
  if (!Account.user) return;

  App.get("tutorialPanel").hidden = true;
  App.get("settingsDialog").showModal();
});

App.get("closeSettingsButton").addEventListener("click", function () {
  App.get("settingsDialog").close();
});

App.get("openTutorialButton").addEventListener("click", function () {
  Settings.tutorialPosition = 0;
  App.get("tutorialPanel").hidden = false;
  Settings.showTutorial();
});

App.get("previousTutorialButton").addEventListener("click", function () {
  if (Settings.tutorialPosition > 0) {
    Settings.tutorialPosition--;
    Settings.showTutorial();
  }
});

App.get("nextTutorialButton").addEventListener("click", function () {
  if (Settings.tutorialPosition === Settings.tutorial.length - 1) {
    App.get("tutorialPanel").hidden = true;
  } else {
    Settings.tutorialPosition++;
    Settings.showTutorial();
  }
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