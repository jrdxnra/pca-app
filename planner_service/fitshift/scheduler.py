from __future__ import annotations

import json
from collections import defaultdict
from datetime import date, datetime, time, timedelta

BACKGROUND_COLORS = {
    "floating": "rgba(183, 210, 176, 0.34)",
    "holiday": "rgba(211, 143, 117, 0.32)",
}
DEFAULT_EVENT_COLORS = {
    "Self Paced Work": "#6f8f72",
    "In Person Meeting": "#de8249",
    "Virtual Meeting": "#5282a7",
    "Class": "#9a5d7b",
}
DEFAULT_BUSINESS_HOURS_WEEK = {
    "0": {"start": "07:00", "end": "16:00", "enabled": True},
    "1": {"start": "10:00", "end": "19:00", "enabled": True},
    "2": {"start": "10:00", "end": "19:00", "enabled": True},
    "3": {"start": "10:00", "end": "19:00", "enabled": True},
    "4": {"start": "07:00", "end": "16:00", "enabled": True},
    "5": {"start": "07:00", "end": "20:00", "enabled": True},
    "6": {"start": "07:00", "end": "20:00", "enabled": True},
}


def parse_dt(value: str) -> datetime:
    cleaned = value.replace("Z", "+00:00")
    parsed = datetime.fromisoformat(cleaned)
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone().replace(tzinfo=None)
    return parsed.replace(second=0, microsecond=0)


def fmt_dt(value: datetime) -> str:
    return value.replace(second=0, microsecond=0).isoformat(timespec="minutes")


def overlaps(start_a: datetime, end_a: datetime, start_b: datetime, end_b: datetime) -> bool:
    return start_a < end_b and start_b < end_a


def daterange(start_day: date, end_day: date):
    cursor = start_day
    while cursor < end_day:
        yield cursor
        cursor += timedelta(days=1)


def fetch_lookup(db, table: str) -> dict[str, dict]:
    rows = db.execute(f"SELECT * FROM {table}").fetchall()
    return {row["id"]: dict(row) for row in rows}


def fetch_shift_map(db):
    rows = db.execute("SELECT * FROM shifts").fetchall()
    return {(row["coach_id"], row["day_of_week"]): dict(row) for row in rows}


def fetch_floating_map(db):
    rows = db.execute(
        "SELECT * FROM floating_requirements ORDER BY coach_id, day_of_week, sort_order"
    ).fetchall()
    grouped = defaultdict(list)
    for row in rows:
        grouped[(row["coach_id"], row["day_of_week"])].append(dict(row))
    return grouped


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


def fetch_business_hours_week(db) -> dict:
    row = db.execute("SELECT value FROM settings WHERE key = 'business_hours_weekly'").fetchone()
    if not row:
        return normalize_business_hours_week(DEFAULT_BUSINESS_HOURS_WEEK)
    try:
        parsed = json.loads(row["value"])
    except Exception:
        return normalize_business_hours_week(DEFAULT_BUSINESS_HOURS_WEEK)
    return normalize_business_hours_week(parsed)


def fetch_holidays(db, start_at: datetime, end_at: datetime) -> dict[date, dict]:
    rows = db.execute(
        "SELECT * FROM holidays WHERE date >= ? AND date <= ?",
        (start_at.date().isoformat(), (end_at.date() - timedelta(days=1)).isoformat()),
    ).fetchall()
    return {date.fromisoformat(row["date"]): dict(row) for row in rows}


