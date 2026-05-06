from __future__ import annotations

import json
import re
import sqlite3
import uuid
from datetime import date, datetime, time, timedelta
from pathlib import Path

from flask import Flask, current_app, g

from .scheduler import fmt_dt


def get_db() -> sqlite3.Connection:
    if "db" not in g:
        connection = sqlite3.connect(current_app.config["DATABASE_PATH"])
        connection.row_factory = sqlite3.Row
        g.db = connection
    return g.db


def close_db(_error: BaseException | None = None) -> None:
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def create_schema(db: sqlite3.Connection) -> None:
    db.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            contact_info TEXT,
            booking_slug TEXT
        );

        CREATE TABLE IF NOT EXISTS locations (
            id TEXT PRIMARY KEY,
            building_name TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            equipment TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS event_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            color TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS calendars (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS calendar_coaches (
            calendar_id TEXT NOT NULL,
            coach_id TEXT NOT NULL,
            PRIMARY KEY (calendar_id, coach_id)
        );

        CREATE TABLE IF NOT EXISTS shifts (
            id TEXT PRIMARY KEY,
            coach_id TEXT NOT NULL,
            day_of_week INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            location_id TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS floating_requirements (
            id TEXT PRIMARY KEY,
            coach_id TEXT NOT NULL,
            day_of_week INTEGER NOT NULL,
            label TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            event_type TEXT NOT NULL,
            calendar_id TEXT,
            assigned_coach_id TEXT NOT NULL,
            co_coach_id TEXT,
            location_id TEXT NOT NULL,
            start_at TEXT NOT NULL,
            end_at TEXT NOT NULL,
            client_name TEXT,
            client_count INTEGER NOT NULL,
            capacity_limit INTEGER NOT NULL,
            status TEXT NOT NULL,
            recurrence TEXT NOT NULL,
            series_id TEXT,
            requires_co_coach INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS holidays (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            name TEXT NOT NULL
        );
        """
    )
    db.commit()


def normalize_id(prefix: str, value: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    if not cleaned:
        cleaned = str(uuid.uuid4())[:8]
    return f"{prefix}-{cleaned}"


def ensure_event_type_defaults(db: sqlite3.Connection) -> None:
    defaults = [
        ("evt-self-paced-work", "Self Paced Work", "#6f8f72", 1, 1),
        ("evt-in-person-meeting", "In Person Meeting", "#de8249", 2, 1),
        ("evt-virtual-meeting", "Virtual Meeting", "#5282a7", 3, 1),
        ("evt-class", "Class", "#9a5d7b", 4, 1),
        ("evt-lunch", "Lunch", "#5e7a62", 5, 1),
        ("evt-facility-support", "Facility Support", "#6f7f9b", 6, 1),
    ]
    for row in defaults:
        db.execute(
            """
            INSERT INTO event_types (id, name, color, sort_order, is_active)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            """,
            row,
        )


def ensure_setting_defaults(db: sqlite3.Connection) -> None:
    weekly_defaults = {
        "0": {"start": "07:00", "end": "16:00", "enabled": True},
        "1": {"start": "10:00", "end": "19:00", "enabled": True},
        "2": {"start": "10:00", "end": "19:00", "enabled": True},
        "3": {"start": "10:00", "end": "19:00", "enabled": True},
        "4": {"start": "07:00", "end": "16:00", "enabled": True},
        "5": {"start": "07:00", "end": "20:00", "enabled": True},
        "6": {"start": "07:00", "end": "20:00", "enabled": True},
    }
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
        ("business_hours", json.dumps({"start": "06:00", "end": "21:00"})),
    )
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
        ("business_hours_weekly", json.dumps(weekly_defaults)),
    )
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
        ("show_weekends", "false"),
    )
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
        ("planner_mode", "live"),
    )
    # One-time migration: older builds defaulted weekends to true.
    # Flip existing installs to off once so the new default is consistent.
    migrated_row = db.execute(
        "SELECT value FROM settings WHERE key = 'show_weekends_default_off_migrated'"
    ).fetchone()
    if migrated_row is None:
        db.execute("UPDATE settings SET value = 'false' WHERE key = 'show_weekends'")
        db.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?)",
            ("show_weekends_default_off_migrated", "true"),
        )


def remove_default_floating_requirements(db: sqlite3.Connection) -> None:
    migrated_row = db.execute(
        "SELECT value FROM settings WHERE key = 'floating_requirements_defaults_removed_migrated'"
    ).fetchone()
    if migrated_row is not None:
        return

    db.execute(
        "DELETE FROM floating_requirements WHERE label IN ('Lunch', 'Facility Support')"
    )
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?)",
        ("floating_requirements_defaults_removed_migrated", "true"),
    )


def ensure_events_calendar_column(db: sqlite3.Connection) -> None:
    columns = {
        row["name"]
        for row in db.execute("PRAGMA table_info(events)").fetchall()
    }
    if "calendar_id" not in columns:
        db.execute("ALTER TABLE events ADD COLUMN calendar_id TEXT")

    migrated_row = db.execute(
        "SELECT value FROM settings WHERE key = 'events_calendar_backfill_migrated'"
    ).fetchone()
    if migrated_row is not None:
        return

    # Prefer calendar mapped to assigned coach, otherwise first alphabetic calendar.
    db.execute(
        """
        UPDATE events
        SET calendar_id = COALESCE(
            (
                SELECT cc.calendar_id
                FROM calendar_coaches cc
                JOIN calendars c ON c.id = cc.calendar_id
                WHERE cc.coach_id = events.assigned_coach_id
                ORDER BY c.name, cc.calendar_id
                LIMIT 1
            ),
            (
                SELECT id
                FROM calendars
                ORDER BY name
                LIMIT 1
            )
        )
        WHERE calendar_id IS NULL OR TRIM(calendar_id) = ''
        """
    )
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?)",
        ("events_calendar_backfill_migrated", "true"),
    )


def seed_database(db: sqlite3.Connection) -> None:
    existing = db.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
    if existing:
        return

    users = [
        ("admin-1", "Avery Stone", "Admin", "avery@fitshift.dev", None),
        ("coach-1", "Maya Cole", "Coach", "maya@fitshift.dev", "maya-cole"),
        ("coach-2", "Jordan Vega", "Coach", "jordan@fitshift.dev", "jordan-vega"),
        ("coach-3", "Nico Hart", "Coach", "nico@fitshift.dev", "nico-hart"),
        ("client-1", "Reese Carter", "Client", "reese@example.com", None),
    ]
    db.executemany("INSERT INTO users VALUES (?, ?, ?, ?, ?)", users)

    locations = [
        ("mp2", "MP2", 3, json.dumps(["Dumbbells", "Kettlebells", "TRX"])),
        ("mat3", "MAT3", 4, json.dumps(["Sliders", "Bands", "TRX"])),
        ("bv100", "BV100", 8, json.dumps(["Bench", "Bars", "Rowers"])),
    ]
    db.executemany("INSERT INTO locations VALUES (?, ?, ?, ?)", locations)

    calendars = [
        ("cal-coaching-classes", "Coaching Classes", "Group classes and team training sessions"),
        ("cal-client-training", "Clients/Training", "One-on-one and small group client sessions"),
        ("cal-onboarding", "Onboarding", "New member orientation and assessment sessions"),
    ]
    db.executemany("INSERT INTO calendars VALUES (?, ?, ?)", calendars)

    calendar_coaches = [
        ("cal-coaching-classes", "coach-2"),
        ("cal-coaching-classes", "coach-3"),
        ("cal-client-training", "coach-1"),
        ("cal-client-training", "coach-2"),
        ("cal-onboarding", "coach-1"),
        ("cal-onboarding", "coach-3"),
    ]
    db.executemany("INSERT INTO calendar_coaches VALUES (?, ?)", calendar_coaches)

    shifts = []
    for coach_id, location_id, start_time, end_time in [
        ("coach-1", "mp2", "07:00", "16:00"),
        ("coach-2", "mat3", "09:00", "18:00"),
        ("coach-3", "bv100", "08:00", "17:00"),
    ]:
        for day_of_week in range(5):
            shifts.append((str(uuid.uuid4()), coach_id, day_of_week, start_time, end_time, location_id))

    db.executemany("INSERT INTO shifts VALUES (?, ?, ?, ?, ?, ?)", shifts)

    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    sample_events = [
        {
            "id": str(uuid.uuid4()),
            "title": "TBS",
            "event_type": "In Person Meeting",
            "calendar_id": "cal-client-training",
            "assigned_coach_id": "coach-1",
            "co_coach_id": None,
            "location_id": "mp2",
            "start_at": fmt_dt(datetime.combine(start_of_week + timedelta(days=1), time(hour=8, minute=0))),
            "end_at": fmt_dt(datetime.combine(start_of_week + timedelta(days=1), time(hour=9, minute=0))),
            "client_name": "Reese Carter",
            "client_count": 1,
            "capacity_limit": 1,
            "status": "Scheduled",
            "recurrence": "weekly",
            "series_id": "series-onboarding",
            "requires_co_coach": 0,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Class Conditioning",
            "event_type": "Class",
            "calendar_id": "cal-coaching-classes",
            "assigned_coach_id": "coach-2",
            "co_coach_id": "coach-3",
            "location_id": "bv100",
            "start_at": fmt_dt(datetime.combine(start_of_week + timedelta(days=2), time(hour=11, minute=0))),
            "end_at": fmt_dt(datetime.combine(start_of_week + timedelta(days=2), time(hour=12, minute=30))),
            "client_name": "Small Group",
            "client_count": 5,
            "capacity_limit": 8,
            "status": "Scheduled",
            "recurrence": "none",
            "series_id": None,
            "requires_co_coach": 1,
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Virtual Check-In",
            "event_type": "Virtual Meeting",
            "calendar_id": "cal-onboarding",
            "assigned_coach_id": "coach-1",
            "co_coach_id": None,
            "location_id": "mp2",
            "start_at": fmt_dt(datetime.combine(start_of_week + timedelta(days=3), time(hour=14, minute=0))),
            "end_at": fmt_dt(datetime.combine(start_of_week + timedelta(days=3), time(hour=14, minute=45))),
            "client_name": "Travel Client",
            "client_count": 1,
            "capacity_limit": 1,
            "status": "Sub-Requested",
            "recurrence": "none",
            "series_id": None,
            "requires_co_coach": 0,
        },
    ]
    db.executemany(
        """
        INSERT INTO events (
            id, title, event_type, calendar_id, assigned_coach_id, co_coach_id, location_id,
            start_at, end_at, client_name, client_count, capacity_limit,
            status, recurrence, series_id, requires_co_coach
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [tuple(item.values()) for item in sample_events],
    )

    holiday_date = date(today.year, 5, 25)
    db.execute(
        "INSERT INTO holidays VALUES (?, ?, ?)",
        (str(uuid.uuid4()), holiday_date.isoformat(), "Memorial Day"),
    )
    db.commit()


def initialize_database() -> None:
    database_path = Path(current_app.config["DATABASE_PATH"])
    database_path.parent.mkdir(parents=True, exist_ok=True)
    db = get_db()
    create_schema(db)
    ensure_events_calendar_column(db)
    seed_database(db)
    ensure_event_type_defaults(db)
    ensure_setting_defaults(db)
    remove_default_floating_requirements(db)
    db.commit()


def init_app(app: Flask) -> None:
    app.teardown_appcontext(close_db)
    with app.app_context():
        initialize_database()
