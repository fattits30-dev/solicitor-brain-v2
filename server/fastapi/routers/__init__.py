from .auth import router as auth_router
from .users import router as users_router
from .cases import router as cases_router
from .documents import router as documents_router
from .chat import router as chat_router
from .drafts import router as drafts_router
from .health import router as health_router

__all__ = [
    "auth_router",
    "users_router", 
    "cases_router",
    "documents_router",
    "chat_router",
    "drafts_router",
    "health_router"
]