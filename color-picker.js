// CLOTHING COLOR PALETTE
// The hidden old dropdown keeps existing search filters and backups compatible.
// A separate colorHex field stores the exact shade used by recommendations.
const ColorPicker = { exact: null, buttons: [] };

ColorPicker.select = App.get("color");
ColorPicker.select.hidden = true;
document.querySelector('label[for="color"]').hidden = true;

ColorPicker.panel = document.createElement("fieldset");
ColorPicker.panel.className = "clothing-color-picker";
ColorPicker.panel.innerHTML = `
  <legend>Clothing color</legend>
  <p class="color-help">Tap a shade, or use Custom color for any exact shade.</p>
  <div class="clothing-color-grid" aria-label="Color shades"></div>
  <div class="custom-clothing-color">
    <label>Custom color <input type="color" aria-label="Choose a custom clothing color"></label>
    <label>Hex color <input type="text" maxlength="7" placeholder="#3976bd"
      spellcheck="false" autocomplete="off" aria-label="Exact hex color"></label>
  </div>
  <button type="button" class="multicolor-choice">Multicolor / patterned</button>
  <p class="selected-clothing-color" role="status"></p>
`;
ColorPicker.select.after(ColorPicker.panel);
ColorPicker.grid = ColorPicker.panel.querySelector(".clothing-color-grid");
ColorPicker.native = ColorPicker.panel.querySelector('input[type="color"]');
ColorPicker.hex = ColorPicker.panel.querySelector('input[type="text"]');
ColorPicker.status = ColorPicker.panel.querySelector('[role="status"]');
ColorPicker.multi = ColorPicker.panel.querySelector(".multicolor-choice");

// Refresh the preview without changing an old item's saved color.
ColorPicker.refresh = function () {
  const name = ColorPicker.select.value;
  const hex = ColorPicker.exact || Styling.hexFor(name);
  ColorPicker.native.value = hex;
  ColorPicker.hex.value = ColorPicker.exact || "";
  ColorPicker.hex.setCustomValidity("");
  ColorPicker.status.textContent = ColorPicker.exact
    ? name + " · " + hex
    : name === "Multicolor" ? "Multicolor / patterned"
    : name + " · choose a swatch to set an exact shade";
  ColorPicker.multi.setAttribute("aria-pressed", String(name === "Multicolor"));
  let selectedButton = null;
  ColorPicker.buttons.forEach(function (button) {
    const chosen = ColorPicker.exact === button.dataset.hex;
    button.setAttribute("aria-pressed", String(chosen));
    button.textContent = chosen ? "✓" : "";
    button.tabIndex = -1;
    if (chosen) selectedButton = button;
  });
  // One tab stop for the palette. Arrow keys move between shades.
  (selectedButton || ColorPicker.buttons[0]).tabIndex = 0;
};

ColorPicker.choose = function (hex) {
  if (!Styling.isHex(hex)) return;
  ColorPicker.exact = hex.toLowerCase();
  ColorPicker.select.value = Styling.info(hex).label;
  ColorPicker.refresh();
};

// Ten neutrals, then seven shade rows across ten color families.
const clothingSwatches = ["#ffffff", "#f3e7cd", "#d3c0a4", "#b38c69", "#8b6244",
  "#573d2b", "#dedede", "#a5a5a5", "#626262", "#171717"];
[0.9, 0.78, 0.65, 0.52, 0.4, 0.28, 0.16].forEach(function (light) {
  [0, 24, 45, 62, 110, 155, 185, 215, 265, 320].forEach(function (hue) {
    clothingSwatches.push(Styling.fromHsl(hue, 0.58, light));
  });
});
clothingSwatches.forEach(function (hex) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "clothing-color-swatch";
  button.dataset.hex = hex;
  button.style.backgroundColor = hex;
  button.style.color = Styling.info(hex).l > 0.6 ? "#111111" : "#ffffff";
  const label = Styling.info(hex).label + " " + hex;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", function () { ColorPicker.choose(hex); });
  ColorPicker.grid.appendChild(button);
  ColorPicker.buttons.push(button);
});
ColorPicker.grid.addEventListener("keydown", function (event) {
  const index = ColorPicker.buttons.indexOf(event.target);
  if (index < 0) return;
  const moves = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 10, ArrowUp: -10 };
  let next = index;
  if (event.key in moves) next = Styling.clamp(index + moves[event.key], 0, ColorPicker.buttons.length - 1);
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = ColorPicker.buttons.length - 1;
  else return;
  event.preventDefault();
  ColorPicker.buttons.forEach(function (button) { button.tabIndex = -1; });
  ColorPicker.buttons[next].tabIndex = 0;
  ColorPicker.buttons[next].focus();
});
ColorPicker.native.addEventListener("input", function () { ColorPicker.choose(this.value); });
ColorPicker.hex.addEventListener("input", function () {
  this.setCustomValidity("");
  if (Styling.isHex(this.value.trim())) ColorPicker.choose(this.value.trim());
});
ColorPicker.multi.addEventListener("click", function () {
  ColorPicker.exact = null;
  ColorPicker.select.value = "Multicolor";
  ColorPicker.refresh();
});
ColorPicker.validate = function () {
  const value = ColorPicker.hex.value.trim();
  if (value && !Styling.isHex(value)) {
    ColorPicker.hex.setCustomValidity("Use a # followed by six letters or numbers, such as #3976bd.");
    ColorPicker.hex.reportValidity();
    return false;
  }
  if (value) ColorPicker.choose(value);
  return true;
};
ColorPicker.reset = function () {
  ColorPicker.exact = null;
  ColorPicker.refresh();
};
ColorPicker.setItem = function (item) {
  ColorPicker.exact = Styling.isHex(item.colorHex) ? item.colorHex.toLowerCase() : null;
  ColorPicker.refresh();
};
ColorPicker.reset();
