// LAUNDRY GRID AND SWIPE MODE
const Laundry = {
  reviewing: false,
  mode: "grid",
  busy: false,
  refreshNumber: 0,
  clothes: [],
  lastWorn: new Map(),
  queue: [],
  position: 0,
  pointerStart: null
};

// Create the new controls without changing index.html.
const laundryControls = document.createElement("div");
laundryControls.className = "button-row";

laundryControls.innerHTML = `
  <button id="laundryGridMode" type="button" aria-pressed="true">
    Grid Mode
  </button>
  <button id="laundrySwipeMode" type="button" aria-pressed="false">
    Swipe Mode
  </button>
`;

// Put the mode controls before the existing clothing grid.
App.get("laundryGrid").before(laundryControls);

const swipePanel = document.createElement("div");
swipePanel.id = "laundrySwipePanel";
swipePanel.hidden = true;

swipePanel.innerHTML = `
  <p id="laundrySwipeProgress"></p>

  <div id="laundrySwipeCard"></div>

  <div id="laundrySwipeActions" class="button-row">
    <button id="swipeToLaundry" class="primary" type="button">
      ← In Laundry
    </button>
    <button id="swipeToClean" type="button">
      Clean →
    </button>
  </div>

  <button id="restartLaundrySwipe" class="primary"
          type="button" hidden>
    Review Again
  </button>
`;

App.get("laundryGrid").after(swipePanel);

// Convert a calendar date into a day number.
Laundry.dayNumber = function (value) {
  const parts = value.split("-").map(Number);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000;
};

// Read clothing and find each item's latest recorded wear date.
Laundry.loadData = async function () {
  const data = await App.read(["clothes", "history"]);
  const lastWorn = new Map();

  data.history.forEach(function (entry) {
    entry.clothingIds.forEach(function (id) {
      const previous = lastWorn.get(id);

      if (!previous || entry.date > previous) {
        lastWorn.set(id, entry.date);
      }
    });
  });

  // Most recently worn first; use names to break ties.
  data.clothes.sort(function (a, b) {
    const aDate = lastWorn.get(a.id) || "";
    const bDate = lastWorn.get(b.id) || "";

    return bDate.localeCompare(aDate) ||
      a.name.localeCompare(b.name);
  });

  return { clothes: data.clothes, lastWorn: lastWorn };
};

// Set buttons and visibility to match the current mode.
Laundry.updateControls = function () {
  const swiping = Laundry.mode === "swipe";

  App.get("laundryGrid").hidden = swiping;
  swipePanel.hidden = !swiping;

  App.get("laundryGridMode").setAttribute(
    "aria-pressed", String(!swiping)
  );

  App.get("laundrySwipeMode").setAttribute(
    "aria-pressed", String(swiping)
  );

  App.get("reviewLaundryButton").textContent =
    Laundry.reviewing ? "Done Updating" : "Update Laundry";
};

// Load and display the laundry page.
Laundry.render = async function () {
  const current = ++Laundry.refreshNumber;

  try {
    const data = await Laundry.loadData();
    if (current !== Laundry.refreshNumber) return;

    Laundry.clothes = data.clothes;
    Laundry.lastWorn = data.lastWorn;
    Laundry.updateControls();

    if (Laundry.mode === "swipe") {
      Laundry.startSwipeReview();
      return;
    }

    Laundry.renderGrid();
  } catch (error) {
    App.get("laundryStatus").textContent =
      "Laundry could not be loaded. Please refresh.";
  }
};

// Display the sorted clothing grid.
Laundry.renderGrid = function () {
  const grid = App.get("laundryGrid");
  grid.replaceChildren();

  const visible = Laundry.clothes.filter(function (item) {
    return Laundry.reviewing || item.inLaundry;
  });

  App.get("laundryStatus").textContent = !Laundry.clothes.length
    ? "Add clothes in My Closet first."
    : Laundry.reviewing
      ? "Most recently worn first. Check clothes in the laundry."
      : visible.length
        ? visible.length + " item(s) in laundry, most recently worn first."
        : "Your laundry basket is empty!";

  visible.forEach(function (item) {
    const card = document.createElement("div");
    card.className = "laundry-card";

    const title = document.createElement("h3");
    title.textContent = item.name;

    const date = Laundry.lastWorn.get(item.id);
    const worn = document.createElement("p");
    worn.textContent = date
      ? "Last worn: " + History.formatDate(date)
      : "No recorded wears";

    const label = document.createElement("label");
    label.className = "check-label";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.inLaundry;

    label.append(checkbox, document.createTextNode(" In laundry"));

    checkbox.addEventListener("change", async function () {
      if (Laundry.busy) return;

      const nextStatus = checkbox.checked;
      Laundry.setBusy(true);

      try {
        await Laundry.saveStatus(item.id, nextStatus);
        App.changed();
      } catch (error) {
        checkbox.checked = item.inLaundry;
        alert("Laundry could not be updated.");
      } finally {
        Laundry.setBusy(false);
        Laundry.render();
      }
    });

    card.append(App.photo(item), title, worn, label);
    grid.appendChild(card);
  });
};

// Save only the laundry status, preserving the item's other details.
Laundry.saveStatus = async function (id, inLaundry) {
  const data = await App.read(["clothes"]);

  const latest = data.clothes.find(function (item) {
    return item.id === id;
  });

  if (!latest) throw new Error("Item was deleted");

  await App.write([{
    store: "clothes",
    value: { ...latest, inLaundry: inLaundry }
  }]);
};

