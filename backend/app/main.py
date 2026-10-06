"""Точка входу FastAPI-застосунку EduReg."""
import logging
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse

from app.api.routers import auth, events, registrations
from app.core.config import get_settings
from app.core.errors import AppError, register_error_handlers
from app.db.session import Base, SessionLocal, engine
from app.seed import seed_demo

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("edureg.api")

API_PREFIX = "/api/v1"
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"  # зібраний фронтенд (npm run build:render)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """При старті створюємо таблиці та (за потреби) наповнюємо демонстраційними даними."""
    Base.metadata.create_all(engine)
    if get_settings().seed_demo:
        with SessionLocal() as db:
            if seed_demo(db):
                log.info("Створено демонстраційні дані")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="EduReg API",
        version="1.0.0",
        description="REST API застосунку для реєстрації учасників освітніх заходів.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=False,
        allow_methods=["*"], allow_headers=["*"],
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        """Журнал запитів: метод, шлях, код відповіді та тривалість."""
        t0 = time.perf_counter()
        response = await call_next(request)
        log.info("%s %s -> %s (%.0f мс)", request.method, request.url.path, response.status_code, (time.perf_counter() - t0) * 1000)
        return response

    register_error_handlers(app)
    for r in (auth.router, auth.service_router, events.router, registrations.router):
        app.include_router(r, prefix=API_PREFIX)

    if (STATIC_DIR / "index.html").is_file():
        # Один сервіс віддає і API, і фронтенд: усе, що не /api та не /docs, – статичні файли або index.html
        @app.get("/{path:path}", include_in_schema=False)
        def frontend(path: str):
            if path.startswith("api/"):
                raise AppError(404, "Ресурс не знайдено")
            f = (STATIC_DIR / path).resolve()
            if path and f.is_file() and STATIC_DIR.resolve() in f.parents:
                return FileResponse(f)
            return FileResponse(STATIC_DIR / "index.html")
    else:
        @app.get("/", include_in_schema=False)
        def root():
            return RedirectResponse("/docs")

    return app


app = create_app()
