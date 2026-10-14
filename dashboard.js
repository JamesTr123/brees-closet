// HOME DASHBOARD AND CLOSET STATISTICS
// This file reads the closet. It never changes clothing or outfit records.
const Dashboard = {
  requestNumber: 0,
  selectedTodayId: null,
  todayEntries: [],
  lastDate: null,
  timer: null
};

// Open a real app tab using the existing navigation.
Dashboard.goTo = function (page) {
  const button = document.querySelector(
    '.bottom-tabs button[data-page="' + page + '"]'
  );
  if (button) button.click();
};

Dashboard.ready = function () {
  return typeof Account !== "undefined" && Account.user &&
    !document.body.classList.contains("account-setup");
};

// Discard the previous account's photos and stats when signing out.
Dashboard.clear = function () {
  Dashboard.requestNumber++;
  Decider.previewRequestNumber++;
  clearTimeout(Dashboard.timer);
  Dashboard.todayEntries = [];
  Dashboard.selectedTodayId = null;
  Dashboard.lastDate = null;
  ["homeTodayPhotos", "homeTodayChoices", "settingsClosetStats",
    "settingsClosetBreakdowns"].forEach(function (id) {
    App.get(id).replaceChildren();
  });
  ["homeClothesCount", "homeOutfitsCount", "homeLaundryCount",
    "homeMatchScore"].forEach(function (id) {
    App.get(id).textContent = "—";
  });
  App.get("homeTodayChoices").hidden = true;
  App.get("homeTodayMessage").textContent = "Loading your day...";
  App.get("homeMatchNote").textContent = "Checking your available clothes...";
  App.get("homeStatus").textContent = "";
  App.get("settingsStatsStatus").textContent = "";
  App.get("welcomeHeading").textContent = "Welcome back ♡";
  App.get("closetHeading").textContent = "My Closet ♡";
  Settings.renderAccount();
};

// Show a selfie first. Without one, show the individual clothing photos.
Dashboard.addOutfitPhotos = function (container, entry, data) {
  const outfit = data.outfits.find(function (item) {
    return item.id === entry.outfitId;
  }) || History.findSaved(data.outfits, entry.clothingIds);
  const selfie = entry.outfitPhoto || outfit?.photo;

  if (selfie) {
    const image = document.createElement("img");
    image.src = selfie;
    image.alt = "Your outfit worn today";
    image.className = "home-outfit-selfie";
    container.appendChild(image);
    return;
  }

  entry.clothingIds.forEach(function (id) {
    const item = data.clothes.find(function (piece) { return piece.id === id; });
    if (item?.photo) container.appendChild(App.photo(item));
  });
};

Dashboard.renderToday = function (data) {
  const today = History.today();
  const entries = data.history.filter(function (entry) { return entry.date === today; });
  Dashboard.todayEntries = entries;
  App.get("homeTodayDate").textContent = History.formatDate(today);

  const photos = App.get("homeTodayPhotos");
  const choices = App.get("homeTodayChoices");
  photos.replaceChildren();
  choices.replaceChildren();
  choices.hidden = entries.length < 2;

  if (!entries.length) {
    Dashboard.selectedTodayId = null;
    photos.hidden = true;
    App.get("homeTodayMessage").textContent =
      "What are you wearing today? Log a look or find one you'll love.";
    App.get("homeLogButton").textContent = "Log an Outfit";
    return;
  }

  const selected = entries.find(function (entry) {
    return entry.id === Dashboard.selectedTodayId;
  }) || entries[0];
  Dashboard.selectedTodayId = selected.id;
  Dashboard.addOutfitPhotos(photos, selected, data);
  photos.hidden = photos.childElementCount === 0;
  App.get("homeTodayMessage").textContent = entries.length > 1
    ? entries.length + " outfits logged today. Tap a thumbnail to view each one."
    : "Today's look is logged. Looking good! ♡";
  App.get("homeLogButton").textContent = "Log Another Outfit";

  // A day can contain more than one outfit. Keep all of them accessible.
  if (entries.length > 1) {
    entries.forEach(function (entry, index) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "View today's outfit " + (index + 1));
      button.setAttribute("aria-pressed", String(entry.id === selected.id));
      Dashboard.addOutfitPhotos(button, entry, data);
      if (!button.childElementCount) button.textContent = "Outfit " + (index + 1);
      button.addEventListener("click", function () {
        Dashboard.selectedTodayId = entry.id;
        Dashboard.renderToday(data);
      });
      choices.appendChild(button);
    });
  }
};

