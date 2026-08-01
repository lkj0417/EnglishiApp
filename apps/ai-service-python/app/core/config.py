from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "easitalk-ai-service-python"
    ai_service_port: int = 3002
    database_url: str = "mysql+pymysql://easitalk:easitalk_dev_password@localhost:3306/easitalk"
    redis_url: str = "redis://localhost:6379/0"
    openai_api_key: str | None = None
    llm_model: str = "gpt-4o-mini"
    context_ttl_seconds: int = 3600

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

