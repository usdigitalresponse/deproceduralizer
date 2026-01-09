"""
FastAPI Application for Prompt Optimization

Start the server:
    cd backend
    uvicorn api.main:app --reload --port 8000

Or with uv:
    cd backend
    uv run uvicorn api.main:app --reload --port 8000
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv
load_dotenv()

from .optimize import router as optimize_router
from .data_status import router as data_status_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events."""
    # Startup
    print("Starting Optimization API...")
    yield
    # Shutdown
    print("Shutting down Optimization API...")


app = FastAPI(
    title="Prompt Optimization API",
    description="DSPy-based prompt optimization for the Deproceduralizer",
    version="0.1.0",
    lifespan=lifespan
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://deproceduralizer.vercel.app",
        "https://deproceduralizer-evaluations.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# Include routers
app.include_router(optimize_router, prefix="/api/optimize", tags=["optimization"])
app.include_router(data_status_router, prefix="/api/data", tags=["data"])


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "status": "healthy",
        "service": "Prompt Optimization API",
        "version": "0.1.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
