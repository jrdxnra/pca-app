</div>

## Fit-Shift Python Scheduler

This repository now uses a package-first Python layout instead of a root script layout.

Core habits this project now demonstrates:

- Application factory pattern with `create_app()`
- Package entrypoint with `python -m fitshift`
- Editable install with `python -m pip install -e .`
- Instance-folder database storage instead of committing mutable runtime state into the package
- Blueprint-based route registration and a separate database module

## Local development

1. Create and activate the virtual environment:

```bash
cd /workspaces/Fit-Shift
python3 -m venv .venv
source .venv/bin/activate
```

2. Install the project in editable mode:

```bash
python -m pip install --upgrade pip
python -m pip install -e .
```

3. Run the development server as a module:

```bash
python -m fitshift
```

4. Open the app:

```text
http://127.0.0.1:4173
```

## Alternative dev command

If you want to learn the framework-native command as well, use Flask through Python rather than calling the `flask` executable directly:

```bash
python -m flask --app fitshift:create_app run --debug --port 4173
```

## Project structure

```text
fitshift/
  __init__.py
  __main__.py
  db.py
  scheduler.py
  views.py
  static/
  templates/
instance/
pyproject.toml
```

## What is included

- Admin and coach scheduling dashboard
- Daily, weekly, and staff coverage views
- Drag-and-drop and resize support for bookings
- Client-facing shareable booking URLs per coach
- Capacity prompts for high-ratio sessions
- Auto-generated travel buffer overlays between locations
- Floating lunch and facility-support blocks reserved inside shifts

## Notes

- This is a local Python prototype intended for practice and product shaping.
- The original Firebase requirement set from the prompt is represented here as Python-first local application behavior rather than Firebase services.
- Runtime data now lives under Flask's `instance/` directory, which is a better habit than storing live state inside the package code.
