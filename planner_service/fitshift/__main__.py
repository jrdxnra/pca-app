from __future__ import annotations

import os

from . import create_app


def main() -> None:
    app = create_app()
    debug = os.environ.get("FITSHIFT_DEBUG", "0") == "1"
    # Cloud Run uses PORT env var, fallback to FITSHIFT_PORT or 4173
    port = int(os.environ.get("PORT", os.environ.get("FITSHIFT_PORT", "4173")))
    # Cloud Run requires listening on 0.0.0.0
    host = os.environ.get("FITSHIFT_HOST", "0.0.0.0")
    app.run(debug=debug, host=host, port=port)


if __name__ == "__main__":
    main()
