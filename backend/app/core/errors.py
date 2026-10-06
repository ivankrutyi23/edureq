"""Єдиний формат помилок API: {"status": 404, "message": "..."}."""
import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("edureg.api")


class AppError(Exception):
    """Помилка бізнес-логіки з HTTP-кодом і зрозумілим повідомленням."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message


def _body(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"status": status, "message": message})


def _translate(err: dict) -> str:
    """Переклад типових повідомлень Pydantic українською."""
    t, ctx = err.get("type", ""), err.get("ctx", {})
    if t == "string_too_short":
        return f"занадто короткий (мінімум {ctx.get('min_length')} симв.)"
    if t == "string_too_long":
        return f"занадто довгий (максимум {ctx.get('max_length')} симв.)"
    if t == "missing":
        return "обов'язкове поле"
    if t == "greater_than_equal":
        return f"значення має бути не менше {ctx.get('ge')}"
    if t == "less_than_equal":
        return f"значення має бути не більше {ctx.get('le')}"
    if t in ("int_parsing", "int_from_float", "int_type"):
        return "має бути цілим числом"
    if t.startswith("datetime") or t.startswith("date_"):
        return "некоректна дата або час"
    if t in ("enum", "literal_error"):
        return "недопустиме значення"
    if t == "bool_parsing":
        return "має бути логічним значенням"
    if t == "value_error":
        msg = str(ctx.get("error", err["msg"]))
        if "email" in msg.lower() or "@" in msg:
            return "некоректна адреса електронної пошти"
        return msg
    return err["msg"]


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return _body(exc.status_code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        # 400 замість стандартного 422; повідомлення українською
        err = exc.errors()[0]
        field = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
        text = _translate(err)
        return _body(400, f"Некоректні дані ({field}): {text}" if field else f"Некоректні дані: {text}")

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        text = {404: "Ресурс не знайдено", 405: "Метод не дозволено"}.get(exc.status_code, str(exc.detail))
        return _body(exc.status_code, text)

    @app.exception_handler(Exception)
    async def unhandled(_: Request, exc: Exception):
        log.exception("Необроблена помилка: %s", exc)
        return _body(500, "Внутрішня помилка сервера")
