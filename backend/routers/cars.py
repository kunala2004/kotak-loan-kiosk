import json
from pathlib import Path
from fastapi import APIRouter
from pydantic import BaseModel
from agents.result_writer import write_car_reaction, recommend_cars_nlp

router = APIRouter(prefix="/cars", tags=["Cars"])

cars = json.loads((Path(__file__).parent.parent / "data/cars.json").read_text())


@router.get("/")
def get_cars(brand: str = None, segment: str = None, max_price: int = None):
    """Get car catalog with optional filters."""
    result = cars
    if brand:
        result = [c for c in result if c["brand"].lower() == brand.lower()]
    if segment:
        result = [c for c in result if c["segment"].lower() == segment.lower()]
    if max_price:
        result = [c for c in result if c["price"] <= max_price]
    return result


@router.get("/brands")
def get_brands():
    return list(set(c["brand"] for c in cars))


@router.get("/{car_id}")
def get_car(car_id: str):
    match = next((c for c in cars if c["id"] == car_id), None)
    if not match:
        return {"error": "Car not found"}
    return match


@router.post("/{car_id}/reaction")
def car_reaction(car_id: str):
    """LLM writes Priya's reaction to a car selection."""
    car = next((c for c in cars if c["id"] == car_id), None)
    if not car:
        return {"reaction": "Great choice!"}
    reaction = write_car_reaction(car["model"], car["brand"])
    return {"reaction": reaction}


class RecommendRequest(BaseModel):
    query: str


@router.post("/recommend")
def recommend_cars(req: RecommendRequest):
    """LLM parses natural language query and returns matching car IDs with reasoning."""
    result = recommend_cars_nlp(req.query, cars)
    return result
