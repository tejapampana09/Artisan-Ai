import os
import json
import math
import numpy as np
import joblib
from typing import Any, Optional, Dict, Tuple
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error, root_mean_squared_error

STANDARD_CATEGORIES = [
    "Kalamkari",
    "Wooden Toys",
    "Blue Pottery",
    "Bidriware",
    "Pochampally Ikat",
    "Handloom",
    "Other"
]

def generate_chronological_snapshot_dataset(n_products: int = 100, n_timesteps: int = 15, random_state: int = 42):
    """
    Generates a true chronological multi-snapshot time-series dataset (T -> T+7).
    
    Data Structure:
      - Each product is observed over time steps t = 0..n_timesteps-1 (representing weekly snapshots).
      - Features X(t) are measured strictly from data available at or before time t.
      - Target y(t) represents the ground-truth actual demand / orders realized in the subsequent 7-day window [t, t+1].
      - No lookahead leakage: features at t contain zero information from [t, t+1].
      - Rows are ordered strictly by timestamp t to allow temporal splitting.
    """
    np.random.seed(random_state)
    
    rows = []
    
    for pid in range(n_products):
        cat_idx = np.random.randint(0, len(STANDARD_CATEGORIES))
        base_mat_cost = np.random.uniform(100, 3000)
        base_lab_cost = np.random.uniform(150, 4000)
        pkg_cost = np.random.uniform(20, 300)
        oth_cost = float(np.random.choice([0, 50, 100, 200]))
        tot_cost = base_mat_cost + base_lab_cost + pkg_cost + oth_cost
        
        # Base price multiplier [1.15 to 2.40]
        margin_mult = np.random.uniform(1.15, 2.40)
        price = tot_cost * margin_mult
        p_ratio = price / max(tot_cost, 1.0)
        
        # Product intrinsic baseline popularity
        base_popularity = np.random.uniform(0.5, 3.0)
        
        # Accumulators over time
        cum_views = 0
        cum_saves = 0
        cum_enquiries = 0
        cum_orders = 0
        current_stock = np.random.randint(10, 50)
        
        for t in range(n_timesteps):
            # Time t features (strictly historical snapshot up to t)
            views_at_t = cum_views
            saves_at_t = cum_saves
            enquiries_at_t = cum_enquiries
            orders_at_t = cum_orders
            stock_at_t = current_stock
            
            # Ground-truth demand realized in the subsequent 7-day window [t, t+1]
            # Driven by intrinsic popularity, price competitiveness, seasonal trend, and accumulated interest
            seasonal_trend = 1.0 + 0.3 * math.sin(2 * math.pi * t / 12.0)
            price_factor = 1.20 if 1.2 <= p_ratio <= 1.6 else (0.80 if p_ratio > 2.0 else 1.0)
            scarcity_boost = 1.15 if (0 < stock_at_t <= 5 and (views_at_t + saves_at_t) > 15) else 1.0
            
            # Non-linear conversion rate for future 7-day period
            future_demand_rate = (
                base_popularity * seasonal_trend * price_factor * scarcity_boost *
                (1.0 + math.log1p(views_at_t) * 0.15 + saves_at_t * 0.05 + enquiries_at_t * 0.10)
            )
            
            # Realized future 7-day conversion outcome (T -> T+7)
            future_orders_next_7d = np.random.poisson(max(0.1, future_demand_rate * 1.5))
            future_views_next_7d = int(future_orders_next_7d * np.random.uniform(8.0, 15.0) + np.random.randint(5, 20))
            future_saves_next_7d = int(future_orders_next_7d * np.random.uniform(1.5, 3.0))
            future_enquiries_next_7d = int(future_orders_next_7d * np.random.uniform(0.5, 1.5))
            
            # Target Score (0-100) based strictly on realized future 7-day conversion outcome [t, t+1]
            raw_target_demand = (
                future_views_next_7d * 0.08 +
                future_saves_next_7d * 0.40 +
                future_enquiries_next_7d * 1.20 +
                future_orders_next_7d * 4.50
            )
            target_score_next_7d = float(max(0.0, min(100.0, round(100.0 * (1.0 - math.exp(-raw_target_demand / 60.0)), 2))))
            
            rows.append({
                "t": t,
                "pid": pid,
                "material_cost": base_mat_cost,
                "labour_cost": base_lab_cost,
                "packaging_cost": pkg_cost,
                "other_cost": oth_cost,
                "total_cost": tot_cost,
                "price_to_cost_ratio": p_ratio,
                "stock": stock_at_t,
                "category_encoded": cat_idx,
                "views": views_at_t,
                "saves": saves_at_t,
                "enquiries": enquiries_at_t,
                "orders": orders_at_t,
                "target_demand_next_7d": target_score_next_7d
            })
            
            # Update accumulators for next time step
            cum_views += future_views_next_7d
            cum_saves += future_saves_next_7d
            cum_enquiries += future_enquiries_next_7d
            cum_orders += future_orders_next_7d
            current_stock = max(0, current_stock - future_orders_next_7d)

    # Sort strictly by timestamp t to enforce chronological structure
    rows.sort(key=lambda r: (r["t"], r["pid"]))
    
    feature_names = [
        "material_cost", "labour_cost", "packaging_cost", "other_cost",
        "total_cost", "price_to_cost_ratio", "stock", "category_encoded",
        "views", "saves", "enquiries", "orders"
    ]
    
    X = np.array([[r[f] for f in feature_names] for r in rows])
    y = np.array([r["target_demand_next_7d"] for r in rows])
    timestamps = np.array([r["t"] for r in rows])
    
    return X, y, timestamps, feature_names

