// ACCOUNT NAMES AND PASSWORD VISIBILITY
const Profile = {
  busy: false,
  pending: null
};

// Show or hide the password without changing its value.
App.get("showLoginPassword").addEventListener("change", function () {
  App.get("loginPassword").type = this.checked ? "text" : "password";
});

// Display the current account's name safely as plain text.
Profile.renderGreeting = function () {
  const name = Account.user?.user_metadata?.display_name;
  // Personalize the main heading for the signed-in account.
App.get("closetHeading").textContent =
  typeof name === "string" && name.trim()
    ? name.trim() + "'s Closet ♡"
    : "My Closet ♡";

  App.get("welcomeHeading").textContent =
    typeof name === "string" && name.trim()
      ? "Welcome, " + name.trim() + "! ♡"
      : "Welcome back ♡";
};

// Open the name form.
// Return a promise so the tutorial can wait until it closes.
Profile.open = function () {
  if (!Account.user) return Promise.resolve();

  const dialog = App.get("profileNameDialog");
  if (dialog.open) return Promise.resolve();

  const currentName = Account.user.user_metadata?.display_name;

  App.get("profileNameInput").value =
    typeof currentName === "string" ? currentName : "";

  App.get("profileNameStatus").textContent = "";
  dialog.showModal();

  return new Promise(function (resolve) {
    Profile.pending = resolve;
  });
};

// Ask existing accounts for a name if one has not been saved.
// Not Now leaves the name blank, so it can be requested next sign-in.
Profile.ensureName = async function () {
  Profile.renderGreeting();

  const name = Account.user?.user_metadata?.display_name;

  if (!(typeof name === "string" && name.trim())) {
    await Profile.open();
  }
};

// Save the name to account metadata so it works on other devices.
App.get("profileNameForm").addEventListener(
  "submit", async function (event) {
    event.preventDefault();

    if (Profile.busy || !Account.user) return;

    const name = App.get("profileNameInput").value.trim();

    if (!name) {
      App.get("profileNameStatus").textContent = "Please enter a name.";
      return;
    }

    const userId = Account.user.id;
    Profile.busy = true;

    App.busy(App.get("profileNameForm"), true);
    App.get("saveProfileName").textContent = "Saving...";

    try {
      const result = await Account.client.auth.updateUser({
        data: { display_name: name }
      });

      if (result.error) throw result.error;

      // Do not display a result belonging to an account that signed out.
      if (Account.user?.id !== userId) return;

      Account.user = result.data.user;
      Profile.renderGreeting();
      App.get("profileNameDialog").close();
    } catch (error) {
      App.get("profileNameStatus").textContent =
        "Name could not be saved. Please try again.";
    } finally {
      Profile.busy = false;
      App.busy(App.get("profileNameForm"), false);
      App.get("saveProfileName").textContent = "Save Name";
    }
  }
);

App.get("skipProfileName").addEventListener("click", function () {
  if (!Profile.busy) App.get("profileNameDialog").close();
});

// Keep the form open while its name is saving.
App.get("profileNameDialog").addEventListener("cancel", function (event) {
  if (Profile.busy) event.preventDefault();
});

App.get("profileNameDialog").addEventListener("close", function () {
  const finish = Profile.pending;
  Profile.pending = null;

  if (finish) finish();
});

// Add Change Name to Settings without rearranging its HTML.
const changeNameButton = document.createElement("button");
changeNameButton.type = "button";
changeNameButton.className = "primary";
changeNameButton.textContent = "Change My Name";

App.get("openTutorialButton").before(changeNameButton);

changeNameButton.addEventListener("click", function () {
  Profile.open();
});