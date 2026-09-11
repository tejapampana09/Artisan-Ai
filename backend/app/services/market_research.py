import logging
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from backend.app.models import Product, MarketEvidence
from backend.app.services.ai_adapter import CATEGORY_MARKET_BENCHMARKS

logger = logging.getLogger("artisan_ai")

def to_decimal(val, default="0.00") -> Decimal:
    if val is None:
        return Decimal(default)
    return Decimal(str(val))

class MarketResearchService:
    """
    Evidence-based market research service for Artisan AI V2.
    Retrieves comparable craft products, calculates market range & median,
    and records evidence provenance.
    """
    def execute_market_research(
        self,
        db: Session,
        session_id: int,
        product_facts: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Extract verified facts
        def get_val(key: str) -> str:
            raw = product_facts.get(key)
            if isinstance(raw, dict):
                return str(raw.get("value", "")).strip()
            return str(raw or "").strip()

        p_name = get_val("product_name")
        cat = get_val("category") or "Handcrafted"
        mat = get_val("material")

        # 1. Query live published products matching category or title
        query = db.query(Product).filter(Product.status == "PUBLISHED")
        if cat:
            cat_query = query.filter(Product.category.ilike(f"%{cat}%"))
            matched_products = cat_query.limit(10).all()
        else:
            matched_products = query.limit(10).all()

        evidences = []
        observed_prices = []

        # Store observed market evidence records in DB
        for prod in matched_products:
            price_dec = to_decimal(prod.price)
            if price_dec > 0:
                observed_prices.append(price_dec)
                ev = MarketEvidence(
                    session_id=session_id,
                    product_id=prod.id,
                    source="OBSERVED_MARKET_DATA",
                    title=prod.title,
                    category=prod.category,
                    material=prod.materials,
                    listed_price=price_dec,
                    similarity_score=Decimal("0.900")
                )
                db.add(ev)
                evidences.append({
                    "source": "OBSERVED_MARKET_DATA",
                    "title": prod.title,
                    "category": prod.category,
                    "material": prod.materials,
                    "listed_price": float(price_dec),
                    "similarity_score": 0.90
                })

        db.commit()

        # 2. Benchmark fallback if insufficient live listings found
        if not observed_prices:
            benchmark = None
            for cat_key, bench in CATEGORY_MARKET_BENCHMARKS.items():
                if cat_key.lower() in cat.lower() or cat_key.lower() in p_name.lower():
                    benchmark = bench
                    break
            if not benchmark:
                benchmark = CATEGORY_MARKET_BENCHMARKS.get("Other", {"suggested": Decimal("1500.00"), "min": Decimal("1000.00")})

            min_b = benchmark["min"]
            sugg_b = benchmark["suggested"]
            observed_prices = [min_b, sugg_b]

            ev_model = MarketEvidence(
                session_id=session_id,
                source="MODEL_ESTIMATE",
                title=f"Category Benchmark: {cat}",
                category=cat,
                material=mat,
                listed_price=sugg_b,
                similarity_score=Decimal("0.800")
            )
            db.add(ev_model)
            db.commit()

            evidences.append({
                "source": "MODEL_ESTIMATE",
                "title": f"Category Benchmark: {cat}",
                "category": cat,
                "material": mat,
                "listed_price": float(sugg_b),
                "similarity_score": 0.80
            })

        # Calculate range and median
        observed_prices.sort()
        low_price = observed_prices[0]
        high_price = observed_prices[-1]
        
        # Calculate median
        n = len(observed_prices)
        if n % 2 == 1:
            median_price = observed_prices[n // 2]
        else:
            median_price = (observed_prices[n // 2 - 1] + observed_prices[n // 2]) / Decimal("2.0")

        return {
            "session_id": session_id,
            "market_range": {
                "low": float(low_price),
                "high": float(high_price)
            },
            "median": float(median_price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
            "comparable_count": len(observed_prices),
            "evidences": evidences
        }
