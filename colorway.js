// PRESET COLORWAYS
// Each row uses the same shared shades as style.css.
// Changing a colorway changes display colors, not clothing photos or scores.
const Colorways = {
  current: "pink",
  busy: false,
  session: null,
  keys: [
  "--theme-fff5f8",
  "--theme-49333d",
  "--theme-a94370",
  "--theme-f3c6d8",
  "--theme-c696aa",
  "--theme-ec428c",
  "--theme-c5236b",
  "--theme-fff0f6",
  "--theme-a12b60",
  "--theme-bd3773",
  "--theme-b62f69",
  "--theme-d94c8a",
  "--theme-a4285c",
  "--theme-c63d7b",
  "--theme-f8d1e1",
  "--theme-db4485",
  "--theme-f3b3cf",
  "--theme-a52b61",
  "--theme-d63b80",
  "--theme-efbad0",
  "--theme-785363",
  "--theme-d83b80",
  "--theme-edc1d2",
  "--theme-ffe3ef",
  "--theme-f9deea",
  "--theme-dc4d90",
  "--theme-ffdbeb",
  "--theme-ffe4ef",
  "--theme-ae2548",
  "--theme-rgb-73-33-53-0p55",
  "--theme-rgb-169-67-112-0p2",
  "--theme-rgb-73-33-53-0p25",
  "--theme-rgb-65-20-40-0p45",
  "--theme-rgb-130-42-79-0p07",
  "--theme-rgb-73-33-53-0p18",
  "--theme-rgb-73-33-53-0p4"
],
  presets: {
    pink: {
      name: "Original Pink",
      preview: ["#fff5f8", "#f3c6d8", "#a94370"],
      colors: ["#fff5f8", "#49333d", "#a94370", "#f3c6d8", "#c696aa", "#ec428c", "#c5236b", "#fff0f6", "#a12b60", "#bd3773", "#b62f69", "#d94c8a", "#a4285c", "#c63d7b", "#f8d1e1", "#db4485", "#f3b3cf", "#a52b61", "#d63b80", "#efbad0", "#785363", "#d83b80", "#edc1d2", "#ffe3ef", "#f9deea", "#dc4d90", "#ffdbeb", "#ffe4ef", "#ae2548", "rgba(73, 33, 53, 0.55)", "rgba(169, 67, 112, 0.2)", "rgba(73, 33, 53, 0.25)", "rgba(65, 20, 40, 0.45)", "rgba(130, 42, 79, 0.07)", "rgba(73, 33, 53, 0.18)", "rgba(73, 33, 53, 0.4)"]
    },
    blue: {
      name: "Blue",
      preview: ["#f7f9fd", "#c7d9f2", "#3160a1"],
      colors: ["#f7f9fd", "#2f3b4e", "#3160a1", "#c7d9f2", "#8ea9ce", "#3576d0", "#275da7", "#f3f7fc", "#225091", "#2a62b1", "#275ba5", "#3676d0", "#225091", "#2c69bd", "#d4e2f5", "#3676d0", "#b8ceee", "#235294", "#2f6fc8", "#bad0ef", "#405572", "#2f70ca", "#bed3f0", "#e8f0fa", "#dfe9f8", "#3676d0", "#e2ebf8", "#e9f0fa", "#235396", "rgba(40, 51, 66, 0.55)", "rgba(49, 96, 161, 0.2)", "rgba(40, 51, 66, 0.25)", "rgba(32, 41, 53, 0.45)", "rgba(64, 82, 107, 0.07)", "rgba(40, 51, 66, 0.18)", "rgba(40, 51, 66, 0.4)"]
    },
    purple: {
      name: "Purple",
      preview: ["#faf7fd", "#decaef", "#7434a9"],
      colors: ["#faf7fd", "#402f4e", "#7434a9", "#decaef", "#b18ece", "#9552cd", "#7231a8", "#f8f3fc", "#642a92", "#7933b1", "#7130a6", "#914bcb", "#642a92", "#8137bd", "#e6d6f3", "#8e46c9", "#d5bbeb", "#662b95", "#883bc6", "#d7bdec", "#604378", "#893dc7", "#d9c1ed", "#f2e9f9", "#ede1f6", "#934ecc", "#eee3f7", "#f2eaf9", "#672c98", "rgba(54, 40, 66, 0.55)", "rgba(116, 52, 169, 0.2)", "rgba(54, 40, 66, 0.25)", "rgba(44, 32, 53, 0.45)", "rgba(88, 64, 107, 0.07)", "rgba(54, 40, 66, 0.18)", "rgba(54, 40, 66, 0.4)"]
    },
    green: {
      name: "Green",
      preview: ["#f8fcfa", "#ceebda", "#358456"],
      colors: ["#f8fcfa", "#2f4e3b", "#358456", "#ceebda", "#8ecea9", "#358456", "#358556", "#f4fbf7", "#2f754c", "#358556", "#358556", "#358556", "#2f754c", "#358456", "#d9f0e3", "#358456", "#c0e6d0", "#30784e", "#358556", "#c2e7d1", "#3a684d", "#358556", "#c6e8d4", "#ebf7f0", "#e3f4ea", "#358456", "#e5f5ec", "#ecf7f1", "#317a4f", "rgba(40, 66, 51, 0.55)", "rgba(53, 132, 86, 0.2)", "rgba(40, 66, 51, 0.25)", "rgba(32, 53, 41, 0.45)", "rgba(64, 107, 82, 0.07)", "rgba(40, 66, 51, 0.18)", "rgba(40, 66, 51, 0.4)"]
    },
    orange: {
      name: "Orange",
      preview: ["#fdfaf7", "#f4d9c5", "#8e562b"],
      colors: ["#fdfaf7", "#4e3c2f", "#8e562b", "#f4d9c5", "#ceaa8e", "#b36122", "#98521d", "#fdf7f2", "#804619", "#9f5822", "#96511c", "#b26022", "#814618", "#ab5f25", "#f7e2d2", "#b36122", "#f1cfb5", "#844719", "#b26022", "#f1d1b8", "#614937", "#b16022", "#f1d4bd", "#fbf0e7", "#f9eade", "#b36122", "#f9ebe1", "#fbf0e8", "#86491a", "rgba(66, 51, 40, 0.55)", "rgba(142, 86, 43, 0.2)", "rgba(66, 51, 40, 0.25)", "rgba(53, 41, 32, 0.45)", "rgba(107, 83, 64, 0.07)", "rgba(66, 51, 40, 0.18)", "rgba(66, 51, 40, 0.4)"]
    },
    red: {
      name: "Red",
      preview: ["#fdf7f7", "#f2c9c7", "#a53632"],
      colors: ["#fdf7f7", "#4e302f", "#a53632", "#f2c9c7", "#ce908e", "#d14641", "#aa2e29", "#fcf3f3", "#942824", "#b4302c", "#a82d29", "#d14540", "#942824", "#c0332f", "#f5d5d4", "#d0403b", "#eebab8", "#972825", "#cb3631", "#eebcbb", "#754342", "#cd3732", "#efc0bf", "#fae9e8", "#f7e0e0", "#d14641", "#f8e3e2", "#faeae9", "#992925", "rgba(66, 41, 40, 0.55)", "rgba(165, 54, 50, 0.2)", "rgba(66, 41, 40, 0.25)", "rgba(53, 33, 32, 0.45)", "rgba(107, 66, 64, 0.07)", "rgba(66, 41, 40, 0.18)", "rgba(66, 41, 40, 0.4)"]
    },
    yellow: {
      name: "Yellow",
      preview: ["#fdfcf7", "#f4e9c5", "#766324"],
      colors: ["#fdfcf7", "#4e462f", "#766324", "#f4e9c5", "#cebf8e", "#8e731b", "#7e6618", "#fdfaf2", "#675314", "#866d1c", "#7c6418", "#8d721b", "#675314", "#8c721e", "#f7eed2", "#8c721b", "#f1e3b5", "#6a5614", "#8d731b", "#f1e4b8", "#4e462c", "#8d721b", "#f1e5bd", "#fbf6e7", "#f9f3de", "#8e731b", "#f9f4e1", "#fbf6e8", "#6d5815", "rgba(66, 60, 40, 0.55)", "rgba(118, 99, 36, 0.2)", "rgba(66, 60, 40, 0.25)", "rgba(53, 48, 32, 0.45)", "rgba(107, 97, 64, 0.07)", "rgba(66, 60, 40, 0.18)", "rgba(66, 60, 40, 0.4)"]
    },
    teal: {
      name: "Teal",
      preview: ["#f8fcfc", "#ccedec", "#2d827f"],
      colors: ["#f8fcfc", "#2f4e4c", "#2d827f", "#ccedec", "#8ececc", "#2c827f", "#2c817e", "#f4fbfb", "#287673", "#2d8280", "#2c817e", "#2c817e", "#287673", "#2d827f", "#d8f1f1", "#2d827f", "#bde9e7", "#297976", "#2c817e", "#c0e9e8", "#386563", "#2c817e", "#c3ebe9", "#eaf8f7", "#e2f5f4", "#2d827f", "#e4f6f5", "#ebf8f8", "#2a7b78", "rgba(40, 66, 65, 0.55)", "rgba(45, 130, 127, 0.2)", "rgba(40, 66, 65, 0.25)", "rgba(32, 53, 52, 0.45)", "rgba(64, 107, 106, 0.07)", "rgba(40, 66, 65, 0.18)", "rgba(40, 66, 65, 0.4)"]
    },
  }
};