MIN_PRODUCTION_PRODUCTS = 20
MIN_PRODUCTION_EVENTS = 200
MIN_PRODUCTION_DAYS = 14

def extract_db_dataset(db):
    """
    Extracts chronological time-series snapshot dataset directly from database products and events.
    Strictly enforces T -> T+7 forward calendar window:
      - Snapshot Cutoff T: specific calendar checkpoint
      - Historical Features X(T): interaction events in [T - 30d, T]
      - Forward Target y(T): realized conversion events in (T, T + 7d]
      - Snapshot timestamp: T.timestamp() (real temporal sequence for holdout split)

    Requires minimum dataset thresholds (20 published products, 200 events, 14 days telemetry)
    to qualify for genuine production model training.
    """
    from datetime import timedelta
    from backend.app.models import Product, Event
    
    # 1. Check volume prerequisites
    published_products = db.query(Product).filter(
        Product.status.in_(["PUBLISHED", "ACTIVE"])
    ).all()
    
    total_events = db.query(Event).filter(Event.timestamp != None).all()
    if len(published_products) < MIN_PRODUCTION_PRODUCTS or len(total_events) < MIN_PRODUCTION_EVENTS:
        return None, None, None, None, 0

    earliest_event = min(e.timestamp for e in total_events if e.timestamp)
    latest_event = max(e.timestamp for e in total_events if e.timestamp)
    if (latest_event - earliest_event).days < MIN_PRODUCTION_DAYS:
        return None, None, None, None, 0

    cat_map = {cat.lower(): idx for idx, cat in enumerate(STANDARD_CATEGORIES)}
    rows = []

    # Generate sliding weekly checkpoints: T = earliest + 7d, 14d, 21d... up to latest - 7d
    current_T = earliest_event + timedelta(days=7)
    max_T = latest_event - timedelta(days=7)

    while current_T <= max_T:
        for p in published_products:
            mat = float(p.material_cost or 0.0)
            lab = float(p.labour_cost or 0.0)
            pkg = float(p.packaging_cost or 0.0)
            oth = float(p.other_cost or 0.0)
            tot = mat + lab + pkg + oth
            price = float(p.price or 0.0)
            p_ratio = round(price / max(tot, 1.0), 3)
            stock = int(p.stock or 0)
            cat_idx = cat_map.get((p.category or "").lower(), len(STANDARD_CATEGORIES) - 1)

            # Historical window: [T - 30d, T]
            hist_start = current_T - timedelta(days=30)
            hist_events = db.query(Event).filter(
                Event.product_id == p.id,
                Event.timestamp >= hist_start,
                Event.timestamp <= current_T
            ).all()

            views = sum(1 for e in hist_events if e.event_type == "VIEW")
            saves = sum(1 for e in hist_events if e.event_type == "SAVE")
            enquiries = sum(1 for e in hist_events if e.event_type == "ENQUIRY")
            orders = sum(1 for e in hist_events if e.event_type == "ORDER")

            # Forward 7-day window: (T, T + 7d]
            fwd_end = current_T + timedelta(days=7)
            fwd_events = db.query(Event).filter(
                Event.product_id == p.id,
                Event.timestamp > current_T,
                Event.timestamp <= fwd_end
            ).all()

            f_views = sum(1 for e in fwd_events if e.event_type == "VIEW")
            f_saves = sum(1 for e in fwd_events if e.event_type == "SAVE")
            f_enquiries = sum(1 for e in fwd_events if e.event_type == "ENQUIRY")
            f_orders = sum(1 for e in fwd_events if e.event_type == "ORDER")

            # Target Score: realized conversion in [T, T + 7d]
            future_conversion = (f_views * 0.08) + (f_saves * 0.40) + (f_enquiries * 1.20) + (f_orders * 4.50)
            p_factor = 1.15 if 1.2 <= p_ratio <= 1.6 else (0.85 if p_ratio > 2.0 else 1.0)
            scarcity = 1.10 if (0 < stock <= 5 and (views + saves) > 15) else 1.0
            raw_demand = future_conversion * p_factor * scarcity * 10.0
            target_score = float(max(0.0, min(100.0, round(100.0 * (1.0 - math.exp(-raw_demand / 60.0)), 2))))

            rows.append({
                "t": current_T.timestamp(),  # Genuine chronological float timestamp
                "material_cost": mat,
                "labour_cost": lab,
                "packaging_cost": pkg,
                "other_cost": oth,
                "total_cost": tot,
                "price_to_cost_ratio": p_ratio,
                "stock": stock,
                "category_encoded": cat_idx,
                "views": views,
                "saves": saves,
                "enquiries": enquiries,
                "orders": orders,
                "target": target_score
            })

        current_T += timedelta(days=7)

    if not rows:
        return None, None, None, None, 0

    feature_names = [
        "material_cost", "labour_cost", "packaging_cost", "other_cost",
        "total_cost", "price_to_cost_ratio", "stock", "category_encoded",
        "views", "saves", "enquiries", "orders"
    ]
    X = np.array([[r[f] for f in feature_names] for r in rows])
    y = np.array([r["target"] for r in rows])
    timestamps = np.array([r["t"] for r in rows])
    return X, y, timestamps, feature_names, len(rows)

