from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.api.routes import (
    accounts,
    auth,
    cards,
    categories,
    copilot,
    dashboard,
    health,
    imports,
    insights,
    investments,
    planning,
    preferences,
    reports,
    transactions,
    wealth,
    workspaces,
)
from app.core.config import settings
from app.core.observability import access_log_middleware
from app.db.session import create_local_tables


def create_app() -> FastAPI:
    app = FastAPI(title="aws-smart-cash-flow API", version="0.1.0")

    app.middleware("http")(access_log_middleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(accounts.router, prefix="/v1")
    app.include_router(auth.router, prefix="/v1")
    app.include_router(imports.router, prefix="/v1")
    app.include_router(transactions.router, prefix="/v1")
    app.include_router(categories.router, prefix="/v1")
    app.include_router(cards.router, prefix="/v1")
    app.include_router(copilot.router, prefix="/v1")
    app.include_router(dashboard.router, prefix="/v1")
    app.include_router(insights.router, prefix="/v1")
    app.include_router(investments.router, prefix="/v1")
    app.include_router(planning.router, prefix="/v1")
    app.include_router(preferences.router, prefix="/v1")
    app.include_router(reports.router, prefix="/v1")
    app.include_router(wealth.router, prefix="/v1")
    app.include_router(workspaces.router, prefix="/v1")

    @app.on_event("startup")
    def startup() -> None:
        create_local_tables()

    return app


app = create_app()
handler = Mangum(app)
