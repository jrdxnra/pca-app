'use client';

import { useEffect, useRef } from 'react';

const ADMIN_HTML = `
<div class="page-shell">
  <section class="planner-header-bar">
    <div class="planner-header-content">
      <div class="planner-header-left">
        <div class="planner-header-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <path d="M16 2v4"></path>
            <path d="M8 2v4"></path>
            <path d="M3 10h18"></path>
          </svg>
        </div>

        <div class="toolbar-filters">
          <div class="calendar-filter">
            <label class="calendar-select-wrap" for="calendar-filter-select">
              <select id="calendar-filter-select" class="calendar-select-control" aria-label="Select calendar">
                <option value="">All calendars</option>
              </select>
            </label>
          </div>

          <div class="calendar-filter">
            <button class="filter-icon-button filter-icon-button-funnel" type="button" id="event-type-filter-button" aria-haspopup="true" aria-expanded="false" aria-label="Open class/type filters" title="Class/type filters">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 6h18"></path>
                <path d="M6 12h12"></path>
                <path d="M10 18h4"></path>
              </svg>
            </button>
            <div class="filter-menu hidden" id="event-type-filter-menu">
              <p class="filter-section-title">Classes and types</p>
              <label class="filter-option filter-option-all">
                <span>All classes/types</span>
                <input id="event-type-filter-all" type="checkbox" checked />
              </label>
              <div id="event-type-filter-options" class="filter-options"></div>
            </div>
          </div>
        </div>

        <div class="planner-header-divider" aria-hidden="true"></div>

        <div class="planner-calendar-controls" id="planner-calendar-controls" aria-label="Calendar controls"></div>

        <div class="planner-week-label" aria-live="polite">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"></rect>
            <path d="M16 2v4"></path>
            <path d="M8 2v4"></path>
            <path d="M3 10h18"></path>
          </svg>
          <span id="planner-week-range">-</span>
        </div>
      </div>

      <div class="planner-header-right">
        <label class="calendar-select-wrap" for="planner-mode-select" title="Planner mode">
          <select id="planner-mode-select" class="calendar-select-control" aria-label="Planner mode">
            <option value="live">Live planner</option>
            <option value="static">Static template</option>
          </select>
        </label>
        <label class="planner-weekends-toggle" for="planner-weekends-toggle-input">
          <span>Sat/Sun</span>
          <input id="planner-weekends-toggle-input" type="checkbox" />
        </label>
        <div class="planner-view-controls" id="planner-view-controls" aria-label="Calendar view controls"></div>
      </div>
    </div>
  </section>

  <main class="layout-grid">
    <section class="calendar-shell card">
      <div id="calendar"></div>

      <section class="coverage-panel card hidden" id="coverage-panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Coverage Matrix</p>
            <h2>Substitute and staffing view</h2>
          </div>
          <div>
            <label for="coverage-date">Date</label>
            <input id="coverage-date" type="date" />
          </div>
        </div>
        <div id="coverage-results" class="coverage-grid"></div>
      </section>
    </section>

    <aside class="card form-shell">
      <div class="panel-header">
        <div>
          <h2>Event editor</h2>
        </div>
        <button class="ghost-button" type="button" id="new-event-button">New event</button>
      </div>

      <div class="message-stack">
        <div id="form-errors" class="message error hidden"></div>
        <div id="form-warnings" class="message warning hidden"></div>
      </div>

      <form id="event-form" class="event-form">
        <input id="event-id" name="event_id" type="hidden" />

        <label>
          Title
          <input id="title" name="title" type="text" required />
        </label>

        <label>
          Event type
          <select id="event-type" name="event_type"></select>
        </label>

        <label>
          Calendar
          <select id="calendar-id" name="calendar_id"></select>
        </label>

        <label>
          Location
          <select id="location-id" name="location_id"></select>
        </label>

        <div class="form-grid two-up">
          <label>
            Start
            <input id="start-at" name="start_at" type="datetime-local" required />
          </label>
          <label>
            End
            <input id="end-at" name="end_at" type="datetime-local" required />
          </label>
        </div>

        <div class="form-grid three-up">
          <label>
            Client name
            <input id="client-name" name="client_name" type="text" />
          </label>
          <label>
            Client count
            <input id="client-count" name="client_count" type="number" min="1" max="12" value="1" />
          </label>
          <label>
            Capacity limit
            <input id="capacity-limit" name="capacity_limit" type="number" min="1" max="12" value="1" />
          </label>
        </div>

        <div class="form-grid three-up">
          <label>
            Status
            <select id="status" name="status">
              <option value="Scheduled">Scheduled</option>
              <option value="Requesting">Requesting</option>
              <option value="Sub-Requested">Sub-Requested</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            Recurrence
            <select id="recurrence" name="recurrence">
              <option value="none">One-time</option>
              <option value="weekly">Weekly</option>
            </select>
          </label>
          <label>
            Repeat weeks
            <input id="repeat-weeks" name="repeat_weeks" type="number" min="1" max="12" value="1" />
          </label>
        </div>

        <div class="button-row">
          <button class="ghost-button" type="button" id="delete-button">Cancel event</button>
          <button class="ghost-button" type="button" id="duplicate-button">Duplicate</button>
          <button class="primary-button" type="submit">Save event</button>
        </div>
      </form>

      <div id="duplicate-modal" class="modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="duplicate-modal-title">
        <div class="modal-card">
          <h3 id="duplicate-modal-title">Duplicate Event</h3>
          <p class="modal-help">Pick the new start date and time. End time will keep the same duration.</p>
          <label>
            New start date/time
            <input id="duplicate-start-at" type="datetime-local" required />
          </label>
          <div class="button-row modal-actions">
            <button class="ghost-button" type="button" id="duplicate-cancel">Cancel</button>
            <button class="primary-button" type="button" id="duplicate-confirm">Duplicate</button>
          </div>
        </div>
      </div>
    </aside>
  </main>
</div>
`;

