from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta

from flask import Blueprint, jsonify, render_template, request

from .db import get_db, normalize_id
from .scheduler import (
    coverage_matrix,
    event_occurrences,
    fmt_dt,
    generate_slots,
    list_calendar_events,
    parse_dt,
    validate_event,
)

bp = Blueprint("fitshift", __name__)


DEFAULT_BUSINESS_HOURS_WEEK = {
    "0": {"start": "07:00", "end": "16:00", "enabled": True},
    "1": {"start": "10:00", "end": "19:00", "enabled": True},
    "2": {"start": "10:00", "end": "19:00", "enabled": True},
    "3": {"start": "10:00", "end": "19:00", "enabled": True},
    "4": {"start": "07:00", "end": "16:00", "enabled": True},
    "5": {"start": "07:00", "end": "20:00", "enabled": True},
    "6": {"start": "07:00", "end": "20:00", "enabled": True},
}


def fetch_event_types(db) -> list[dict]:
    return [
        dict(row)
        for row in db.execute(
            "SELECT * FROM event_types WHERE is_active = 1 ORDER BY sort_order, name"
        ).fetchall()
    ]


def fetch_calendars(db) -> list[dict]:
    return [
        dict(row)
        for row in db.execute(
            "SELECT * FROM calendars ORDER BY name"
        ).fetchall()
    ]


def default_calendar_id(db) -> str | None:
    row = db.execute("SELECT id FROM calendars ORDER BY name LIMIT 1").fetchone()
    return row["id"] if row else None


def default_calendar_for_coach(db, coach_id: str) -> str | None:
    row = db.execute(
        """
        SELECT cc.calendar_id
        FROM calendar_coaches cc
        JOIN calendars c ON c.id = cc.calendar_id
        WHERE cc.coach_id = ?
        ORDER BY c.name, cc.calendar_id
        LIMIT 1
        """,
        (coach_id,),
    ).fetchone()
    if row:
        return row["calendar_id"]
    return default_calendar_id(db)


def normalize_business_hours_week(hours_by_day: dict | None) -> dict:
    source = hours_by_day or {}
    normalized = {}
    for day, fallback in DEFAULT_BUSINESS_HOURS_WEEK.items():
        candidate = source.get(day, {}) if isinstance(source, dict) else {}
        normalized[day] = {
            "start": candidate.get("start") or fallback["start"],
            "end": candidate.get("end") or fallback["end"],
            "enabled": bool(candidate.get("enabled", fallback["enabled"])),
        }
    return normalized


def business_slot_range(hours_by_day: dict) -> dict:
    enabled_days = [day for day in DEFAULT_BUSINESS_HOURS_WEEK if hours_by_day[day]["enabled"]]
    if not enabled_days:
        return {"start": "06:00", "end": "21:00"}
    starts = sorted([hours_by_day[day]["start"] for day in enabled_days])
    ends = sorted([hours_by_day[day]["end"] for day in enabled_days])
    return {
        "start": starts[0] if starts else "06:00",
        "end": ends[-1] if ends else "21:00",
    }


def fetch_business_hours(db) -> dict:
    import json

    weekly_row = db.execute("SELECT value FROM settings WHERE key = 'business_hours_weekly'").fetchone()
    if weekly_row:
        try:
            parsed_week = json.loads(weekly_row["value"])
            normalized_week = normalize_business_hours_week(parsed_week)
            return {
                "hoursByDay": normalized_week,
                "slotRange": business_slot_range(normalized_week),
            }
        except Exception:
            pass

    legacy_row = db.execute("SELECT value FROM settings WHERE key = 'business_hours'").fetchone()
    if legacy_row:
        try:
            parsed = json.loads(legacy_row["value"])
            fallback_week = {
                day: {
                    "start": parsed.get("start", "06:00"),
                    "end": parsed.get("end", "21:00"),
                }
                for day in DEFAULT_BUSINESS_HOURS_WEEK
            }
            normalized_week = normalize_business_hours_week(fallback_week)
            return {
                "hoursByDay": normalized_week,
                "slotRange": business_slot_range(normalized_week),
            }
        except Exception:
            pass

    normalized_week = normalize_business_hours_week(DEFAULT_BUSINESS_HOURS_WEEK)
    return {
        "hoursByDay": normalized_week,
        "slotRange": business_slot_range(normalized_week),
    }