def train_and_save_model(output_dir: str = None, db: Any = None):
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml")
    os.makedirs(output_dir, exist_ok=True)
    
    training_mode = "DOMAIN_INFORMED_SNAPSHOT_SERIES"
    X, y, timestamps, feature_names = None, None, None, None
    
    if db is not None:
        X_db, y_db, ts_db, f_names, n_db = extract_db_dataset(db)
        if n_db >= 20:
            X, y, timestamps, feature_names = X_db, y_db, ts_db, f_names
            training_mode = "PRODUCTION_REAL_EVENTS_TIME_SERIES"

    if X is None or len(X) < 20:
        X, y, timestamps, feature_names = generate_chronological_snapshot_dataset(n_products=100, n_timesteps=15, random_state=42)
        training_mode = "DOMAIN_INFORMED_SNAPSHOT_SERIES"

    # Strict Chronological Time Cutoff Split (Train: past 80% time steps -> Validation: future 20% holdout)
    unique_t = np.unique(timestamps)
    unique_t.sort()
    cutoff_idx = int(len(unique_t) * 0.8)
    cutoff_time = unique_t[cutoff_idx] if len(unique_t) > 1 else unique_t[0]

    train_mask = timestamps < cutoff_time
    test_mask = timestamps >= cutoff_time

    # Fallback if split yields empty set
    if not np.any(train_mask) or not np.any(test_mask):
        split_idx = int(len(X) * 0.8)
        X_train, X_test = X[:split_idx], X[split_idx:]
        y_train, y_test = y[:split_idx], y[split_idx:]
    else:
        X_train, X_test = X[train_mask], X[test_mask]
        y_train, y_test = y[train_mask], y[test_mask]

    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_split=2 if "PRODUCTION" in training_mode else 4,
        min_samples_leaf=1 if "PRODUCTION" in training_mode else 2,
        random_state=42
    )
    rf.fit(X_train, y_train)
    
    y_pred = rf.predict(X_test)
    r2 = float(r2_score(y_test, y_pred))
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(root_mean_squared_error(y_test, y_pred))
    
    importances = dict(zip(feature_names, [round(float(imp), 4) for imp in rf.feature_importances_]))
    
    model_path = os.path.join(output_dir, "demand_model.joblib")
    meta_path = os.path.join(output_dir, "model_meta.json")
    
    joblib.dump(rf, model_path)
    
    metadata = {
        "model_name": "RandomForestRegressor",
        "n_estimators": 100,
        "max_depth": 12,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": len(X),
        "time_series_split": True,
        "temporal_cutoff_time": float(cutoff_time),
        "r2_score": round(r2, 4),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "categories": STANDARD_CATEGORIES,
        "feature_names": feature_names,
        "feature_importances": importances,
        "training_mode": training_mode,
        "target_horizon": "7_DAYS_FORWARD",
        "target_description": "Projected consumer demand score (0-100) realized in subsequent 7-day window [T, T+7]"
    }
    
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"ML Model successfully trained and persisted:")
    print(f"  Model File: {model_path}")
    print(f"  Metadata File: {meta_path}")
    print(f"  Dynamic R² Score: {metadata['r2_score']}")
    print(f"  Training Mode: {training_mode}")
    return metadata

if __name__ == "__main__":
    try:
        from backend.app.database import SessionLocal
        with SessionLocal() as db:
            train_and_save_model(db=db)
    except Exception as e:
        print(f"Running standalone training without live DB: {e}")
        train_and_save_model()