// Create a small stat tile using plain text, so names are safe to display.
Dashboard.statTile = function (label, value) {
  const tile = document.createElement("div");
  const number = document.createElement("strong");
  number.textContent = value;
  const text = document.createElement("span");
  text.textContent = label;
  tile.append(number, text);
  return tile;
};

// Count clothing by type, color, style, or warmth.
Dashboard.breakdown = function (title, pairs) {
  const section = document.createElement("section");
  section.className = "settings-breakdown";
  const heading = document.createElement("h4");
  heading.textContent = title;
  section.appendChild(heading);
  const list = document.createElement("dl");
  for (const [label, count] of pairs) {
    const row = document.createElement("div");
    const name = document.createElement("dt");
    name.textContent = label;
    const value = document.createElement("dd");
    value.textContent = count;
    row.append(name, value);
    list.appendChild(row);
  }
  section.appendChild(list);
  return section;
};

Dashboard.renderStats = function (data) {
  const clothes = data.clothes;
  const history = data.history;
  const today = History.today();
  const todayNumber = History.validDate(today) ? Laundry.dayNumber(today) : 0;
  const laundry = clothes.filter(function (item) { return item.inLaundry; }).length;

  App.get("homeClothesCount").textContent = clothes.length;
  App.get("homeOutfitsCount").textContent = data.outfits.length;
  App.get("homeLaundryCount").textContent = laundry;

  const daysWorn = new Map();
  history.forEach(function (entry) {
    entry.clothingIds.forEach(function (id) {
      if (!daysWorn.has(id)) daysWorn.set(id, new Set());
      daysWorn.get(id).add(entry.date);
    });
  });
  const mostWorn = [...clothes].sort(function (a, b) {
    return (daysWorn.get(b.id)?.size || 0) - (daysWorn.get(a.id)?.size || 0);
  })[0];
  const mostWornDays = mostWorn ? daysWorn.get(mostWorn.id)?.size || 0 : 0;
  const wornClothes = clothes.filter(function (item) { return daysWorn.has(item.id); }).length;
  const recent = history.filter(function (entry) {
    const age = todayNumber - Laundry.dayNumber(entry.date);
    return age >= 0 && age < 7;
  }).length;
  const uniquePhotos = new Set();
  [...clothes, ...data.outfits, ...history].forEach(function (record) {
    for (const field of ["photo", "outfitPhoto"]) {
      if (record[field]) uniquePhotos.add(record[field]);
    }
  });
  const lastDate = history.map(function (entry) { return entry.date; }).sort().pop();
  const warmthAverage = clothes.length
    ? (clothes.reduce(function (sum, item) { return sum + Number(item.warmth); }, 0) / clothes.length).toFixed(1)
    : "—";

  const stats = [
    ["Clothing items", clothes.length],
    ["Available clothing", clothes.length - laundry],
    ["In laundry", laundry],
    ["Tops", clothes.filter(function (item) { return item.category === "Top"; }).length],
    ["Bottoms", clothes.filter(function (item) { return item.category === "Bottom"; }).length],
    ["Tops marked for layering", clothes.filter(function (item) { return item.category === "Top" && item.canLayer; }).length],
    ["Saved outfits", data.outfits.length],
    ["Favorite outfits", data.outfits.filter(function (item) { return item.favorite; }).length],
    ["Outfit logs", history.length],
    ["Different days logged", new Set(history.map(function (entry) { return entry.date; })).size],
    ["Outfits logged today", Dashboard.todayEntries.length],
    ["Outfit logs in the last 7 days", recent],
    ["Clothing worn at least once", wornClothes],
    ["Clothing with no wear logs", clothes.length - wornClothes],
    ["Different photos currently in use", uniquePhotos.size],
    ["Average clothing warmth (1–3)", warmthAverage],
    ["Last logged date", lastDate ? History.formatDate(lastDate) : "No logs yet"],
    ["Most-worn clothing", mostWornDays ? mostWorn.name + " · " + mostWornDays + " days" : "No logs yet"]
  ];
  App.get("settingsClosetStats").replaceChildren(
    ...stats.map(function (stat) { return Dashboard.statTile(stat[0], stat[1]); })
  );
  App.get("settingsStatsStatus").textContent =
    "Photo count covers photos currently used by records, not unused cloud files or storage in GB.";

  const types = [...App.types.Top, ...App.types.Bottom].map(function (type) {
    return [type, clothes.filter(function (item) { return item.clothingType === type; }).length];
  });
  const untyped = clothes.filter(function (item) {
    return !App.types[item.category]?.includes(item.clothingType);
  }).length;
  if (untyped) types.push(["Type not set", untyped]);
  const styles = App.styles.map(function (style) {
    return [style, clothes.filter(function (item) { return item.styles.includes(style); }).length];
  });
  const colors = new Map();
  clothes.forEach(function (item) {
    const color = item.color || "Color not set";
    colors.set(color, (colors.get(color) || 0) + 1);
  });
  const colorPairs = [...colors].sort(function (a, b) {
    return b[1] - a[1] || a[0].localeCompare(b[0]);
  });
  const warmth = [1, 2, 3].map(function (level) {
    return ["Warmth " + level, clothes.filter(function (item) { return Number(item.warmth) === level; }).length];
  });
  const breakdowns = App.get("settingsClosetBreakdowns");
  breakdowns.replaceChildren(
    Dashboard.breakdown("Clothing Types", types),
    Dashboard.breakdown("Styles · an item can have several", styles),
    Dashboard.breakdown("Clothing Warmth", warmth)
  );
  if (colorPairs.length) breakdowns.appendChild(Dashboard.breakdown("Colors", colorPairs));
};

