const state = {
  bookingMode: Boolean(window.APP_CONFIG?.bookingMode),
  bookingSlug: window.APP_CONFIG?.bookingSlug || "",
  bootstrap: null,
  calendar: null,
  selectedEventId: null,
  selectedSlotElement: null,
  selectedEventTypes: [],
  availableFilterEventTypes: [],
};

const BUSINESS_DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"];
const DEFAULT_BUSINESS_HOURS_WEEK = {
  "0": { start: "07:00", end: "16:00", enabled: true },
  "1": { start: "10:00", end: "19:00", enabled: true },
  "2": { start: "10:00", end: "19:00", enabled: true },
  "3": { start: "10:00", end: "19:00", enabled: true },
  "4": { start: "07:00", end: "16:00", enabled: true },
  "5": { start: "07:00", end: "20:00", enabled: true },
  "6": { start: "07:00", end: "20:00", enabled: true },
};

const elements = {
  profileButton: document.querySelector("#profile-button"),
  adminPanel: document.querySelector("#admin-panel"),
  adminClose: document.querySelector("#admin-close"),
  eventLegend: document.querySelector("#event-legend"),
  eventTypeAdminList: document.querySelector("#event-type-admin-list"),
  coachAdminList: document.querySelector("#coach-admin-list"),
  locationAdminList: document.querySelector("#location-admin-list"),
  calendarAdminList: document.querySelector("#calendar-admin-list"),
  eventTypeForm: document.querySelector("#event-type-form"),
  eventTypeName: document.querySelector("#event-type-name"),
  calendarForm: document.querySelector("#calendar-form"),
  calendarName: document.querySelector("#calendar-name"),
  businessHoursForm: document.querySelector("#business-hours-form"),
  businessHourInputs: document.querySelectorAll("[data-business-day][data-business-bound]"),
  locationForm: document.querySelector("#location-form"),
  locationName: document.querySelector("#location-name"),
  coachForm: document.querySelector("#coach-form"),
  coachName: document.querySelector("#coach-name"),
  calendarFilterSelect: document.querySelector("#calendar-filter-select"),
  eventTypeFilterButton: document.querySelector("#event-type-filter-button"),
  eventTypeFilterMenu: document.querySelector("#event-type-filter-menu"),
  eventTypeFilterOptions: document.querySelector("#event-type-filter-options"),
  eventTypeFilterAll: document.querySelector("#event-type-filter-all"),
  eventForm: document.querySelector("#event-form"),
  formErrors: document.querySelector("#form-errors"),
  formWarnings: document.querySelector("#form-warnings"),
  deleteButton: document.querySelector("#delete-button"),
  duplicateButton: document.querySelector("#duplicate-button"),
  duplicateModal: document.querySelector("#duplicate-modal"),
  duplicateStartAt: document.querySelector("#duplicate-start-at"),
  duplicateCancel: document.querySelector("#duplicate-cancel"),
  duplicateConfirm: document.querySelector("#duplicate-confirm"),
  refreshCoverage: document.querySelector("#refresh-coverage"),
  eventCoverageResults: document.querySelector("#event-coverage-results"),
  coveragePanel: document.querySelector("#coverage-panel"),
  coverageResults: document.querySelector("#coverage-results"),
  coverageDate: document.querySelector("#coverage-date"),
  calendar: document.querySelector("#calendar"),
  slotList: document.querySelector("#slot-list"),
  bookingForm: document.querySelector("#booking-form"),
  bookingErrors: document.querySelector("#booking-errors"),
  bookingWarnings: document.querySelector("#booking-warnings"),
  bookingSuccess: document.querySelector("#booking-success"),
  newEventButton: document.querySelector("#new-event-button"),
  themeToggle: document.querySelector("#theme-toggle"),
};

state.selectedCalendarIds = [];

function showMessage(element, lines) {
  if (!element) {
    return;
  }
  if (!lines || !lines.length) {
    element.classList.add("hidden");
    element.textContent = "";
    return;
  }
  element.classList.remove("hidden");
  element.innerHTML = lines.map((line) => `<div>${line}</div>`).join("");
}

function isoLocal(value) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function displayDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const payload = await response.json();
  if (!response.ok) {
    throw payload;
  }
  return payload;
}

function populateSelect(select, items, formatter, includeBlank = false) {
  if (!select) {
    return;
  }
  const blank = includeBlank ? '<option value="">None</option>' : "";
  select.innerHTML =
    blank + items.map((item) => `<option value="${item.id}">${formatter(item)}</option>`).join("");
}

function populateBootstrap() {
  const coaches = state.bootstrap.users.filter((item) => item.role === "Coach");
  const locations = state.bootstrap.locations;
  const eventTypes = state.bootstrap.eventTypes;
  const calendars = state.bootstrap.calendars || [];
  const knownCalendarIds = new Set(calendars.map((calendar) => calendar.id));
  state.selectedCalendarIds = state.selectedCalendarIds.filter((calendarId) => knownCalendarIds.has(calendarId));

  if (elements.calendarFilterSelect) {
    const selectedCalendarId = state.selectedCalendarIds[0] || "";
    elements.calendarFilterSelect.innerHTML = [
      '<option value="">All calendars</option>',
      ...calendars.map((calendar) => `<option value="${calendar.id}">${calendar.name}</option>`),
    ].join("");
    elements.calendarFilterSelect.value = selectedCalendarId;
  }

  syncEventTypeFilterLabel();

  populateSelect(document.querySelector("#assigned-coach"), coaches, (coach) => coach.name);
  populateSelect(document.querySelector("#calendar-id"), calendars, (calendar) => calendar.name);
  populateSelect(document.querySelector("#location-id"), locations, (location) => location.building_name);

  const eventTypeSelect = document.querySelector("#event-type");
  if (eventTypeSelect) {
    eventTypeSelect.innerHTML = eventTypes
      .map((type) => `<option value="${type.name}">${type.name}</option>`)
      .join("");
  }

  const bookingEventType = document.querySelector("#booking-event-type");
  if (bookingEventType) {
    bookingEventType.innerHTML = eventTypes
      .map((type) => `<option value="${type.name}">${type.name}</option>`)
      .join("");
  }

  renderEventLegend();
  renderEventTypeAdminList();
  renderCoachAdminList();
  renderLocationAdminList();
  renderCalendarAdminList();

  hydrateBusinessHourInputs();
}