def build_floating_blocks(
    shift: dict,
    requirements: list[dict],
    day: date,
    event_colors: dict[str, str],
    concrete_event_types: set[str] | None = None,
) -> list[dict]:
    if not shift or not requirements:
        return []

    shift_start = datetime.combine(day, time.fromisoformat(shift["start_time"]))
    shift_end = datetime.combine(day, time.fromisoformat(shift["end_time"]))
    total_minutes = sum(item["duration_minutes"] for item in requirements)
    anchor = shift_start + (shift_end - shift_start) / 2 - timedelta(minutes=total_minutes // 2)
    earliest = shift_start + timedelta(hours=2)
    latest = shift_end - timedelta(minutes=total_minutes + 60)

    if anchor < earliest:
        anchor = earliest
    if anchor > latest:
        anchor = max(shift_start + timedelta(minutes=45), shift_end - timedelta(minutes=total_minutes + 15))

    blocks = []
    concrete_types = concrete_event_types or set()
    cursor = anchor
    for item in requirements:
        if item["label"] in concrete_types:
            cursor = cursor + timedelta(minutes=item["duration_minutes"])
            continue
        block_end = cursor + timedelta(minutes=item["duration_minutes"])
        color = event_colors.get(item["label"], "#6f8f72")
        blocks.append(
            {
                "id": f"floating-{shift['coach_id']}-{day.isoformat()}-{item['label'].lower()}",
                "title": item["label"],
                "start": fmt_dt(cursor),
                "end": fmt_dt(block_end),
                "backgroundColor": color,
                "borderColor": color,
                "textColor": "#13211f",
                "editable": False,
                "extendedProps": {
                    "kind": "floating",
                    "eventType": item["label"],
                    "status": "Scheduled",
                    "coachId": shift["coach_id"],
                    "coachName": shift.get("coach_name"),
                    "locationId": shift["location_id"],
                    "locationName": shift.get("location_name"),
                },
            }
        )
        cursor = block_end
    return blocks


def fetch_event_color_map(db) -> dict[str, str]:
    rows = db.execute("SELECT name, color FROM event_types WHERE is_active = 1").fetchall()
    if not rows:
        return DEFAULT_EVENT_COLORS
    return {row["name"]: row["color"] for row in rows}


def serialize_event(row: dict, users: dict[str, dict], locations: dict[str, dict], event_colors: dict[str, str]) -> dict:
    assigned = users.get(row["assigned_coach_id"], {})
    location = locations.get(row["location_id"], {})
    title = row["title"]

    color = event_colors.get(row["event_type"], "#4d6a6d")
    if row["status"] == "Cancelled":
        color = "#9ca3af"
    elif row["status"] == "Sub-Requested":
        color = "#b45309"

    return {
        "id": row["id"],
        "title": title,
        "start": row["start_at"],
        "end": row["end_at"],
        "backgroundColor": color,
        "borderColor": color,
        "textColor": "#13211f",
        "editable": row["status"] != "Cancelled",
        "extendedProps": {
            "coachId": row["assigned_coach_id"],
            "coachName": assigned.get("name"),
            "locationId": row["location_id"],
            "locationName": location.get("building_name"),
            "eventType": row["event_type"],
            "calendarId": row.get("calendar_id") or "",
            "clientCount": row["client_count"],
            "capacityLimit": row["capacity_limit"],
            "status": row["status"],
            "clientName": row["client_name"] or "",
            "seriesId": row["series_id"] or "",
            "kind": "scheduled",
        },
    }


def list_calendar_events(
    db,
    start_at: datetime,
    end_at: datetime,
    coach_ids: list[str] | None = None,
    calendar_ids: list[str] | None = None,
    event_types: list[str] | None = None,
) -> list[dict]:
    query = "SELECT * FROM events WHERE end_at > ? AND start_at < ?"
    params = [fmt_dt(start_at), fmt_dt(end_at)]
    if calendar_ids:
        placeholders = ", ".join("?" for _ in calendar_ids)
        query += f" AND calendar_id IN ({placeholders})"
        params.extend(calendar_ids)
    if coach_ids:
        placeholders = ", ".join("?" for _ in coach_ids)
        query += f" AND assigned_coach_id IN ({placeholders})"
        params.extend(coach_ids)
    if event_types:
        placeholders = ", ".join("?" for _ in event_types)
        query += f" AND event_type IN ({placeholders})"
        params.extend(event_types)
    query += " ORDER BY start_at"

    rows = [dict(row) for row in db.execute(query, params).fetchall()]
    users = fetch_lookup(db, "users")
    locations = fetch_lookup(db, "locations")
    event_colors = fetch_event_color_map(db)
    shift_map = fetch_shift_map(db)
    floating_map = fetch_floating_map(db)
    holidays = fetch_holidays(db, start_at, end_at)

    events = [serialize_event(row, users, locations, event_colors) for row in rows]

    visible_coach_ids = coach_ids if coach_ids else [row_id for row_id, item in users.items() if item["role"] == "Coach"]
    for day in daterange(start_at.date(), end_at.date()):
        holiday = holidays.get(day)
        if holiday:
            events.append(
                {
                    "id": f"holiday-{holiday['id']}",
                    "title": holiday["name"],
                    "start": day.isoformat(),
                    "end": (day + timedelta(days=1)).isoformat(),
                    "display": "background",
                    "backgroundColor": BACKGROUND_COLORS["holiday"],
                    "extendedProps": {"kind": "holiday"},
                }
            )

        for current_coach_id in visible_coach_ids:
            shift = shift_map.get((current_coach_id, day.weekday()))
            requirements = floating_map.get((current_coach_id, day.weekday()), [])
            if shift and not holiday:
                shift["coach_name"] = users.get(current_coach_id, {}).get("name")
                shift["location_name"] = locations.get(shift["location_id"], {}).get("building_name")
                concrete_types = {
                    row["event_type"]
                    for row in rows
                    if row["assigned_coach_id"] == current_coach_id
                    and parse_dt(row["start_at"]).date() == day
                    and row["status"] != "Cancelled"
                }
                events.extend(
                    build_floating_blocks(
                        shift,
                        requirements,
                        day,
                        event_colors,
                        concrete_event_types=concrete_types,
                    )
                )

    return events


def event_occurrences(payload: dict) -> list[tuple[datetime, datetime]]:
    start_at = parse_dt(payload["start_at"])
    end_at = parse_dt(payload["end_at"])
    recurrence = payload.get("recurrence", "none")
    repeat_weeks = max(1, int(payload.get("repeat_weeks") or 1))
    if recurrence != "weekly":
        repeat_weeks = 1
    return [
        (start_at + timedelta(weeks=index), end_at + timedelta(weeks=index))
        for index in range(repeat_weeks)
    ]


def validate_event(db, payload: dict, ignore_event_id: str | None = None) -> tuple[list[str], list[str]]:
    shift_map = fetch_shift_map(db)
    floating_map = fetch_floating_map(db)
    business_hours_week = fetch_business_hours_week(db)
    locations = fetch_lookup(db, "locations")
    location = locations.get(payload["location_id"])
    errors = []
    warnings = []

    if not location:
        errors.append("A valid location is required.")
        return errors, warnings

    client_count = int(payload.get("client_count") or 1)
    if client_count > int(location["capacity"]):
        errors.append(f"{location['building_name']} only supports {location['capacity']} clients.")

    first_start = parse_dt(payload["start_at"])
    last_end = parse_dt(payload["end_at"]) + timedelta(weeks=max(0, int(payload.get("repeat_weeks") or 1) - 1))
    holidays = fetch_holidays(db, first_start, last_end + timedelta(days=1))

    for start_at, end_at in event_occurrences(payload):
        if end_at <= start_at:
            errors.append("End time must be later than start time.")
            continue

        holiday = holidays.get(start_at.date())
        if holiday:
            errors.append(f"{start_at.date().isoformat()} is blocked by holiday: {holiday['name']}.")
            continue

        day_hours = business_hours_week.get(str(start_at.weekday()), DEFAULT_BUSINESS_HOURS_WEEK[str(start_at.weekday())])
        if not day_hours.get("enabled", True):
            errors.append("The selected day is outside business hours.")
            continue

        business_start = datetime.combine(start_at.date(), time.fromisoformat(day_hours["start"]))
        business_end = datetime.combine(start_at.date(), time.fromisoformat(day_hours["end"]))
        if start_at < business_start or end_at > business_end:
            errors.append("The selected time falls outside business hours.")

        shift = shift_map.get((payload["assigned_coach_id"], start_at.weekday()))
        if shift:
            floating_blocks = build_floating_blocks(
                shift,
                floating_map.get((payload["assigned_coach_id"], start_at.weekday()), []),
                start_at.date(),
                fetch_event_color_map(db),
            )
            for floating in floating_blocks:
                floating_start = parse_dt(floating["start"])
                floating_end = parse_dt(floating["end"])
                if overlaps(start_at, end_at, floating_start, floating_end) and payload.get("event_type") != floating["title"]:
                    errors.append(f"The selected time overlaps {floating['title'].lower()}.")

        window_start = datetime.combine(start_at.date(), time.min)
        window_end = window_start + timedelta(days=1)
        rows = db.execute(
            "SELECT * FROM events WHERE assigned_coach_id = ? AND end_at > ? AND start_at < ? AND id != ? AND status != 'Cancelled'",
            (payload["assigned_coach_id"], fmt_dt(window_start), fmt_dt(window_end), ignore_event_id or ""),
        ).fetchall()

        for row in rows:
            other = dict(row)
            other_start = parse_dt(other["start_at"])
            other_end = parse_dt(other["end_at"])

            if overlaps(start_at, end_at, other_start, other_end):
                errors.append(f"Conflicts with {other['title']} from {other['start_at']} to {other['end_at']}.")
                continue

            if other["location_id"] == payload["location_id"]:
                continue

    return list(dict.fromkeys(errors)), list(dict.fromkeys(warnings))


def generate_slots(db, coach: dict, start_day: date, day_count: int = 7) -> list[dict]:
    shift_map = fetch_shift_map(db)
    floating_map = fetch_floating_map(db)
    holidays = fetch_holidays(
        db,
        datetime.combine(start_day, time.min),
        datetime.combine(start_day + timedelta(days=day_count + 1), time.min),
    )
    locations = fetch_lookup(db, "locations")
    slots = []

    for current_day in daterange(start_day, start_day + timedelta(days=day_count)):
        if holidays.get(current_day):
            continue
        shift = shift_map.get((coach["id"], current_day.weekday()))
        if not shift:
            continue

        shift_start = datetime.combine(current_day, time.fromisoformat(shift["start_time"]))
        shift_end = datetime.combine(current_day, time.fromisoformat(shift["end_time"]))
        floating_blocks = [
            (parse_dt(block["start"]), parse_dt(block["end"]))
            for block in build_floating_blocks(
                shift,
                floating_map.get((coach["id"], current_day.weekday()), []),
                current_day,
                fetch_event_color_map(db),
            )
        ]
        concrete = [
            dict(row)
            for row in db.execute(
                "SELECT * FROM events WHERE assigned_coach_id = ? AND end_at > ? AND start_at < ? AND status != 'Cancelled' ORDER BY start_at",
                (coach["id"], fmt_dt(shift_start), fmt_dt(shift_end)),
            ).fetchall()
        ]

        cursor = shift_start
        while cursor + timedelta(minutes=60) <= shift_end:
            candidate_end = cursor + timedelta(minutes=60)
            if any(overlaps(cursor, candidate_end, start_at, end_at) for start_at, end_at in floating_blocks):
                cursor += timedelta(minutes=30)
                continue

            blocked = False
            for row in concrete:
                other_start = parse_dt(row["start_at"])
                other_end = parse_dt(row["end_at"])
                if overlaps(cursor, candidate_end, other_start, other_end):
                    blocked = True
                    break
                if row["location_id"] != shift["location_id"]:
                    continue

            if not blocked:
                slots.append(
                    {
                        "start": fmt_dt(cursor),
                        "end": fmt_dt(candidate_end),
                        "locationId": shift["location_id"],
                        "locationName": locations.get(shift["location_id"], {}).get("building_name"),
                    }
                )

            cursor += timedelta(minutes=30)

    return slots


def coverage_matrix(db, event_id: str | None = None, start_at: str | None = None, end_at: str | None = None):
    if event_id:
        row = db.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if not row:
            return []
        event = dict(row)
        start_value = event["start_at"]
        end_value = event["end_at"]
        location_id = event["location_id"]
        ignore_event_id = event_id
    else:
        start_value = start_at
        end_value = end_at
        location_id = None
        ignore_event_id = None

    start_dt = parse_dt(start_value)
    end_dt = parse_dt(end_value)
    users = [
        dict(row)
        for row in db.execute("SELECT * FROM users WHERE role = 'Coach' ORDER BY name").fetchall()
    ]
    shift_map = fetch_shift_map(db)
    floating_map = fetch_floating_map(db)

    matrix = []
    for coach in users:
        shift = shift_map.get((coach["id"], start_dt.weekday()))
        reasons = []
        available = True
        if not shift:
            available = False
            reasons.append("No shift on this day")
        else:
            shift_start = datetime.combine(start_dt.date(), time.fromisoformat(shift["start_time"]))
            shift_end = datetime.combine(start_dt.date(), time.fromisoformat(shift["end_time"]))
            if start_dt < shift_start or end_dt > shift_end:
                available = False
                reasons.append("Outside shift window")

            for block in build_floating_blocks(
                shift,
                floating_map.get((coach["id"], start_dt.weekday()), []),
                start_dt.date(),
                fetch_event_color_map(db),
            ):
                block_start = parse_dt(block["start"])
                block_end = parse_dt(block["end"])
                if overlaps(start_dt, end_dt, block_start, block_end):
                    available = False
                    reasons.append(block["title"])

        rows = db.execute(
            "SELECT * FROM events WHERE assigned_coach_id = ? AND end_at > ? AND start_at < ? AND id != ? AND status != 'Cancelled'",
            (coach["id"], fmt_dt(datetime.combine(start_dt.date(), time.min)), fmt_dt(datetime.combine(start_dt.date(), time.min) + timedelta(days=1)), ignore_event_id or ""),
        ).fetchall()
        for row in rows:
            other = dict(row)
            other_start = parse_dt(other["start_at"])
            other_end = parse_dt(other["end_at"])
            if overlaps(start_dt, end_dt, other_start, other_end):
                available = False
                reasons.append(f"Busy with {other['title']}")
            if location_id and other["location_id"] != location_id:
                continue

        matrix.append(
            {
                "coachId": coach["id"],
                "coachName": coach["name"],
                "available": available,
                "reasons": list(dict.fromkeys(reasons)),
                "bookingSlug": coach.get("booking_slug"),
            }
        )

    return matrix