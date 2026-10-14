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

 <!-- These are instructions, not clickable buttons. -->
<div id="laundrySwipeActions" class="laundry-swipe-directions">
  <span>← In Laundry</span>
  <span>Clean →</span>
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
  // Start each clothing item in the middle.
Laundry.resetSwipeCard();
  card.replaceChildren();
  Laundry.pointerStart = null;

  const item = Laundry.queue[Laundry.position];
  // Hide the empty card when the review is finished.
card.hidden = !item;

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
    "Swipe left for laundry or right for clean.";

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

// Return the card to the middle after a short or cancelled swipe.
Laundry.resetSwipeCard = function () {
  const card = App.get("laundrySwipeCard");

  // Stop any previous toss animation.
  if (Laundry.tossAnimation) {
    Laundry.tossAnimation.cancel();
    Laundry.tossAnimation = null;
  }

  card.style.transition =
    "transform 180ms ease, opacity 180ms ease";

  card.style.transform = "translateX(0px) rotate(0deg)";
  card.style.opacity = "1";

  delete card.dataset.direction;
};

// Animate the choice, save it, then show the next clothing item.
Laundry.answerSwipe = async function (inLaundry) {
  if (Laundry.busy) return;

  const item = Laundry.queue[Laundry.position];
  if (!item) return;

  Laundry.setBusy(true);
  Laundry.pointerStart = null;

  const card = App.get("laundrySwipeCard");

  try {
    // Left is negative; right is positive.
    const direction = inLaundry ? -1 : 1;

    // Move far enough to leave the screen completely.
    const distance =
      window.innerWidth + card.getBoundingClientRect().width;

    // Use a short fade if the phone's Reduce Motion setting is on.
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    card.dataset.direction = inLaundry ? "left" : "right";

    App.get("laundryStatus").textContent =
      "Saving your choice...";

    // Begin at the card's current dragged position.
    const animation = card.animate(
      [
        {
          transform: getComputedStyle(card).transform,
          opacity: 1
        },
        {
          transform: reducedMotion
            ? "none"
            : "translateX(" + direction * distance +
              "px) rotate(" + direction * 24 + "deg)",
          opacity: 0
        }
      ],
      {
        duration: reducedMotion ? 100 : 320,
        easing: "cubic-bezier(0.4, 0, 0.8, 1)",
        fill: "forwards"
      }
    );

    Laundry.tossAnimation = animation;

    // Save while the animation plays.
    // Only advance after both have finished.
    await Promise.all([
      animation.finished.catch(function () {}),
      Laundry.saveStatus(item.id, inLaundry)
    ]);

    // Don't advance an old review if its queue was reset.
    if (Laundry.queue[Laundry.position] !== item) return;

    item.inLaundry = inLaundry;

    // Update the other features without restarting this review.
    App.changed();

    Laundry.position++;
    Laundry.showSwipeCard();
  } catch (error) {
    // Bring this same item back if saving failed.
    Laundry.resetSwipeCard();

    App.get("laundryStatus").textContent =
      "That change wasn't saved. Swipe again to retry.";

    alert("That change could not be saved. Please try again.");
  } finally {
    Laundry.resetSwipeCard();
    Laundry.setBusy(false);
  }
};

// The same controls support touch and mouse dragging.
const laundrySwipeCard = App.get("laundrySwipeCard");

// Allow keyboard users to focus the card.
laundrySwipeCard.tabIndex = 0;

laundrySwipeCard.setAttribute("role", "group");

laundrySwipeCard.setAttribute(
  "aria-label",
  "Clothing to review. Left for laundry, right for clean."
);

// Remember where the finger or mouse started.
laundrySwipeCard.addEventListener(
  "pointerdown",
  function (event) {
    if (Laundry.busy || !Laundry.queue[Laundry.position]) return;

    // Ignore an extra finger while already dragging.
    if (Laundry.pointerStart) return;

    // Only use the main mouse button.
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    Laundry.resetSwipeCard();

    // Follow the finger immediately, without a transition delay.
    this.style.transition = "none";

    Laundry.pointerStart = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId
    };

    this.setPointerCapture(event.pointerId);
  }
);

// Move and tilt the card while dragging.
laundrySwipeCard.addEventListener(
  "pointermove",
  function (event) {
    const start = Laundry.pointerStart;

    if (
      Laundry.busy ||
      !start ||
      start.id !== event.pointerId
    ) {
      return;
    }

    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;

    // Leave normal vertical scrolling alone.
    if (Math.abs(horizontal) < Math.abs(vertical)) {
      this.style.transform = "translateX(0px) rotate(0deg)";
      delete this.dataset.direction;
      return;
    }

    // Tilt slightly in the direction of the swipe.
    const tilt = Math.max(
      -20,
      Math.min(20, horizontal / 18)
    );

    this.style.transform =
      "translateX(" + horizontal +
      "px) rotate(" + tilt + "deg)";

    this.dataset.direction =
      horizontal < 0 ? "left" : "right";
  }
);

// Decide whether the released swipe was strong enough.
laundrySwipeCard.addEventListener(
  "pointerup",
  function (event) {
    const start = Laundry.pointerStart;

    if (!start || start.id !== event.pointerId) return;

    Laundry.pointerStart = null;

    if (this.hasPointerCapture(event.pointerId)) {
      this.releasePointerCapture(event.pointerId);
    }

    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;

    // A tap, short swipe, or mostly vertical movement saves nothing.
    if (
      Laundry.busy ||
      Math.abs(horizontal) < 60 ||
      Math.abs(horizontal) < Math.abs(vertical) * 1.5
    ) {
      Laundry.resetSwipeCard();
      return;
    }

    // Left means laundry; right means clean.
    Laundry.answerSwipe(horizontal < 0);
  }
);

// Return to the middle if the browser interrupts a drag.
function cancelLaundryDrag(event) {
  const start = Laundry.pointerStart;

  if (!start || start.id !== event.pointerId) return;

  Laundry.pointerStart = null;
  Laundry.resetSwipeCard();
}

laundrySwipeCard.addEventListener(
  "pointercancel",
  cancelLaundryDrag
);

laundrySwipeCard.addEventListener(
  "lostpointercapture",
  cancelLaundryDrag
);

// Arrow keys also work when the card is focused on a computer.
laundrySwipeCard.addEventListener(
  "keydown",
  function (event) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight"
    ) {
      return;
    }

    event.preventDefault();

    Laundry.answerSwipe(event.key === "ArrowLeft");
  }
);

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