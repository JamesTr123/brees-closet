// SHORT GUIDED TOUR
const Tour = {
  active: false,
  position: 0,
  userId: null
};

// One short step per main tab.
Tour.steps = [
  {
    page: "homePage",
    title: "Welcome to Bree's Closet ♡",
    text:
      "Home shows today's outfit, quick closet stats, and your strongest match. " +
      "Use Log an Outfit or Pick My Outfit to get started. " +
      "Settings in the top right has Profile, Navigation, and Storage tabs."
  },
  {
    page: "closetPage",
    title: "My Closet",
    text:
      "Add clothing photos and choose their type, color, warmth, " +
      "and styles. Tap i for details or Edit to make changes. " +
      "Style This Piece finds new combinations or shows your saved outfits."
  },
  {
    page: "outfitsPage",
    title: "My Outfits",
    text:
      "Tap ♡ Add Outfit to combine your clothes. A star marks a favorite. " +
      "Log an Outfit records what you wore and when. " +
      "After saving or logging, you can add an outfit photo or skip it."
  },
  {
    page: "deciderPage",
    title: "Find Your Next Outfit",
    text:
      "Choose styles and warmth, or use your location for weather. " +
      "Laundry items are excluded, and you can avoid recent repeats. " +
      "The Match meter goes from blue and low to red and high: " +
      "it measures recommendation strength, not warmth. " +
      "Save new combinations with Add to My Outfits."
  },
  {
    page: "laundryPage",
    title: "Keep Laundry Up to Date",
    text:
      "Update Laundry shows recently worn clothes first. " +
      "Check items that are in the laundry. Swipe Mode reviews clothes " +
      "worn in the last four days: left means laundry, right means clean. " +
      "The card follows your swipe and tosses away when you choose. You're ready!"
  }
];

// Build the guide without needing more HTML edits.
const tourPanel = document.createElement("section");
tourPanel.id = "guidedTour";
tourPanel.hidden = true;
tourPanel.setAttribute("aria-label", "App tutorial");

tourPanel.innerHTML = `
  <div class="tour-top-row">
    <span id="tourProgress"></span>
    <button id="skipTourButton" type="button">Skip</button>
  </div>

  <h3 id="tourHeading" tabindex="-1"></h3>
  <p id="tourText"></p>

  <div class="button-row">
    <button id="backTourButton" type="button">Back</button>
    <button id="nextTourButton" class="primary" type="button">Next</button>
  </div>
`;

document.body.appendChild(tourPanel);

// Start from Home, whether this is automatic or opened from Settings.
Tour.start = function () {
  if (
    !Account.user ||
    document.body.classList.contains("account-setup")
  ) return;

  Tour.active = true;
  Tour.position = 0;
  Tour.userId = Account.user.id;

  document.body.classList.add("tour-active");
  tourPanel.hidden = false;

  Tour.showStep();
};

// Open the step's real tab, then display its explanation.
Tour.showStep = function () {
  if (!Tour.active) return;

  const step = Tour.steps[Tour.position];

  App.get("tourHeading").textContent = step.title;
  App.get("tourText").textContent = step.text;
  App.get("tourProgress").textContent =
    (Tour.position + 1) + " of " + Tour.steps.length;

  App.get("backTourButton").disabled = Tour.position === 0;

  App.get("nextTourButton").textContent =
    Tour.position === Tour.steps.length - 1 ? "Finish" : "Next";

  // Use existing navigation so each real page loads normally.
  const tab = document.querySelector(
    '.bottom-tabs button[data-page="' + step.page + '"]'
  );

  tab.click();

  // Highlight the tab being explained.
  document.querySelectorAll(".bottom-tabs button").forEach(
    function (button) {
      button.classList.toggle("tour-highlight", button === tab);
    }
  );

  // Announce the step heading for keyboard and screen-reader users.
  App.get("tourHeading").focus({ preventScroll: true });
};

// Finish or skip the tutorial.
// Account metadata remembers it across devices.
Tour.finish = async function () {
  const userId = Tour.userId;

  Tour.active = false;
  tourPanel.hidden = true;
  document.body.classList.remove("tour-active");

  document.querySelectorAll(".tour-highlight").forEach(
    function (button) {
      button.classList.remove("tour-highlight");
    }
  );

  if (!Account.user || Account.user.id !== userId) return;

  // Remember locally too, in case the metadata update fails.
  try {
    localStorage.setItem("closet-tour-seen-" + userId, "yes");
  } catch (error) {
    // The tour still closes if local storage is unavailable.
  }

  try {
    const result = await Account.client.auth.updateUser({
      data: { tutorial_pending: false }
    });

    if (!result.error && Account.user?.id === userId) {
      Account.user = result.data.user;
    }
  } catch (error) {
    // This does not affect closet saving or close the user's session.
    console.warn("Tutorial preference could not be saved.");
  }
};

// Decide whether a newly created account still needs its first tour.
Tour.shouldStart = function (user) {
  if (!user?.user_metadata?.tutorial_pending) return false;

  try {
    return localStorage.getItem(
      "closet-tour-seen-" + user.id
    ) !== "yes";
  } catch (error) {
    return true;
  }
};

App.get("backTourButton").addEventListener("click", function () {
  if (Tour.position > 0) {
    Tour.position--;
    Tour.showStep();
  }
});

App.get("nextTourButton").addEventListener("click", function () {
  if (Tour.position === Tour.steps.length - 1) {
    Tour.finish();
  } else {
    Tour.position++;
    Tour.showStep();
  }
});

App.get("skipTourButton").addEventListener("click", Tour.finish);

// If she manually changes tabs, close the guide.
// It remains available in Settings.
document.addEventListener("closet-page-changed", function () {
  if (!Tour.active) return;

  const currentTab = document.querySelector(".bottom-tabs button.active");
  const expectedPage = Tour.steps[Tour.position].page;

  if (currentTab?.dataset.page !== expectedPage) {
    Tour.finish();
  }
});

// Never leave one account's tutorial open on a signed-out screen.
const tourAccountObserver = new MutationObserver(function () {
  if (
    Tour.active &&
    document.body.classList.contains("account-setup")
  ) {
    Tour.active = false;
    tourPanel.hidden = true;
    document.body.classList.remove("tour-active");

    document.querySelectorAll(".tour-highlight").forEach(
      function (button) {
        button.classList.remove("tour-highlight");
      }
    );
  }
});

tourAccountObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});