// Ignore an unknown saved value and use the original pink.
Colorways.resolve = function (name) {
  return Object.hasOwn(Colorways.presets, name) ? name : "pink";
};

// All of the app's theme colors update together through CSS variables.
Colorways.apply = function (name) {
  const chosen = Colorways.resolve(name);
  const palette = Colorways.presets[chosen];
  Colorways.keys.forEach(function (key, index) {
    document.documentElement.style.setProperty(key, palette.colors[index]);
  });
  Colorways.current = chosen;
  document.querySelectorAll("[data-colorway]").forEach(function (button) {
    button.setAttribute("aria-pressed", String(button.dataset.colorway === chosen));
  });
};

// Called by sign-in so each account gets its own saved palette.
Colorways.sync = function (user) {
  Colorways.session = null;
  if (colorwayDialog.open) colorwayDialog.close();
  Colorways.apply(user?.user_metadata?.colorway);
};

// Add the pencil button to the existing Profile actions.
const colorwayButton = document.createElement("button");
colorwayButton.id = "openColorwayButton";
colorwayButton.type = "button";
colorwayButton.className = "primary";
colorwayButton.textContent = "✎ Colorway";
App.get("profileSettingsActions").appendChild(colorwayButton);

// Keep this popup separate from Settings so the tabs don't get crowded.
const colorwayDialog = document.createElement("dialog");
colorwayDialog.id = "colorwayDialog";
colorwayDialog.setAttribute("aria-labelledby", "colorwayHeading");
colorwayDialog.innerHTML = `
  <h2 id="colorwayHeading">Choose Your Colorway</h2>
  <p>Same closet, your favorite colors. Tap a preset to preview it.</p>
  <div id="colorwayOptions" class="colorway-options"></div>
  <div class="button-row">
    <button id="saveColorwayButton" class="primary" type="button">Save Colorway</button>
    <button id="cancelColorwayButton" type="button">Cancel</button>
  </div>
  <p id="colorwayStatus" role="status"></p>
`;
document.body.appendChild(colorwayDialog);

