from django.apps import AppConfig


class SmsConfig(AppConfig):
    name = 'sms'

    def ready(self):
        try:
            from . import signals  # noqa: F401
        except ImportError:
            pass
