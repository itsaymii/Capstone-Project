from django.apps import AppConfig


class IncidentsConfig(AppConfig):
    name = 'incidents'

    def ready(self):
        # Import signals to ensure they're registered when app is ready
        try:
            from . import signals  # noqa: F401
        except Exception:
            pass