function loadPlannerScript(src: string, key: string, isReady: () => boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const selector = `script[data-planner-script="${key}"]`;
    let existing = document.querySelector(selector) as HTMLScriptElement | null;

    if (!existing) {
      const baseSrc = src.split('?')[0];
      const bySrc = Array.from(document.querySelectorAll('script[src]')).find((node) => {
        const scriptNode = node as HTMLScriptElement;
        return scriptNode.src.includes(baseSrc);
      }) as HTMLScriptElement | undefined;
      if (bySrc) {
        bySrc.setAttribute('data-planner-script', key);
        existing = bySrc;
      }
    }

    if (existing) {
      if (existing.dataset.loaded === '1' || isReady()) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute('data-planner-script', key);
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = '1';
        resolve();
      },
      { once: true }
    );
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export default function PlannerLegacyShell() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }
    if (!rootRef.current.dataset.rendered) {
      rootRef.current.innerHTML = ADMIN_HTML;
      rootRef.current.dataset.rendered = '1';
    }

    (window as any).APP_CONFIG = { bookingMode: false, bookingSlug: '', apiBase: '/api/planner' };

    let cancelled = false;
    Promise.all([
      loadPlannerScript(
        'https://cdn.jsdelivr.net/npm/fullcalendar@6.1.15/index.global.min.js',
        'fullcalendar',
        () => Boolean((window as any).FullCalendar?.Calendar)
      ),
      loadPlannerScript(
        '/planner/app.js?v=20260506-final14',
        'planner-runtime',
        () => typeof (window as any).__PCA_PLANNER_BOOT__ === 'function'
      ),
    ])
      .then(() => {
        if (cancelled) {
          return;
        }
        const boot = (window as any).__PCA_PLANNER_BOOT__;
        if (typeof boot === 'function') {
          boot();
        }
      })
      .catch((error) => {
        console.error('Planner script loading failed:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <link rel="stylesheet" href="/planner/app.css?v=20260504-9" />

      <div id="planner-root" ref={rootRef} suppressHydrationWarning />
    </>
  );
}
