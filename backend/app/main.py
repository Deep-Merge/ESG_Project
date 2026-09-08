from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings
from app.database import Base, engine
from app.seed import ensure_sample_document


@asynccontextmanager
async def lifespan(_app: FastAPI):
    for folder in (settings.uploads_dir, settings.marked_dir, settings.exports_dir):
        folder.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_sample_document()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api")


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "phase": 2,
        "docs": "/docs",
        "taxonomy": str(Path(settings.taxonomy_path)),
    }