// Show a light background, a soft panel color, and the darker accent.
Object.entries(Colorways.presets).forEach(function ([id, preset]) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.colorway = id;
  button.setAttribute("aria-pressed", "false");
  const swatches = document.createElement("span");
  swatches.className = "colorway-swatches";
  swatches.setAttribute("aria-hidden", "true");
  preset.preview.forEach(function (color) {
    const dot = document.createElement("span");
    dot.style.backgroundColor = color;
    swatches.appendChild(dot);
  });
  const label = document.createElement("span");
  label.textContent = preset.name;
  button.append(swatches, label);
  button.addEventListener("click", function () {
    if (Colorways.busy) return;
    Colorways.apply(id);
    App.get("colorwayStatus").textContent = "Previewing " + preset.name + ". Tap Save Colorway to keep it.";
  });
  App.get("colorwayOptions").appendChild(button);
});

colorwayButton.addEventListener("click", function () {
  if (!Account.user || Colorways.busy) return;
  Colorways.session = { userId: Account.user.id, attempt: Account.attempt };
  Colorways.apply(Account.user.user_metadata?.colorway);
  App.get("colorwayStatus").textContent = "Your choice will be saved to this account.";
  if (!colorwayDialog.open) colorwayDialog.showModal();
});

App.get("cancelColorwayButton").addEventListener("click", function () {
  if (!Colorways.busy) colorwayDialog.close();
});

// Don't interrupt a preference save with Escape.
colorwayDialog.addEventListener("cancel", function (event) {
  if (Colorways.busy) event.preventDefault();
});

// Closing without saving restores the account's saved theme.
colorwayDialog.addEventListener("close", function () {
  const session = Colorways.session;
  Colorways.session = null;
  if (!session) return;
  const sameAccount = Account.user?.id === session.userId && Account.attempt === session.attempt;
  Colorways.apply(sameAccount ? Account.user.user_metadata?.colorway : "pink");
});

// Supabase stores this small preference alongside the account's name.
App.get("saveColorwayButton").addEventListener("click", async function () {
  const session = Colorways.session;
  if (Colorways.busy || !session || Account.user?.id !== session.userId) return;
  const selected = Colorways.current;
  Colorways.busy = true;
  App.busy(colorwayDialog, true);
  this.textContent = "Saving...";
  App.get("colorwayStatus").textContent = "Saving your colorway...";
  try {
    const result = await Account.client.auth.updateUser({
      data: { colorway: selected }
    });
    if (result.error) throw result.error;
    if (Account.user?.id !== session.userId || Account.attempt !== session.attempt ||
        Colorways.session !== session) return;
    Account.user = result.data.user;
    Colorways.apply(selected);
    colorwayDialog.close();
  } catch (error) {
    if (Colorways.session === session) {
      App.get("colorwayStatus").textContent = "Your choice couldn't be saved. Check your connection and try again.";
    }
  } finally {
    Colorways.busy = false;
    App.busy(colorwayDialog, false);
    App.get("saveColorwayButton").textContent = "Save Colorway";
  }
});
