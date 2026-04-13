from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.modules.center.routes import router as center_router
from app.modules.scheduling.routes import router as scheduling_router
from app.modules.assignment.routes import router as assignment_router
from app.modules.document.routes import router as document_router

app = FastAPI(
    title="نظام توزيع الحراسة",
    description="Exam Supervisor Assignment System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(center_router,     prefix="/api/v1")
app.include_router(scheduling_router, prefix="/api/v1")
app.include_router(assignment_router, prefix="/api/v1")
app.include_router(document_router,   prefix="/api/v1")


@app.get("/health")
def health():
    return {"status": "ok"}
