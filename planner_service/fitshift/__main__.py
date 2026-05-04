from __future__ import annotations

import os

from . import create_app


def main() -> None:
    app = create_app()
    debug = os.environ.get("FITSHIFT_DEBUG", "1") == "1"
    port = int(os.environ.get("FITSHIFT_PORT", "4173"))
    app.run(debug=debug, port=port)


if __name__ == "__main__":
    main()
