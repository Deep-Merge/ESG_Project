from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(ROOT / ".env"),
        extra="ignore",
    )

    app_name: str = "Savills IM ESG Knowledge Base"
    app_env: str = "development"
    secret_key: str = "change-me"
    database_url: str = "sqlite:///./var/esg.db"
    storage_dir: Path = Path("./var")
    taxonomy_path: Path = ROOT / "data" / "taxonomy.json"
    default_reviewer: str = "ESG Reviewer"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-20250514"
    cors_origins: str = "http://localhost:5173"

    @property
    def backend_dir(self) -> Path:
        return Path(__file__).resolve().parents[1]

    @property
    def uploads_dir(self) -> Path:
        return (self.backend_dir / self.storage_dir / "uploads").resolve()

    @property
    def marked_dir(self) -> Path:
        return (self.backend_dir / self.storage_dir / "marked").resolve()

    @property
    def exports_dir(self) -> Path:
        return (self.backend_dir / self.storage_dir / "exports").resolve()

    @property
    def db_url(self) -> str:
        if self.database_url.startswith("sqlite:///./"):
            db_path = (self.backend_dir / self.database_url.replace("sqlite:///./", "")).resolve()
            db_path.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{db_path}"
        return self.database_url


settings = Settings()
