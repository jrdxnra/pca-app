from __future__ import annotations

from pathlib import Path

from flask import Flask

from .db import init_app as init_db
from .views import bp as views_bp

DEFAULT_DATABASE_NAME = "fit_shift.db"


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_mapping(
        SECRET_KEY="dev",
        DATABASE_PATH=Path(app.instance_path) / DEFAULT_DATABASE_NAME,
    )

    if test_config:
        app.config.update(test_config)

    Path(app.instance_path).mkdir(parents=True, exist_ok=True)
    init_db(app)
    app.register_blueprint(views_bp)
    return app