Dashboard.refresh = async function () {
  if (!Dashboard.ready()) return;
  if (App.get("homePage").hidden && !App.get("settingsDialog").open) return;
  const request = ++Dashboard.requestNumber;
  const userId = Account.user.id;
  const current = function () {
    return request === Dashboard.requestNumber && Account.user?.id === userId && Dashboard.ready();
  };
  App.get("homeStatus").textContent = "";
  App.get("homeMatchScore").textContent = "…";
  App.get("homeMatchNote").textContent = "Checking your available clothes...";
  try {
    // One read supplies Home, the Profile stats, and the score preview.
    const data = await App.read(["clothes", "outfits", "history", "dismissed"]);
    if (!current()) return;
    Dashboard.lastDate = History.today();
    Dashboard.renderToday(data);
    Dashboard.renderStats(data);
    Settings.renderAccount();

    // Use today's loaded weather. Never request location automatically.
    // Any warmth is used until the user chooses to load the weather.
    const weatherReady = Decider.weatherDate === History.today() && Decider.weatherRange;
    const results = await Decider.generate({
      preview: true,
      data: data,
      rangeName: weatherReady ? Decider.weatherRange : "any"
    });
    if (!current() || !results) return;
    const best = results[0];
    App.get("homeMatchScore").textContent = best ? best.score + "/100" : "—";
    App.get("homeMatchNote").textContent = best
      ? (weatherReady ? "Based on today's loaded weather" : "Any warmth until weather is loaded") +
        " · any style · avoids the last 7 days. Your Decider filters may change the score."
      : "No eligible match right now. Add compatible tops and bottoms, check laundry, or adjust the recent-wear filter in Outfit Decider.";
  } catch (error) {
    if (!current()) return;
    App.get("homeMatchScore").textContent = "—";
    App.get("homeMatchNote").textContent = "The match score couldn't be checked. Try again when you're connected.";
    App.get("homeStatus").textContent = "Some Home information couldn't be updated. Refresh to try again.";
    App.get("settingsStatsStatus").textContent = "Some statistics couldn't be refreshed. Reopen Settings to try again.";
  }
};

// Combine nearby refresh events so a save doesn't trigger several reads.
Dashboard.schedule = function () {
  clearTimeout(Dashboard.timer);
  Dashboard.timer = setTimeout(Dashboard.refresh, 80);
};

App.get("homeLogButton").addEventListener("click", function () {
  if (Dashboard.ready()) History.openLog();
});
App.get("homeDeciderButton").addEventListener("click", function () {
  Dashboard.goTo("deciderPage");
});
App.get("homeMatchButton").addEventListener("click", function () {
  Dashboard.goTo("deciderPage");
});

document.addEventListener("closet-data-changed", Dashboard.schedule);
document.addEventListener("closet-page-changed", Dashboard.schedule);
document.addEventListener("closet-weather-changed", Dashboard.schedule);

// Sign-in reveals Home after account-setup is removed.
const dashboardAccountObserver = new MutationObserver(function () {
  if (!Dashboard.ready()) Dashboard.clear();
  else Dashboard.schedule();
});
dashboardAccountObserver.observe(document.body, {
  attributes: true,
  attributeFilter: ["class"]
});

// If Home stays open past midnight, show the new calendar day.
setInterval(function () {
  if (document.visibilityState === "visible" && Dashboard.ready() &&
      Dashboard.lastDate !== History.today()) Dashboard.schedule();
}, 60000);
