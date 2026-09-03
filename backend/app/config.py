"""
Settings

Purpose : Reads environment variables into a typed Settings object using pydantic-settings. Every secret and tunable is read here and nowhere else.
Spec    : Section 15.3
Look here when : A setting reads as None or the wrong value.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Spec 15.3: WhatsApp, email and Firebase credentials live only in the backend
    environment. Nothing in this class is ever sent to the app.
    """

    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- Supabase -----------------------------------------------------------
    supabase_url: str = ""
    supabase_anon_key: str = ""

    # Bypasses row level security completely. Used only for the few writes the
    # client is forbidden to make, above all the profiles row that carries role.
    supabase_service_role_key: str = ""

    # Used to verify the access token the app sends. Without it every request is
    # a 401, which is exactly what core/security.py is asked about.
    supabase_jwt_secret: str = ""

    # --- Outbound channels, spec 6.5 ---------------------------------------
    whatsapp_api_url: str = ""
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""

    email_api_key: str = ""
    email_from_address: str = "orders@inventix.lk"

    firebase_credentials_path: str = ""

    # --- Runtime ------------------------------------------------------------
    environment: str = "development"
    log_level: str = "INFO"

    # Which origins the app may call from. In development Expo serves from a LAN
    # address that changes, so development allows all; production must not.
    cors_origins: str = "*"

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def database_configured(self) -> bool:
        """
        Lets the app start and serve /docs before Supabase exists, so the API can
        be reviewed and the routes checked without a database.
        """
        return bool(self.supabase_url and self.supabase_service_role_key)


@lru_cache
def get_settings() -> Settings:
    """Cached so the .env file is read once, not on every request."""
    return Settings()


settings = get_settings()