Laundry.setBusy = function (busy) {
  Laundry.busy = busy;
  App.busy(App.get("laundryPage"), busy);
};

// Build a queue of unique clothing worn in the last four calendar days.
Laundry.startSwipeReview = function () {
  const today = Laundry.dayNumber(History.today());

  Laundry.queue = Laundry.clothes.filter(function (item) {
    const date = Laundry.lastWorn.get(item.id);
    if (!date) return false;

    const age = today - Laundry.dayNumber(date);

    // Today plus the previous three days.
    return age >= 0 && age < 4;
  });

  Laundry.position = 0;
  Laundry.showSwipeCard();
};

// Display one clothing item at a time.
Laundry.showSwipeCard = function () {
  const card = App.get("laundrySwipeCard");
  card.replaceChildren();
  Laundry.pointerStart = null;

  const item = Laundry.queue[Laundry.position];

  App.get("laundrySwipeActions").hidden = !item;
  App.get("restartLaundrySwipe").hidden =
    Boolean(item) || Laundry.queue.length === 0;

  if (!item) {
    App.get("laundrySwipeProgress").textContent = "";

    App.get("laundryStatus").textContent = Laundry.queue.length
      ? "All recent clothes reviewed! Your changes are saved."
      : "No clothes were logged as worn in the last four days.";

    return;
  }

  App.get("laundryStatus").textContent =
    "Swipe left for laundry, right for clean—or use the buttons.";

  App.get("laundrySwipeProgress").textContent =
    (Laundry.position + 1) + " of " + Laundry.queue.length;

  const title = document.createElement("h3");
  title.textContent = item.name;

  const details = document.createElement("p");
  details.textContent =
    "Last worn: " +
    History.formatDate(Laundry.lastWorn.get(item.id)) +
    " • Currently " + (item.inLaundry ? "in laundry" : "clean");

  card.append(App.photo(item), title, details);
};

// Save the current swipe decision and move to the next item.
Laundry.answerSwipe = async function (inLaundry) {
  if (Laundry.busy) return;

  const item = Laundry.queue[Laundry.position];
  if (!item) return;

  Laundry.setBusy(true);

  try {
    await Laundry.saveStatus(item.id, inLaundry);
    item.inLaundry = inLaundry;

    // Update other app features without restarting this review.
    App.changed();

    Laundry.position++;
    Laundry.showSwipeCard();
  } catch (error) {
    alert("That change could not be saved. Please try again.");
  } finally {
    Laundry.setBusy(false);
  }
};

// Swipe detection also works by dragging with a mouse.
App.get("laundrySwipeCard").addEventListener(
  "pointerdown", function (event) {
    if (Laundry.busy || !Laundry.queue[Laundry.position]) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    Laundry.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId
    };

    this.setPointerCapture(event.pointerId);
  }
);

App.get("laundrySwipeCard").addEventListener(
  "pointerup", function (event) {
    const start = Laundry.pointerStart;
    Laundry.pointerStart = null;

    if (!start || start.id !== event.pointerId) return;

    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;

    // Ignore taps and movements that are mostly vertical.
    if (
      Math.abs(horizontal) < 60 ||
      Math.abs(horizontal) < Math.abs(vertical) * 1.5
    ) return;

    // Left means laundry; right means clean.
    Laundry.answerSwipe(horizontal < 0);
  }
);

App.get("laundrySwipeCard").addEventListener(
  "pointercancel", function () {
    Laundry.pointerStart = null;
  }
);

App.get("swipeToLaundry").addEventListener("click", function () {
  Laundry.answerSwipe(true);
});

App.get("swipeToClean").addEventListener("click", function () {
  Laundry.answerSwipe(false);
});

// Switch between grid and swipe modes.
App.get("laundryGridMode").addEventListener("click", function () {
  if (Laundry.busy) return;
  Laundry.mode = "grid";
  Laundry.render();
});

App.get("laundrySwipeMode").addEventListener("click", function () {
  if (Laundry.busy) return;
  Laundry.mode = "swipe";
  Laundry.render();
});

App.get("restartLaundrySwipe").addEventListener("click", function () {
  Laundry.render();
});

// Update Laundry opens the grid of all clothing.
App.get("reviewLaundryButton").addEventListener("click", function () {
  if (Laundry.busy) return;

  Laundry.reviewing = !Laundry.reviewing;
  Laundry.mode = "grid";
  Laundry.render();
});

// Mark every item clean together.
App.get("cleanAllButton").addEventListener("click", async function () {
  if (Laundry.busy || !confirm("Mark every clothing item clean?")) return;

  Laundry.setBusy(true);

  try {
    const data = await App.read(["clothes"]);

    await App.write(data.clothes.map(function (item) {
      return {
        store: "clothes",
        value: { ...item, inLaundry: false }
      };
    }));

    App.changed();
  } catch (error) {
    alert("Clothes could not be marked clean.");
  } finally {
    Laundry.setBusy(false);
    Laundry.render();
  }
});

// Reload when opening the page or when other features change data.
// Do not restart a swipe review during its own save.
function refreshLaundryIfVisible() {
  if (!App.get("laundryPage").hidden && !Laundry.busy) {
    Laundry.render();
  }
}

document.addEventListener("closet-page-changed", refreshLaundryIfVisible);
document.addEventListener("closet-data-changed", refreshLaundryIfVisible);