def fetch_show_weekends(db) -> bool:
    row = db.execute("SELECT value FROM settings WHERE key = 'show_weekends'").fetchone()
    if row is None:
        return False
    raw_value = str(row["value"]).strip().lower()
    return raw_value in {"1", "true", "yes", "on"}


def fetch_planner_mode(db) -> str:
    row = db.execute("SELECT value FROM settings WHERE key = 'planner_mode'").fetchone()
    if row is None:
        return "live"
    raw_value = str(row["value"]).strip().lower()
    if raw_value not in {"live", "static"}:
        return "live"
    return raw_value


def normalize_payload(raw: dict, existing: dict | None = None) -> dict:
    default_event_type = "In Person Meeting"
    payload = {
        "title": raw.get("title") or (existing or {}).get("title") or "Untitled Session",
        "event_type": raw.get("event_type") or raw.get("eventType") or (existing or {}).get("event_type") or default_event_type,
        "calendar_id": raw.get("calendar_id") or raw.get("calendarId") or (existing or {}).get("calendar_id"),
        "assigned_coach_id": raw.get("assigned_coach_id") or raw.get("assignedCoachId") or (existing or {}).get("assigned_coach_id"),
        "location_id": raw.get("location_id") or raw.get("locationId") or (existing or {}).get("location_id"),
        "start_at": raw.get("start_at") or raw.get("start") or (existing or {}).get("start_at"),
        "end_at": raw.get("end_at") or raw.get("end") or (existing or {}).get("end_at"),
        "client_name": raw.get("client_name") or raw.get("clientName") or (existing or {}).get("client_name") or "",
        "client_count": int(raw.get("client_count") or raw.get("clientCount") or (existing or {}).get("client_count") or 1),
        "capacity_limit": int(raw.get("capacity_limit") or raw.get("capacityLimit") or (existing or {}).get("capacity_limit") or 1),
        "status": raw.get("status") or (existing or {}).get("status") or "Scheduled",
        "recurrence": raw.get("recurrence") or (existing or {}).get("recurrence") or "none",
        "repeat_weeks": int(raw.get("repeat_weeks") or raw.get("repeatWeeks") or 1),
    }
    payload["co_coach_id"] = None
    payload["requires_co_coach"] = 0
    return payload


