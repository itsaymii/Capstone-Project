from django.apps import AppConfig


class AccountsConfig(AppConfig):
    name = 'accounts'
    # Keep the historical app label so existing migration records remain valid.
    label = 'api'