function showWeekendsEnabled() {
  return Boolean(state.bootstrap?.settings?.showWeekends);
}

function syncWeekendsToggleButton() {
  const buttons = document.querySelectorAll(".fc-weekendsToggle-button");
  if (!buttons.length) {
    return;
  }
  const enabled = showWeekendsEnabled();
  buttons.forEach((button) => {
    button.classList.toggle("is-checked", enabled);
    button.setAttribute("aria-pressed", enabled ? "true" : "false");
  });
}

function normalizeBusinessHoursWeek(rawWeek) {
  const week = { ...DEFAULT_BUSINESS_HOURS_WEEK };
  const source = rawWeek || {};
  for (const day of BUSINESS_DAY_KEYS) {
    const sourceRow = source[day] || {};
    week[day] = {
      start: sourceRow.start || week[day].start,
      end: sourceRow.end || week[day].end,
      enabled: typeof sourceRow.enabled === "boolean" ? sourceRow.enabled : week[day].enabled,
    };
  }
  return week;
}

function timeToMinutes(value) {
  const [hourRaw, minuteRaw] = (value || "00:00").split(":");
  const hours = Number(hourRaw) || 0;
  const minutes = Number(minuteRaw) || 0;
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const clamped = Math.max(0, Math.min(24 * 60, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function computeBusinessSlotRange(week) {
  const enabledDays = BUSINESS_DAY_KEYS.filter((day) => week[day]?.enabled);
  const starts = enabledDays.map((day) => timeToMinutes(week[day]?.start)).filter((value) => Number.isFinite(value));
  const ends = enabledDays.map((day) => timeToMinutes(week[day]?.end)).filter((value) => Number.isFinite(value));
  const earliest = starts.length ? Math.min(...starts) : timeToMinutes("06:00");
  const latest = ends.length ? Math.max(...ends) : timeToMinutes("21:00");
  const start = minutesToTime(earliest - 60);
  const end = minutesToTime(latest + 60);
  return { start, end };
}

function buildCalendarBusinessHours(week) {
  return BUSINESS_DAY_KEYS
    .filter((day) => week[day]?.enabled)
    .map((day) => ({
      // Backend stores weekdays as Python style (Mon=0..Sun=6),
      // while FullCalendar expects (Sun=0..Sat=6).
      daysOfWeek: [(Number(day) + 1) % 7],
      startTime: week[day].start,
      endTime: week[day].end,
    }));
}

function syncBusinessDayInputs(day) {
  const toggle = document.querySelector(`[data-business-day="${day}"][data-business-bound="enabled"]`);
  const startInput = document.querySelector(`[data-business-day="${day}"][data-business-bound="start"]`);
  const endInput = document.querySelector(`[data-business-day="${day}"][data-business-bound="end"]`);
  if (!toggle || !startInput || !endInput) {
    return;
  }
  const enabled = toggle.checked;
  startInput.disabled = !enabled;
  endInput.disabled = !enabled;
}

function hydrateBusinessHourInputs() {
  const week = normalizeBusinessHoursWeek(state.bootstrap?.settings?.businessHoursWeek);
  elements.businessHourInputs?.forEach((input) => {
    const day = input.dataset.businessDay;
    const bound = input.dataset.businessBound;
    if (bound === "enabled") {
      input.checked = Boolean(week[day]?.enabled);
      return;
    }
    input.value = week[day]?.[bound] || DEFAULT_BUSINESS_HOURS_WEEK[day][bound];
  });
  for (const day of BUSINESS_DAY_KEYS) {
    syncBusinessDayInputs(day);
  }
}

function collectBusinessHourInputs() {
  const week = normalizeBusinessHoursWeek({});
  elements.businessHourInputs?.forEach((input) => {
    const day = input.dataset.businessDay;
    const bound = input.dataset.businessBound;
    if (!day || !bound) {
      return;
    }
    week[day] = week[day] || { ...DEFAULT_BUSINESS_HOURS_WEEK[day] };
    if (bound === "enabled") {
      week[day].enabled = Boolean(input.checked);
      return;
    }
    week[day][bound] = input.value || week[day][bound];
  });
  return week;
}

function renderEventLegend() {
  if (!elements.eventLegend) {
    return;
  }
  const eventTypes = state.bootstrap?.eventTypes || [];
  elements.eventLegend.innerHTML = eventTypes
    .map(
      (type) =>
        `<span><i class="dot" style="background:${type.color}"></i>${type.name}</span>`
    )
    .join("");
}

function renderEventTypeAdminList() {
  if (!elements.eventTypeAdminList) {
    return;
  }
  const eventTypes = state.bootstrap?.eventTypes || [];
  elements.eventTypeAdminList.innerHTML = eventTypes
    .map(
      (type) => `
        <div class="admin-list-row admin-event-type-row">
          <input class="admin-event-type-name admin-editable-name" type="text" value="${type.name}" data-event-type-id="${type.id}" data-event-type-field="name" />
          <input type="color" value="${type.color}" data-event-type-id="${type.id}" data-event-type-field="color" />
          <button class="ghost-button admin-delete-button" type="button" data-delete-event-type-id="${type.id}">Delete</button>
        </div>
      `
    )
    .join("");
}

function renderCoachAdminList() {
  if (!elements.coachAdminList) {
    return;
  }
  const coaches = (state.bootstrap?.users || []).filter((item) => item.role === "Coach");
  elements.coachAdminList.innerHTML = coaches
    .map(
      (coach) => `
        <div class="admin-list-row">
          <input class="admin-editable-name" type="text" value="${coach.name}" data-coach-id="${coach.id}" />
          <button class="ghost-button admin-delete-button" type="button" data-delete-coach-id="${coach.id}">Delete</button>
        </div>
      `
    )
    .join("");
}

function renderLocationAdminList() {
  if (!elements.locationAdminList) {
    return;
  }
  const locations = state.bootstrap?.locations || [];
  elements.locationAdminList.innerHTML = locations
    .map(
      (location) => `
        <div class="admin-list-row">
          <input class="admin-editable-name" type="text" value="${location.building_name}" data-location-id="${location.id}" />
          <button class="ghost-button admin-delete-button" type="button" data-delete-location-id="${location.id}">Delete</button>
        </div>
      `
    )
    .join("");
}

function renderCalendarAdminList() {
  if (!elements.calendarAdminList) {
    return;
  }
  const calendars = state.bootstrap?.calendars || [];
  elements.calendarAdminList.innerHTML = calendars
    .map(
      (calendar) => `
        <div class="admin-list-row">
          <input class="admin-editable-name" type="text" value="${calendar.name}" data-calendar-id="${calendar.id}" />
          <button class="ghost-button admin-delete-button" type="button" data-delete-calendar-id="${calendar.id}">Delete</button>
        </div>
      `
    )
    .join("");
}

async function deleteEventType(event) {
  const button = event.target.closest("[data-delete-event-type-id]");
  if (!button) {
    return;
  }
  const eventTypeId = button.dataset.deleteEventTypeId;
  if (!confirm("Delete this event type?")) {
    return;
  }
  try {
    const payload = await requestJson(`/api/admin/event-types/${eventTypeId}`, {
      method: "DELETE",
    });
    state.bootstrap.eventTypes = payload.eventTypes;
    populateBootstrap();
    state.calendar?.refetchEvents();
    if (payload.warnings?.length) {
      alert(payload.warnings.join("\n"));
    }
  } catch (error) {
    alert((error?.errors || ["Unable to delete event type."]).join("\n"));
  }
}

async function deleteCoach(event) {
  const button = event.target.closest("[data-delete-coach-id]");
  if (!button) {
    return;
  }
  const coachId = button.dataset.deleteCoachId;
  if (!confirm("Delete this coach?")) {
    return;
  }
  try {
    const payload = await requestJson(`/api/admin/coaches/${coachId}`, {
      method: "DELETE",
    });
    state.bootstrap.users = payload.users;
    populateBootstrap();
    if (payload.warnings?.length) {
      alert(payload.warnings.join("\n"));
    }
  } catch (error) {
    alert((error?.errors || ["Unable to delete coach."]).join("\n"));
  }
}

async function deleteLocation(event) {
  const button = event.target.closest("[data-delete-location-id]");
  if (!button) {
    return;
  }
  const locationId = button.dataset.deleteLocationId;
  if (!confirm("Delete this location?")) {
    return;
  }
  try {
    const payload = await requestJson(`/api/admin/locations/${locationId}`, {
      method: "DELETE",
    });
    state.bootstrap.locations = payload.locations;
    populateBootstrap();
    if (payload.warnings?.length) {
      alert(payload.warnings.join("\n"));
    }
  } catch (error) {
    alert((error?.errors || ["Unable to delete location."]).join("\n"));
  }
}

function currentCoachFilter() {
  return state.selectedCalendarIds[0] || "";
}

function currentCalendarIds() {
  return [...state.selectedCalendarIds];
}

function currentEventTypeFilters() {
  return [...state.selectedEventTypes];
}

function currentSelectedCalendarId() {
  return state.selectedCalendarIds.length === 1 ? state.selectedCalendarIds[0] : "";
}

function currentAssignedCoachId() {
  return "";
}

async function handleCalendarSelectChange(event) {
  const selectedId = event.target.value || "";
  state.selectedCalendarIds = selectedId ? [selectedId] : [];
  await refreshEventTypeFilterOptions();
  state.calendar?.refetchEvents();
}

function syncEventTypeFilterLabel() {
  if (!elements.eventTypeFilterButton) {
    return;
  }
  if (!state.selectedEventTypes.length) {
    elements.eventTypeFilterButton.setAttribute("aria-label", "All classes/types");
    elements.eventTypeFilterButton.setAttribute("title", "All classes/types");
    return;
  }
  const label =
    state.selectedEventTypes.length <= 2
      ? state.selectedEventTypes.join(", ")
      : `${state.selectedEventTypes.length} classes/types selected`;
  elements.eventTypeFilterButton.setAttribute("aria-label", label);
  elements.eventTypeFilterButton.setAttribute("title", label);
}

function closeEventTypeFilterMenu() {
  elements.eventTypeFilterMenu?.classList.add("hidden");
  elements.eventTypeFilterButton?.setAttribute("aria-expanded", "false");
}

async function openEventTypeFilterMenu() {
  await refreshEventTypeFilterOptions();
  elements.eventTypeFilterMenu?.classList.remove("hidden");
  elements.eventTypeFilterButton?.setAttribute("aria-expanded", "true");
}

function toggleEventTypeFilterMenu() {
  if (elements.eventTypeFilterMenu?.classList.contains("hidden")) {
    void openEventTypeFilterMenu();
  } else {
    closeEventTypeFilterMenu();
  }
}

function renderEventTypeFilterOptions() {
  if (!elements.eventTypeFilterOptions) {
    return;
  }
  const selected = new Set(state.selectedEventTypes);
  elements.eventTypeFilterOptions.innerHTML = state.availableFilterEventTypes
    .map(
      (type) => `
        <label class="filter-option">
          <span>${type.name}</span>
          <input type="checkbox" value="${type.name}" data-event-type-checkbox ${
            selected.has(type.name) ? "checked" : ""
          } />
        </label>
      `
    )
    .join("");
}

async function refreshEventTypeFilterOptions() {
  if (!elements.eventTypeFilterOptions) {
    return;
  }

  const params = new URLSearchParams();
  const calendarIds = currentCalendarIds();
  for (const calendarId of calendarIds) {
    params.append("calendar_id", calendarId);
  }

  try {
    const url = params.toString() ? `/api/event-type-options?${params.toString()}` : "/api/event-type-options";
    const payload = await requestJson(url);
    state.availableFilterEventTypes = payload.eventTypes || [];
  } catch (_error) {
    state.availableFilterEventTypes = state.bootstrap?.eventTypes || [];
  }

  const names = new Set(state.availableFilterEventTypes.map((item) => item.name));
  state.selectedEventTypes = state.selectedEventTypes.filter((name) => names.has(name));

  if (elements.eventTypeFilterAll) {
    elements.eventTypeFilterAll.checked = state.selectedEventTypes.length === 0;
  }
  renderEventTypeFilterOptions();
  syncEventTypeFilterLabel();
}

function applyEventTypeFilterSelection() {
  state.selectedEventTypes = Array.from(document.querySelectorAll("[data-event-type-checkbox]:checked")).map(
    (checkbox) => checkbox.value
  );
  if (elements.eventTypeFilterAll) {
    elements.eventTypeFilterAll.checked = state.selectedEventTypes.length === 0;
  }
  syncEventTypeFilterLabel();
  state.calendar?.refetchEvents();
}

function handleEventTypeAllToggle() {
  if (!elements.eventTypeFilterAll?.checked) {
    elements.eventTypeFilterAll.checked = true;
  }
  document.querySelectorAll("[data-event-type-checkbox]").forEach((checkbox) => {
    checkbox.checked = false;
  });
  applyEventTypeFilterSelection();
}

function handleEventTypeCheckboxToggle(event) {
  if (!event.target.matches("[data-event-type-checkbox]")) {
    return;
  }
  if (elements.eventTypeFilterAll) {
    elements.eventTypeFilterAll.checked = false;
  }
  applyEventTypeFilterSelection();
}

function handleAddCalendar() {
  if (!elements.adminPanel) {
    return;
  }
  elements.adminPanel.classList.remove("hidden");
  elements.adminPanel.setAttribute("aria-hidden", "false");
  const collapsible = document.querySelector("#calendars-collapsible");
  if (collapsible && !collapsible.open) {
    collapsible.open = true;
  }
  elements.calendarName?.focus();
}

function toggleAdminPanel() {
  if (!elements.adminPanel) {
    return;
  }
  const isHidden = elements.adminPanel.classList.toggle("hidden");
  elements.adminPanel.setAttribute("aria-hidden", isHidden ? "true" : "false");
}

function closeAdminPanel() {
  if (!elements.adminPanel) {
    return;
  }
  elements.adminPanel.classList.add("hidden");
  elements.adminPanel.setAttribute("aria-hidden", "true");
}

async function saveEventTypeColor(event) {
  const input = event.target;
  if (!input.matches("[data-event-type-id]")) {
    return;
  }
  const eventTypeId = input.dataset.eventTypeId;
  const row = input.closest(".admin-list-row");
  const nameInput = row?.querySelector('[data-event-type-field="name"]');
  const colorInput = row?.querySelector('[data-event-type-field="color"]');
  const name = nameInput?.value?.trim();
  const color = colorInput?.value;
  const payloadBody = {};
  if (name) {
    payloadBody.name = name;
  }
  if (color) {
    payloadBody.color = color;
  }
  const payload = await requestJson(`/api/admin/event-types/${eventTypeId}`, {
    method: "PATCH",
    body: JSON.stringify(payloadBody),
  });
  state.bootstrap.eventTypes = payload.eventTypes;
  renderEventLegend();
  populateBootstrap();
  state.calendar?.refetchEvents();
}

async function saveCoachName(event) {
  const input = event.target;
  if (!input.matches("[data-coach-id]")) {
    return;
  }
  const name = input.value?.trim();
  if (!name) {
    populateBootstrap();
    return;
  }
  const coachId = input.dataset.coachId;
  const payload = await requestJson(`/api/admin/coaches/${coachId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  state.bootstrap.users = payload.users;
  populateBootstrap();
}

async function saveLocationName(event) {
  const input = event.target;
  if (!input.matches("[data-location-id]")) {
    return;
  }
  const building_name = input.value?.trim();
  if (!building_name) {
    populateBootstrap();
    return;
  }
  const locationId = input.dataset.locationId;
  const payload = await requestJson(`/api/admin/locations/${locationId}`, {
    method: "PATCH",
    body: JSON.stringify({ building_name }),
  });
  state.bootstrap.locations = payload.locations;
  populateBootstrap();
}

async function saveCalendarName(event) {
  const input = event.target;
  if (!input.matches("[data-calendar-id]")) {
    return;
  }
  const name = input.value?.trim();
  if (!name) {
    populateBootstrap();
    return;
  }
  const calendarId = input.dataset.calendarId;
  const payload = await requestJson(`/api/admin/calendars/${calendarId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
  state.bootstrap.calendars = payload.calendars;
  populateBootstrap();
}

async function createCalendar(event) {
  event.preventDefault();
  const payload = await requestJson("/api/admin/calendars", {
    method: "POST",
    body: JSON.stringify({
      name: elements.calendarName?.value,
    }),
  });
  state.bootstrap.calendars = payload.calendars;
  elements.calendarForm?.reset();
  populateBootstrap();
}

async function deleteCalendar(event) {
  const button = event.target.closest("[data-delete-calendar-id]");
  if (!button) {
    return;
  }
  const calendarId = button.dataset.deleteCalendarId;
  if (!confirm("Delete this calendar?")) {
    return;
  }
  try {
    const payload = await requestJson(`/api/admin/calendars/${calendarId}`, {
      method: "DELETE",
    });
    state.bootstrap.calendars = payload.calendars;
    populateBootstrap();
    state.calendar?.refetchEvents();
    if (payload.warnings?.length) {
      alert(payload.warnings.join("\n"));
    }
  } catch (error) {
    alert((error?.errors || ["Unable to delete calendar."]).join("\n"));
  }
}

async function createEventType(event) {
  event.preventDefault();
  const payload = await requestJson("/api/admin/event-types", {
    method: "POST",
    body: JSON.stringify({
      name: elements.eventTypeName?.value,
    }),
  });
  state.bootstrap.eventTypes = payload.eventTypes;
  elements.eventTypeForm?.reset();
  populateBootstrap();
  state.calendar?.refetchEvents();
}

async function saveBusinessHours(event) {
  event.preventDefault();
  const hoursByDay = collectBusinessHourInputs();
  const payload = await requestJson("/api/admin/settings/business-hours", {
    method: "PATCH",
    body: JSON.stringify({
      hoursByDay,
    }),
  });
  const paddedSlotRange = computeBusinessSlotRange(payload.businessHoursWeek);
  state.bootstrap.settings = state.bootstrap.settings || {};
  state.bootstrap.settings.businessHoursWeek = payload.businessHoursWeek;
  state.bootstrap.settings.businessHours = paddedSlotRange;
  state.calendar?.setOption("slotMinTime", `${paddedSlotRange.start}:00`);
  state.calendar?.setOption("slotMaxTime", `${paddedSlotRange.end}:00`);
  state.calendar?.setOption("businessHours", buildCalendarBusinessHours(payload.businessHoursWeek));
}

async function saveShowWeekends(showWeekends) {
  const payload = await requestJson("/api/admin/settings/weekends", {
    method: "PATCH",
    body: JSON.stringify({
      showWeekends,
    }),
  });
  state.bootstrap.settings = state.bootstrap.settings || {};
  state.bootstrap.settings.showWeekends = Boolean(payload.showWeekends);
  state.calendar?.setOption("weekends", Boolean(payload.showWeekends));
  syncWeekendsToggleButton();
}

async function toggleShowWeekends() {
  await saveShowWeekends(!showWeekendsEnabled());
}

async function createLocation(event) {
  event.preventDefault();
  const payload = await requestJson("/api/admin/locations", {
    method: "POST",
    body: JSON.stringify({
      building_name: elements.locationName?.value,
    }),
  });
  state.bootstrap.locations = payload.locations;
  elements.locationForm?.reset();
  populateBootstrap();
}

async function createCoach(event) {
  event.preventDefault();
  const payload = await requestJson("/api/admin/coaches", {
    method: "POST",
    body: JSON.stringify({
      name: elements.coachName?.value,
    }),
  });
  state.bootstrap.users = payload.users;
  elements.coachForm?.reset();
  populateBootstrap();
}

function clearEventForm() {
  if (!elements.eventForm) {
    return;
  }
  elements.eventForm.reset();
  document.querySelector("#event-id").value = "";
  document.querySelector("#client-count").value = 1;
  document.querySelector("#capacity-limit").value = 1;
  document.querySelector("#repeat-weeks").value = 1;
  const selectedCalendarId = currentSelectedCalendarId();
  if (selectedCalendarId) {
    document.querySelector("#calendar-id").value = selectedCalendarId;
  }
  showMessage(elements.formErrors);
  showMessage(elements.formWarnings);
  state.selectedEventId = null;
  if (elements.eventCoverageResults) {
    elements.eventCoverageResults.classList.add("empty-state");
    elements.eventCoverageResults.textContent = "Select an event to see substitute options.";
  }
}

function fillEventForm(event) {
  const props = event.extendedProps;
  document.querySelector("#event-id").value = event.id;
  document.querySelector("#title").value = event.title;
  document.querySelector("#event-type").value = props.eventType;
  document.querySelector("#calendar-id").value = props.calendarId || "";
  document.querySelector("#assigned-coach").value = props.coachId;
  document.querySelector("#location-id").value = props.locationId;
  document.querySelector("#start-at").value = isoLocal(event.start);
  document.querySelector("#end-at").value = isoLocal(event.end);
  document.querySelector("#client-name").value = props.clientName || "";
  document.querySelector("#client-count").value = props.clientCount || 1;
  document.querySelector("#capacity-limit").value = props.capacityLimit || 1;
  document.querySelector("#status").value = props.status;
  document.querySelector("#recurrence").value = props.seriesId ? "weekly" : "none";
  document.querySelector("#repeat-weeks").value = 1;
  state.selectedEventId = event.id;
}

async function refreshCoverageForEvent(eventId) {
  if (!elements.eventCoverageResults || !eventId) {
    return;
  }
  const rows = await requestJson(`/api/coverage?event_id=${eventId}`);
  elements.eventCoverageResults.classList.remove("empty-state");
  elements.eventCoverageResults.innerHTML = rows
    .map(
      (row) => `
        <article class="coverage-item">
          <strong>${row.coachName}</strong>
          <span class="${row.available ? "available-tag" : "blocked-tag"}">${row.available ? "Available" : "Blocked"}</span>
          <div>${row.reasons.length ? row.reasons.join(" · ") : "No conflicts"}</div>
        </article>
      `
    )
    .join("");
}

async function refreshCoverageMatrix() {
  if (!elements.coverageResults || !elements.coverageDate?.value) {
    return;
  }
  const startAt = `${elements.coverageDate.value}T09:00`;
  const endAt = `${elements.coverageDate.value}T10:00`;
  const rows = await requestJson(`/api/coverage?start_at=${encodeURIComponent(startAt)}&end_at=${encodeURIComponent(endAt)}`);
  elements.coverageResults.innerHTML = rows
    .map(
      (row) => `
        <article>
          <strong>${row.coachName}</strong>
          <span class="${row.available ? "available-tag" : "blocked-tag"}">${row.available ? "Available" : "Blocked"}</span>
          <p>${row.reasons.length ? row.reasons.join(" · ") : "Open inside shift and travel-safe."}</p>
        </article>
      `
    )
    .join("");
}

function collectFormData() {
  return {
    title: document.querySelector("#title").value,
    event_type: document.querySelector("#event-type").value,
    calendar_id: document.querySelector("#calendar-id").value,
    assigned_coach_id: document.querySelector("#assigned-coach").value,
    location_id: document.querySelector("#location-id").value,
    start_at: document.querySelector("#start-at").value,
    end_at: document.querySelector("#end-at").value,
    client_name: document.querySelector("#client-name").value,
    client_count: Number(document.querySelector("#client-count").value),
    capacity_limit: Number(document.querySelector("#capacity-limit").value),
    status: document.querySelector("#status").value,
    recurrence: document.querySelector("#recurrence").value,
    repeat_weeks: Number(document.querySelector("#repeat-weeks").value),
  };
}

function formatDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function openDuplicateModal(defaultStartAt) {
  if (!elements.duplicateModal || !elements.duplicateStartAt) {
    return;
  }
  elements.duplicateStartAt.value = defaultStartAt;
  elements.duplicateModal.classList.remove("hidden");
}

function closeDuplicateModal() {
  elements.duplicateModal?.classList.add("hidden");
}

async function duplicateEvent() {
  const formData = collectFormData();
  if (!formData.start_at || !formData.end_at) {
    showMessage(elements.formErrors, ["Set a valid start and end time before duplicating."]);
    return;
  }

  const startDate = new Date(formData.start_at);
  const endDate = new Date(formData.end_at);
  const durationMs = endDate.getTime() - startDate.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    showMessage(elements.formErrors, ["Cannot duplicate: event duration is invalid."]);
    return;
  }

  openDuplicateModal(formData.start_at);
}

async function confirmDuplicateEvent() {
  const formData = collectFormData();
  if (!formData.start_at || !formData.end_at) {
    showMessage(elements.formErrors, ["Set a valid start and end time before duplicating."]);
    return;
  }

  const startDate = new Date(formData.start_at);
  const endDate = new Date(formData.end_at);
  const durationMs = endDate.getTime() - startDate.getTime();
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    showMessage(elements.formErrors, ["Cannot duplicate: event duration is invalid."]);
    return;
  }

  const nextStartInput = elements.duplicateStartAt?.value;
  if (!nextStartInput) {
    showMessage(elements.formErrors, ["Choose a duplicate start date/time."]);
    return;
  }

  const nextStart = new Date(nextStartInput);
  if (!Number.isFinite(nextStart.getTime())) {
    showMessage(elements.formErrors, ["Invalid date/time format. Use YYYY-MM-DDTHH:MM."]);
    return;
  }

  const nextEnd = new Date(nextStart.getTime() + durationMs);
  const payload = {
    ...formData,
    start_at: formatDateTimeLocal(nextStart),
    end_at: formatDateTimeLocal(nextEnd),
  };

  try {
    const response = await requestJson("/api/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    closeDuplicateModal();
    showMessage(elements.formErrors);
    showMessage(elements.formWarnings, response.warnings);
    state.calendar?.refetchEvents();
    document.querySelector("#start-at").value = payload.start_at;
    document.querySelector("#end-at").value = payload.end_at;
    document.querySelector("#event-id").value = "";
  } catch (error) {
    showMessage(elements.formErrors, error.errors || ["Unable to duplicate event."]);
    showMessage(elements.formWarnings, error.warnings);
  }
}

async function saveEvent(event) {
  event.preventDefault();
  const eventId = document.querySelector("#event-id").value;
  const method = eventId ? "PATCH" : "POST";
  const url = eventId ? `/api/events/${eventId}` : "/api/events";

  try {
    const payload = await requestJson(url, {
      method,
      body: JSON.stringify(collectFormData()),
    });
    showMessage(elements.formErrors);
    showMessage(elements.formWarnings, payload.warnings);
    state.calendar.refetchEvents();
    if (!eventId) {
      clearEventForm();
    } else {
      refreshCoverageForEvent(eventId);
    }
  } catch (error) {
    showMessage(elements.formErrors, error.errors || ["Unable to save event."]);
    showMessage(elements.formWarnings, error.warnings);
  }
}

async function deleteEvent() {
  const eventId = document.querySelector("#event-id").value;
  if (!eventId) {
    return;
  }
  await requestJson(`/api/events/${eventId}`, { method: "DELETE" });
  clearEventForm();
  state.calendar.refetchEvents();
}

async function updateEventTiming(info) {
  const event = info.event;
  try {
    await requestJson(`/api/events/${event.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        start_at: isoLocal(event.start),
        end_at: isoLocal(event.end),
        calendar_id: event.extendedProps.calendarId,
        location_id: event.extendedProps.locationId,
        assigned_coach_id: event.extendedProps.coachId,
      }),
    });
    showMessage(elements.formErrors);
    state.calendar.refetchEvents();
  } catch (error) {
    info.revert();
    showMessage(elements.formErrors, error.errors || ["Unable to move event."]);
    showMessage(elements.formWarnings, error.warnings);
  }
}

function selectRange(info) {
  if (!elements.eventForm) {
    return;
  }
  clearEventForm();
  document.querySelector("#title").value = "New Session";
  document.querySelector("#start-at").value = info.startStr.slice(0, 16);
  document.querySelector("#end-at").value = info.endStr.slice(0, 16);
  const coachId = currentAssignedCoachId();
  if (coachId) {
    document.querySelector("#assigned-coach").value = coachId;
  }
  const selectedCalendarId = currentSelectedCalendarId();
  if (selectedCalendarId) {
    document.querySelector("#calendar-id").value = selectedCalendarId;
  }
}

function handleEventClick(info) {
  if (state.bookingMode) {
    return;
  }
  const kind = info.event.extendedProps.kind;
  if (kind === "scheduled") {
    fillEventForm(info.event);
    refreshCoverageForEvent(info.event.id);
    return;
  }
  if (kind === "floating") {
    clearEventForm();
    document.querySelector("#title").value = info.event.title;
    document.querySelector("#event-type").value = info.event.extendedProps.eventType || info.event.title;
    document.querySelector("#calendar-id").value = info.event.extendedProps.calendarId || currentSelectedCalendarId();
    document.querySelector("#assigned-coach").value = info.event.extendedProps.coachId || "";
    document.querySelector("#location-id").value = info.event.extendedProps.locationId || "";
    document.querySelector("#start-at").value = isoLocal(info.event.start);
    document.querySelector("#end-at").value = isoLocal(info.event.end);
    document.querySelector("#status").value = "Scheduled";
    showMessage(elements.formWarnings, ["Save to turn this placeholder block into a normal editable event."]);
  }
}

function isInlineShortEvent(event) {
  if (!event?.start || !event?.end) {
    return false;
  }
  const durationMs = event.end.getTime() - event.start.getTime();
  return Number.isFinite(durationMs) && durationMs > 0 && durationMs <= 30 * 60 * 1000;
}

function renderCalendar() {
  const businessHoursWeek = normalizeBusinessHoursWeek(state.bootstrap?.settings?.businessHoursWeek);
  const businessSlotRange = computeBusinessSlotRange(businessHoursWeek);
  state.calendar = new FullCalendar.Calendar(elements.calendar, {
    initialView: "timeGridWeek",
    height: "auto",
    firstDay: 1,
    allDaySlot: false,
    weekends: showWeekendsEnabled(),
    selectable: !state.bookingMode,
    editable: !state.bookingMode,
    eventResizableFromStart: !state.bookingMode,
    slotMinTime: `${businessSlotRange.start}:00`,
    slotMaxTime: `${businessSlotRange.end}:00`,
    businessHours: buildCalendarBusinessHours(businessHoursWeek),
    nowIndicator: true,
    customButtons: {
      weekendsToggle: {
        text: "Sat/Sun",
        click() {
          void toggleShowWeekends();
        },
      },
    },
    headerToolbar: {
      left: "prev,next today",
      center: "title",
      right: "weekendsToggle,timeGridWeek,dayGridMonth",
    },
    events(fetchInfo, success, failure) {
      const params = new URLSearchParams({
        start: fetchInfo.startStr,
        end: fetchInfo.endStr,
      });
      const calendarIds = currentCalendarIds();
      for (const calendarId of calendarIds) {
        params.append("calendar_id", calendarId);
      }
      const eventTypes = currentEventTypeFilters();
      for (const eventType of eventTypes) {
        params.append("event_type", eventType);
      }
      fetch(`/api/events?${params.toString()}`)
        .then((response) => response.json())
        .then(success)
        .catch(failure);
    },
    select: selectRange,
    eventClick: handleEventClick,
    eventClassNames(arg) {
      if (arg.view?.type?.startsWith("timeGrid") && isInlineShortEvent(arg.event)) {
        return ["event-inline-short"];
      }
      return [];
    },
    eventDrop: updateEventTiming,
    eventResize: updateEventTiming,
    datesSet() {
      syncWeekendsToggleButton();
    },
  });

  state.calendar.render();
  syncWeekendsToggleButton();
}

async function loadBookingSlots() {
  const payload = await requestJson(`/api/book/${state.bookingSlug}/slots`);
  if (!elements.slotList) {
    return;
  }
  elements.slotList.innerHTML = payload.slots
    .map(
      (slot) => `
        <button
          class="slot-button"
          type="button"
          data-start="${slot.start}"
          data-end="${slot.end}"
          data-location-id="${slot.locationId}"
        >
          <strong>${displayDate(slot.start)}</strong>
          <span>${slot.locationName}</span>
        </button>
      `
    )
    .join("");

  elements.slotList.querySelectorAll(".slot-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSlotElement?.classList.remove("is-selected");
      state.selectedSlotElement = button;
      button.classList.add("is-selected");
      document.querySelector("#booking-start").value = button.dataset.start;
      document.querySelector("#booking-end").value = button.dataset.end;
      document.querySelector("#booking-location-id").value = button.dataset.locationId;
    });
  });
}

async function submitBooking(event) {
  event.preventDefault();
  if (!document.querySelector("#booking-start").value) {
    showMessage(elements.bookingErrors, ["Select an open slot before submitting the booking."]);
    showMessage(elements.bookingWarnings);
    showMessage(elements.bookingSuccess);
    return;
  }

  try {
    const payload = await requestJson(`/api/book/${state.bookingSlug}`, {
      method: "POST",
      body: JSON.stringify({
        title: document.querySelector("#booking-title").value,
        event_type: document.querySelector("#booking-event-type").value,
        client_name: document.querySelector("#booking-client-name").value,
        start_at: document.querySelector("#booking-start").value,
        end_at: document.querySelector("#booking-end").value,
        location_id: document.querySelector("#booking-location-id").value,
      }),
    });
    showMessage(elements.bookingErrors);
    showMessage(elements.bookingWarnings, payload.warnings);
    showMessage(elements.bookingSuccess, ["Booking confirmed. The calendar has been updated."]);
    await loadBookingSlots();
    state.calendar.refetchEvents();
  } catch (error) {
    showMessage(elements.bookingErrors, error.errors || ["Unable to create booking."]);
    showMessage(elements.bookingWarnings, error.warnings);
    showMessage(elements.bookingSuccess);
  }
}

async function initializeApp() {
  state.bootstrap = await requestJson("/api/bootstrap");
  populateBootstrap();
  renderCalendar();

  elements.calendarFilterSelect?.addEventListener("change", (event) => {
    void handleCalendarSelectChange(event);
  });
  elements.eventTypeFilterButton?.addEventListener("click", toggleEventTypeFilterMenu);
  elements.eventTypeFilterAll?.addEventListener("change", handleEventTypeAllToggle);
  elements.eventTypeFilterOptions?.addEventListener("change", handleEventTypeCheckboxToggle);
  elements.profileButton?.addEventListener("click", toggleAdminPanel);
  elements.adminClose?.addEventListener("click", closeAdminPanel);
  elements.eventTypeAdminList?.addEventListener("change", saveEventTypeColor);
  elements.eventTypeAdminList?.addEventListener("click", deleteEventType);
  elements.coachAdminList?.addEventListener("change", saveCoachName);
  elements.coachAdminList?.addEventListener("click", deleteCoach);
  elements.locationAdminList?.addEventListener("change", saveLocationName);
  elements.locationAdminList?.addEventListener("click", deleteLocation);
  elements.calendarAdminList?.addEventListener("change", saveCalendarName);
  elements.calendarAdminList?.addEventListener("click", deleteCalendar);
  elements.businessHoursForm?.addEventListener("change", (event) => {
    const target = event.target;
    if (!target.matches('[data-business-bound="enabled"]')) {
      return;
    }
    syncBusinessDayInputs(target.dataset.businessDay);
  });
  elements.eventTypeForm?.addEventListener("submit", createEventType);
  elements.businessHoursForm?.addEventListener("submit", saveBusinessHours);
  elements.locationForm?.addEventListener("submit", createLocation);
  elements.calendarForm?.addEventListener("submit", createCalendar);
  elements.coachForm?.addEventListener("submit", createCoach);
  elements.eventForm?.addEventListener("submit", saveEvent);
  elements.deleteButton?.addEventListener("click", deleteEvent);
  elements.duplicateButton?.addEventListener("click", duplicateEvent);
  elements.duplicateCancel?.addEventListener("click", closeDuplicateModal);
  elements.duplicateConfirm?.addEventListener("click", confirmDuplicateEvent);
  elements.duplicateModal?.addEventListener("click", (event) => {
    if (event.target === elements.duplicateModal) {
      closeDuplicateModal();
    }
  });
  elements.coverageDate?.addEventListener("change", refreshCoverageMatrix);
  elements.newEventButton?.addEventListener("click", clearEventForm);
  elements.bookingForm?.addEventListener("submit", submitBooking);
  elements.themeToggle?.addEventListener("click", toggleTheme);

  if (elements.coverageDate) {
    elements.coverageDate.value = new Date().toISOString().slice(0, 10);
  }

  if (state.bookingMode && state.bookingSlug) {
    await loadBookingSlots();
  }

  document.addEventListener("click", (event) => {
    if (elements.eventTypeFilterMenu && elements.eventTypeFilterButton) {
      const clickingTypeFilter =
        elements.eventTypeFilterMenu.contains(event.target) ||
        elements.eventTypeFilterButton.contains(event.target);
      if (!clickingTypeFilter) {
        closeEventTypeFilterMenu();
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.duplicateModal?.classList.contains("hidden")) {
      closeDuplicateModal();
    }
  });
}

function initializeTheme() {
  const savedTheme = localStorage.getItem("fitshift-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = savedTheme ? savedTheme === "dark" : prefersDark;

  if (isDark) {
    document.body.classList.add("dark-mode");
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle("dark-mode");
  localStorage.setItem("fitshift-theme", isDark ? "dark" : "light");
}

initializeTheme();
initializeApp();