def write_event(db, event_id: str, payload: dict, series_id: str | None = None) -> None:
    db.execute(
        """
        INSERT INTO events (
            id, title, event_type, calendar_id, assigned_coach_id, co_coach_id, location_id,
            start_at, end_at, client_name, client_count, capacity_limit,
            status, recurrence, series_id, requires_co_coach
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            payload["title"],
            payload["event_type"],
            payload["calendar_id"],
            payload["assigned_coach_id"],
            payload["co_coach_id"],
            payload["location_id"],
            payload["start_at"],
            payload["end_at"],
            payload["client_name"],
            payload["client_count"],
            payload["capacity_limit"],
            payload["status"],
            payload["recurrence"],
            series_id,
            payload["requires_co_coach"],
        ),
    )


@bp.get("/")
def index():
    return render_template("index.html", booking_mode=False, selected_slug=None, coach_name=None)


@bp.get("/book/<slug>")
def book_page(slug: str):
    db = get_db()
    coach = db.execute(
        "SELECT * FROM users WHERE booking_slug = ? AND role = 'Coach'",
        (slug,),
    ).fetchone()
    if coach is None:
        return render_template(
            "index.html",
            booking_mode=True,
            selected_slug=slug,
            coach_name="Unknown Coach",
        ), 404

    return render_template(
        "index.html",
        booking_mode=True,
        selected_slug=slug,
        coach_name=coach["name"],
    )


@bp.get("/api/bootstrap")
def bootstrap():
    db = get_db()
    users = [dict(row) for row in db.execute("SELECT * FROM users ORDER BY role, name").fetchall()]
    locations = [dict(row) for row in db.execute("SELECT * FROM locations ORDER BY building_name").fetchall()]
    holidays = [dict(row) for row in db.execute("SELECT * FROM holidays ORDER BY date").fetchall()]
    calendars = fetch_calendars(db)
    event_types = fetch_event_types(db)
    business_hours = fetch_business_hours(db)
    show_weekends = fetch_show_weekends(db)
    planner_mode = fetch_planner_mode(db)
    return jsonify(
        {
            "users": users,
            "locations": locations,
            "holidays": holidays,
            "calendars": calendars,
            "eventTypes": event_types,
            "settings": {
                "businessHours": business_hours["slotRange"],
                "businessHoursWeek": business_hours["hoursByDay"],
                "showWeekends": show_weekends,
                "plannerMode": planner_mode,
            },
        }
    )


@bp.get("/api/events")
def events_feed():
    start_raw = request.args.get("start")
    end_raw = request.args.get("end")
    coach_id = request.args.get("coach_id") or None
    calendar_ids = request.args.getlist("calendar_id")
    event_types = request.args.getlist("event_type")

    if not start_raw or not end_raw:
        start_at = datetime.combine(date.today(), time.min)
        end_at = start_at + timedelta(days=7)
    else:
        start_at = parse_dt(start_raw)
        end_at = parse_dt(end_raw)

    db = get_db()

    coach_ids = None
    if coach_id:
        coach_ids = [coach_id]

    payload = list_calendar_events(
        db,
        start_at,
        end_at,
        coach_ids=coach_ids,
        calendar_ids=calendar_ids or None,
        event_types=event_types or None,
    )
    return jsonify(payload)


@bp.get("/api/event-type-options")
def event_type_options():
    db = get_db()
    calendar_ids = request.args.getlist("calendar_id")

    if not calendar_ids:
        return jsonify({"eventTypes": fetch_event_types(db)})

    placeholders = ", ".join("?" for _ in calendar_ids)
    rows = db.execute(
        f"""
        SELECT DISTINCT et.id, et.name, et.color, et.sort_order, et.is_active
        FROM event_types et
        JOIN events e ON e.event_type = et.name
        WHERE et.is_active = 1
          AND e.calendar_id IN ({placeholders})
        ORDER BY et.sort_order, et.name
        """,
        calendar_ids,
    ).fetchall()

    return jsonify({"eventTypes": [dict(row) for row in rows]})


@bp.post("/api/events")
def create_event():
    incoming = request.get_json(force=True)
    payload = normalize_payload(incoming)
    db = get_db()
    payload["calendar_id"] = payload.get("calendar_id") or default_calendar_for_coach(db, payload["assigned_coach_id"])

    errors, warnings = validate_event(db, payload)
    if errors:
        return jsonify({"ok": False, "errors": errors, "warnings": warnings}), 400

    series_id = None
    if payload["recurrence"] == "weekly" and payload["repeat_weeks"] > 1:
        series_id = str(uuid.uuid4())

    created_ids = []
    for start_at, end_at in event_occurrences(payload):
        event_id = str(uuid.uuid4())
        occurrence_payload = payload | {
            "start_at": fmt_dt(start_at),
            "end_at": fmt_dt(end_at),
        }
        write_event(db, event_id, occurrence_payload, series_id=series_id)
        created_ids.append(event_id)

    db.commit()
    return jsonify({"ok": True, "ids": created_ids, "warnings": warnings})


@bp.patch("/api/events/<event_id>")
def update_event(event_id: str):
    incoming = request.get_json(force=True)
    db = get_db()
    row = db.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Event not found."]}), 404

    existing = dict(row)
    payload = normalize_payload(incoming, existing=existing)
    payload["calendar_id"] = payload.get("calendar_id") or default_calendar_for_coach(db, payload["assigned_coach_id"])
    errors, warnings = validate_event(db, payload, ignore_event_id=event_id)
    if errors:
        return jsonify({"ok": False, "errors": errors, "warnings": warnings}), 400

    db.execute(
        """
        UPDATE events
        SET title = ?, event_type = ?, calendar_id = ?, assigned_coach_id = ?, co_coach_id = ?, location_id = ?,
            start_at = ?, end_at = ?, client_name = ?, client_count = ?, capacity_limit = ?,
            status = ?, recurrence = ?, requires_co_coach = ?
        WHERE id = ?
        """,
        (
            payload["title"],
            payload["event_type"],
            payload["calendar_id"],
            payload["assigned_coach_id"],
            payload["co_coach_id"],
            payload["location_id"],
            payload["start_at"],
            payload["end_at"],
            payload["client_name"],
            payload["client_count"],
            payload["capacity_limit"],
            payload["status"],
            payload["recurrence"],
            payload["requires_co_coach"],
            event_id,
        ),
    )
    db.commit()
    return jsonify({"ok": True, "warnings": warnings})


@bp.delete("/api/events/<event_id>")
def cancel_event(event_id: str):
    db = get_db()
    db.execute("DELETE FROM events WHERE id = ?", (event_id,))
    db.commit()
    return jsonify({"ok": True})


@bp.get("/api/coverage")
def coverage():
    data = coverage_matrix(
        get_db(),
        event_id=request.args.get("event_id"),
        start_at=request.args.get("start_at"),
        end_at=request.args.get("end_at"),
    )
    return jsonify(data)


@bp.get("/api/book/<slug>/slots")
def booking_slots(slug: str):
    db = get_db()
    coach = db.execute(
        "SELECT * FROM users WHERE booking_slug = ? AND role = 'Coach'",
        (slug,),
    ).fetchone()
    if coach is None:
        return jsonify({"ok": False, "errors": ["Coach not found."]}), 404

    slots = generate_slots(db, dict(coach), date.today(), day_count=10)
    return jsonify({"ok": True, "coach": dict(coach), "slots": slots})


@bp.post("/api/book/<slug>")
def create_booking(slug: str):
    incoming = request.get_json(force=True)
    db = get_db()
    coach = db.execute(
        "SELECT * FROM users WHERE booking_slug = ? AND role = 'Coach'",
        (slug,),
    ).fetchone()
    if coach is None:
        return jsonify({"ok": False, "errors": ["Coach not found."]}), 404

    payload = normalize_payload(
        {
            "title": incoming.get("title") or "Client Booking",
            "event_type": incoming.get("event_type") or "In Person Meeting",
            "calendar_id": incoming.get("calendar_id") or incoming.get("calendarId") or default_calendar_for_coach(db, coach["id"]),
            "assigned_coach_id": coach["id"],
            "location_id": incoming.get("location_id") or incoming.get("locationId"),
            "start_at": incoming.get("start_at") or incoming.get("start"),
            "end_at": incoming.get("end_at") or incoming.get("end"),
            "client_name": incoming.get("client_name") or incoming.get("clientName") or "External Client",
            "client_count": incoming.get("client_count") or 1,
            "capacity_limit": incoming.get("capacity_limit") or 1,
            "status": "Scheduled",
        }
    )
    errors, warnings = validate_event(db, payload)
    if errors:
        return jsonify({"ok": False, "errors": errors, "warnings": warnings}), 400

    event_id = str(uuid.uuid4())
    write_event(db, event_id, payload)
    db.commit()
    return jsonify({"ok": True, "id": event_id, "warnings": warnings})


@bp.post("/api/admin/event-types")
def admin_create_event_type():
    db = get_db()
    incoming = request.get_json(force=True)
    name = (incoming.get("name") or "").strip()
    color = (incoming.get("color") or "#4d6a6d").strip()
    if not name:
        return jsonify({"ok": False, "errors": ["Event type name is required."]}), 400

    existing_count = db.execute("SELECT COUNT(*) AS total FROM event_types").fetchone()["total"]
    event_type_id = normalize_id("evt", name)
    db.execute(
        """
        INSERT INTO event_types (id, name, color, sort_order, is_active)
        VALUES (?, ?, ?, ?, 1)
        """,
        (event_type_id, name, color, existing_count + 1),
    )
    db.commit()
    return jsonify({"ok": True, "eventTypes": fetch_event_types(db)})


@bp.patch("/api/admin/event-types/<event_type_id>")
def admin_update_event_type(event_type_id: str):
    db = get_db()
    incoming = request.get_json(force=True)
    color = incoming.get("color")
    name = incoming.get("name")

    row = db.execute("SELECT * FROM event_types WHERE id = ?", (event_type_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Event type not found."]}), 404

    next_name = (name or row["name"]).strip()
    next_color = (color or row["color"]).strip()
    db.execute(
        "UPDATE event_types SET name = ?, color = ? WHERE id = ?",
        (next_name, next_color, event_type_id),
    )
    db.commit()
    return jsonify({"ok": True, "eventTypes": fetch_event_types(db)})


@bp.delete("/api/admin/event-types/<event_type_id>")
def admin_delete_event_type(event_type_id: str):
    db = get_db()
    row = db.execute("SELECT * FROM event_types WHERE id = ?", (event_type_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Event type not found."]}), 404

    usage = db.execute(
        "SELECT COUNT(*) AS total FROM events WHERE event_type = ?",
        (row["name"],),
    ).fetchone()["total"]

    warnings = []
    if usage:
        fallback = db.execute(
            "SELECT id, name FROM event_types WHERE id != ? AND is_active = 1 ORDER BY sort_order, name LIMIT 1",
            (event_type_id,),
        ).fetchone()
        if fallback is None:
            return jsonify(
                {
                    "ok": False,
                    "errors": [
                        "This is the last event type. Add another event type before deleting this one."
                    ],
                }
            ), 400

        db.execute(
            "UPDATE events SET event_type = ? WHERE event_type = ?",
            (fallback["name"], row["name"]),
        )
        warnings.append(
            f"Reassigned existing events from {row['name']} to {fallback['name']} before deletion."
        )

    db.execute("DELETE FROM event_types WHERE id = ?", (event_type_id,))
    db.commit()
    return jsonify({"ok": True, "eventTypes": fetch_event_types(db), "warnings": warnings})


@bp.post("/api/admin/calendars")
def admin_create_calendar():
    db = get_db()
    incoming = request.get_json(force=True)
    name = (incoming.get("name") or "").strip()
    description = (incoming.get("description") or "").strip() or "Custom calendar"
    if not name:
        return jsonify({"ok": False, "errors": ["Calendar name is required."]}), 400

    calendar_id = normalize_id("cal", name)
    db.execute(
        "INSERT INTO calendars (id, name, description) VALUES (?, ?, ?)",
        (calendar_id, name, description),
    )
    db.commit()
    return jsonify({"ok": True, "calendars": fetch_calendars(db)})


@bp.patch("/api/admin/calendars/<calendar_id>")
def admin_update_calendar(calendar_id: str):
    db = get_db()
    incoming = request.get_json(force=True)

    row = db.execute("SELECT * FROM calendars WHERE id = ?", (calendar_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Calendar not found."]}), 404

    name = (incoming.get("name") or row["name"]).strip()
    description = (incoming.get("description") or row["description"]).strip()
    if not name:
        return jsonify({"ok": False, "errors": ["Calendar name is required."]}), 400

    db.execute(
        "UPDATE calendars SET name = ?, description = ? WHERE id = ?",
        (name, description, calendar_id),
    )
    db.commit()
    return jsonify({"ok": True, "calendars": fetch_calendars(db)})


@bp.delete("/api/admin/calendars/<calendar_id>")
def admin_delete_calendar(calendar_id: str):
    db = get_db()
    row = db.execute("SELECT id, name FROM calendars WHERE id = ?", (calendar_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Calendar not found."]}), 404

    usage = db.execute(
        "SELECT COUNT(*) AS total FROM events WHERE calendar_id = ?",
        (calendar_id,),
    ).fetchone()["total"]

    warnings = []
    if usage:
        fallback = db.execute(
            "SELECT id, name FROM calendars WHERE id != ? ORDER BY name LIMIT 1",
            (calendar_id,),
        ).fetchone()
        if fallback is None:
            return jsonify(
                {
                    "ok": False,
                    "errors": [
                        "This is the last calendar. Add another calendar before deleting this one."
                    ],
                }
            ), 400

        db.execute(
            "UPDATE events SET calendar_id = ? WHERE calendar_id = ?",
            (fallback["id"], calendar_id),
        )
        warnings.append(
            f"Reassigned events from {row['name']} to {fallback['name']} before deletion."
        )

    db.execute("DELETE FROM calendar_coaches WHERE calendar_id = ?", (calendar_id,))
    db.execute("DELETE FROM calendars WHERE id = ?", (calendar_id,))
    db.commit()
    return jsonify({"ok": True, "calendars": fetch_calendars(db), "warnings": warnings})


@bp.patch("/api/admin/settings/business-hours")
def admin_update_business_hours():
    db = get_db()
    incoming = request.get_json(force=True)
    hours_by_day = normalize_business_hours_week(incoming.get("hoursByDay"))
    slot_range = business_slot_range(hours_by_day)

    import json

    payload = json.dumps(hours_by_day)
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('business_hours_weekly', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (payload,),
    )
    db.commit()
    return jsonify({"ok": True, "businessHoursWeek": hours_by_day, "slotRange": slot_range})


@bp.patch("/api/admin/settings/weekends")
def admin_update_show_weekends():
    db = get_db()
    incoming = request.get_json(force=True)
    show_weekends = bool(incoming.get("showWeekends", False))
    serialized = "true" if show_weekends else "false"
    db.execute(
        "INSERT INTO settings (key, value) VALUES ('show_weekends', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (serialized,),
    )
    db.commit()
    return jsonify({"ok": True, "showWeekends": show_weekends})


@bp.patch("/api/admin/settings/planner-mode")
def admin_update_planner_mode():
    db = get_db()
    incoming = request.get_json(force=True)
    planner_mode = str(incoming.get("plannerMode", "live")).strip().lower()
    if planner_mode not in {"live", "static"}:
        return jsonify({"ok": False, "errors": ["plannerMode must be 'live' or 'static'."]}), 400

    db.execute(
        "INSERT INTO settings (key, value) VALUES ('planner_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (planner_mode,),
    )
    db.commit()
    return jsonify({"ok": True, "plannerMode": planner_mode})


@bp.post("/api/admin/locations")
def admin_create_location():
    db = get_db()
    incoming = request.get_json(force=True)
    building_name = (incoming.get("building_name") or incoming.get("name") or "").strip()
    if not building_name:
        return jsonify({"ok": False, "errors": ["Location name is required."]}), 400

    # Keep location creation simple in the UI and apply internal defaults.
    capacity = 1
    equipment = []

    location_id = normalize_id("loc", building_name)
    import json

    db.execute(
        "INSERT INTO locations (id, building_name, capacity, equipment) VALUES (?, ?, ?, ?)",
        (location_id, building_name, capacity, json.dumps(equipment)),
    )
    db.commit()
    locations = [dict(row) for row in db.execute("SELECT * FROM locations ORDER BY building_name").fetchall()]
    return jsonify({"ok": True, "locations": locations})


@bp.patch("/api/admin/locations/<location_id>")
def admin_update_location(location_id: str):
    db = get_db()
    incoming = request.get_json(force=True)
    building_name = (incoming.get("building_name") or incoming.get("name") or "").strip()
    if not building_name:
        return jsonify({"ok": False, "errors": ["Location name is required."]}), 400

    row = db.execute("SELECT id FROM locations WHERE id = ?", (location_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Location not found."]}), 404

    db.execute(
        "UPDATE locations SET building_name = ? WHERE id = ?",
        (building_name, location_id),
    )
    db.commit()
    locations = [dict(row) for row in db.execute("SELECT * FROM locations ORDER BY building_name").fetchall()]
    return jsonify({"ok": True, "locations": locations})


@bp.delete("/api/admin/locations/<location_id>")
def admin_delete_location(location_id: str):
    db = get_db()
    row = db.execute("SELECT id, building_name FROM locations WHERE id = ?", (location_id,)).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Location not found."]}), 404

    shift_usage = db.execute(
        "SELECT COUNT(*) AS total FROM shifts WHERE location_id = ?",
        (location_id,),
    ).fetchone()["total"]

    event_usage = db.execute(
        "SELECT COUNT(*) AS total FROM events WHERE location_id = ? AND status != 'Cancelled'",
        (location_id,),
    ).fetchone()["total"]

    warnings = []
    if shift_usage or event_usage:
        fallback = db.execute(
            "SELECT id, building_name FROM locations WHERE id != ? ORDER BY building_name LIMIT 1",
            (location_id,),
        ).fetchone()
        if fallback is None:
            return jsonify(
                {
                    "ok": False,
                    "errors": [
                        "This is the last location. Add another location before deleting this one."
                    ],
                }
            ), 400

        fallback_id = fallback["id"]
        db.execute("UPDATE shifts SET location_id = ? WHERE location_id = ?", (fallback_id, location_id))
        db.execute("UPDATE events SET location_id = ? WHERE location_id = ?", (fallback_id, location_id))
        warnings.append(
            f"Reassigned dependent shifts/events from {row['building_name']} to {fallback['building_name']} before deletion."
        )

    db.execute("DELETE FROM locations WHERE id = ?", (location_id,))
    db.commit()
    locations = [dict(row) for row in db.execute("SELECT * FROM locations ORDER BY building_name").fetchall()]
    return jsonify({"ok": True, "locations": locations, "warnings": warnings})


@bp.post("/api/admin/coaches")
def admin_create_coach():
    db = get_db()
    incoming = request.get_json(force=True)
    name = (incoming.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "errors": ["Coach name is required."]}), 400

    coach_id = normalize_id("coach", name)
    booking_slug = normalize_id("", name).removeprefix("-")
    db.execute(
        "INSERT INTO users (id, name, role, contact_info, booking_slug) VALUES (?, ?, 'Coach', ?, ?)",
        (coach_id, name, "", booking_slug),
    )

    business_hours = fetch_business_hours(db)
    location_row = db.execute("SELECT id FROM locations ORDER BY building_name LIMIT 1").fetchone()
    if location_row:
        for day_of_week in range(7):
            day_key = str(day_of_week)
            day_hours = business_hours["hoursByDay"].get(day_key, DEFAULT_BUSINESS_HOURS_WEEK[day_key])
            if not day_hours.get("enabled", True):
                continue
            db.execute(
                "INSERT INTO shifts (id, coach_id, day_of_week, start_time, end_time, location_id) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    str(uuid.uuid4()),
                    coach_id,
                    day_of_week,
                    day_hours["start"],
                    day_hours["end"],
                    location_row["id"],
                ),
            )

    db.commit()
    users = [dict(row) for row in db.execute("SELECT * FROM users ORDER BY role, name").fetchall()]
    return jsonify({"ok": True, "users": users})


@bp.patch("/api/admin/coaches/<coach_id>")
def admin_update_coach(coach_id: str):
    db = get_db()
    incoming = request.get_json(force=True)
    name = (incoming.get("name") or "").strip()
    if not name:
        return jsonify({"ok": False, "errors": ["Coach name is required."]}), 400

    row = db.execute(
        "SELECT id FROM users WHERE id = ? AND role = 'Coach'",
        (coach_id,),
    ).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Coach not found."]}), 404

    booking_slug = normalize_id("", name).removeprefix("-")
    db.execute(
        "UPDATE users SET name = ?, booking_slug = ? WHERE id = ?",
        (name, booking_slug, coach_id),
    )
    db.commit()
    users = [dict(row) for row in db.execute("SELECT * FROM users ORDER BY role, name").fetchall()]
    return jsonify({"ok": True, "users": users})


@bp.delete("/api/admin/coaches/<coach_id>")
def admin_delete_coach(coach_id: str):
    db = get_db()
    row = db.execute(
        "SELECT id, name FROM users WHERE id = ? AND role = 'Coach'",
        (coach_id,),
    ).fetchone()
    if row is None:
        return jsonify({"ok": False, "errors": ["Coach not found."]}), 404

    shift_usage = db.execute(
        "SELECT COUNT(*) AS total FROM shifts WHERE coach_id = ?",
        (coach_id,),
    ).fetchone()["total"]

    assigned_usage = db.execute(
        "SELECT COUNT(*) AS total FROM events WHERE assigned_coach_id = ? OR co_coach_id = ?",
        (coach_id, coach_id),
    ).fetchone()["total"]

    warnings = []
    if shift_usage or assigned_usage:
        fallback = db.execute(
            "SELECT id, name FROM users WHERE role = 'Coach' AND id != ? ORDER BY name LIMIT 1",
            (coach_id,),
        ).fetchone()
        if fallback is None:
            return jsonify(
                {
                    "ok": False,
                    "errors": [
                        "This is the last coach. Add another coach before deleting this one."
                    ],
                }
            ), 400

        fallback_id = fallback["id"]
        db.execute("UPDATE shifts SET coach_id = ? WHERE coach_id = ?", (fallback_id, coach_id))
        db.execute(
            "UPDATE events SET assigned_coach_id = ? WHERE assigned_coach_id = ?",
            (fallback_id, coach_id),
        )
        db.execute(
            "UPDATE events SET co_coach_id = NULL WHERE co_coach_id = ?",
            (coach_id,),
        )
        warnings.append(
            f"Reassigned shifts/assigned events from {row['name']} to {fallback['name']} and cleared legacy secondary coach links before deletion."
        )

    db.execute("DELETE FROM calendar_coaches WHERE coach_id = ?", (coach_id,))
    db.execute("DELETE FROM users WHERE id = ?", (coach_id,))
    db.commit()
    users = [dict(row) for row in db.execute("SELECT * FROM users ORDER BY role, name").fetchall()]
    return jsonify({"ok": True, "users": users, "warnings": warnings})
