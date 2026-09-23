from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Birthday Party App"
    secret_key: str = "change-me-in-production-please"
    access_token_expire_minutes: int = 60 * 12
    admin_challenge_expire_minutes: int = 5

    database_url: str = "sqlite:////data/app.db"

    admin_username: str = "admin"
    # Bootstrap password for the very first run only. Once the Admin row
    # exists in the database, this value is ignored.
    admin_bootstrap_password: str = "changeme123"

    cors_origins: str = "*"

    upload_dir: str = "/data/uploads"

    # Kahoot-style scoring
    max_points_per_question: int = 1000
    min_points_for_correct_answer: int = 100

    # SMTP (recap emails). Left empty, sending is silently skipped — fill
    # these in .env to enable it. OVH typically uses ssl0.ovh.net:465 (SSL).
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_use_ssl: bool = True
    smtp_from_email: str = "contact@amonita.fr"
    smtp_from_name: str = "Anniv Lana"

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_username and self.smtp_password)

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
