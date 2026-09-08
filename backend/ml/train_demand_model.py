import os
import json
import math
import numpy as np
import joblib
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
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

def generate_domain_informed_dataset(n_samples: int = 1500, random_state: int = 42):
    """
    Generates a domain-informed synthetic dataset representing Indian artisan craft metrics.
    To avoid target leakage, future demand score (0-100) is generated via non-linear interactions
    (engagement velocity, price-to-cost competitiveness, inventory scarcity, category trends)
    combined with market noise.
    """
    np.random.seed(random_state)
    
    categories_encoded = np.random.randint(0, len(STANDARD_CATEGORIES), size=n_samples)
    material_costs = np.random.uniform(100, 3000, size=n_samples)
    labour_costs = np.random.uniform(150, 4000, size=n_samples)
    packaging_costs = np.random.uniform(20, 300, size=n_samples)
    other_costs = np.random.choice([0, 50, 100, 200, 500], size=n_samples, p=[0.4, 0.2, 0.2, 0.1, 0.1])
    
    total_costs = material_costs + labour_costs + packaging_costs + other_costs
    # Price set with random margin multiplier [1.15 to 2.50]
    margins = np.random.uniform(1.15, 2.50, size=n_samples)
    prices = total_costs * margins
    price_to_cost_ratios = prices / np.maximum(total_costs, 1.0)
    
    stocks = np.random.randint(0, 50, size=n_samples)
    views = np.random.randint(5, 500, size=n_samples)
    saves = np.random.randint(0, 80, size=n_samples)
    enquiries = np.random.randint(0, 30, size=n_samples)
    orders = np.random.randint(0, 25, size=n_samples)
    
    # Target: Future Demand Score (0-100) based on non-linear market velocity dynamics
    target_scores = []
    for i in range(n_samples):
        # 1. Base engagement velocity component (logarithmic engagement scaling)
        eng_score = (
            math.log1p(views[i]) * 2.2 +
            saves[i] * 3.0 +
            enquiries[i] * 5.5 +
            orders[i] * 9.0
        )
        
        # 2. Price competitiveness factor (sweet spot margin 1.2x - 1.6x gets boost, >2.0x penalized)
        p_ratio = price_to_cost_ratios[i]
        if 1.2 <= p_ratio <= 1.6:
            price_factor = 1.15
        elif p_ratio > 2.0:
            price_factor = 0.85
        else:
            price_factor = 1.0
            
        # 3. Inventory scarcity interaction
        stk = stocks[i]
        scarcity_factor = 1.10 if (0 < stk <= 5 and eng_score > 20) else 1.0
        
        # 4. Category trend boost
        cat = categories_encoded[i]
        cat_trend_boost = 1.12 if cat in [0, 4] else (0.95 if cat == 6 else 1.0)
        
        # Non-linear combination
        raw_demand = (eng_score * price_factor * scarcity_factor * cat_trend_boost)
        
        # Normalize into 0-100 scale using sigmoid/tanh scaling
        score = 100.0 * (1.0 - math.exp(-raw_demand / 75.0))
        
        # Add realistic market noise (Gaussian noise SD = 3.5)
        noisy_score = score + np.random.normal(0, 3.5)
        clamped_score = float(max(0.0, min(100.0, round(noisy_score, 2))))
        target_scores.append(clamped_score)
        
    X = np.column_stack([
        material_costs,
        labour_costs,
        packaging_costs,
        other_costs,
        total_costs,
        price_to_cost_ratios,
        stocks,
        categories_encoded,
        views,
        saves,
        enquiries,
        orders
    ])
    
    y = np.array(target_scores)
    feature_names = [
        "material_cost",
        "labour_cost",
        "packaging_cost",
        "other_cost",
        "total_cost",
        "price_to_cost_ratio",
        "stock",
        "category_encoded",
        "views",
        "saves",
        "enquiries",
        "orders"
    ]
    return X, y, feature_names

def train_and_save_model(output_dir: str = None):
    if output_dir is None:
        output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml")
    os.makedirs(output_dir, exist_ok=True)
    
    X, y, feature_names = generate_domain_informed_dataset(n_samples=1500, random_state=42)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train RandomForestRegressor (Tree splits do not require feature scaling)
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=12,
        min_samples_split=4,
        min_samples_leaf=2,
        random_state=42
    )
    rf.fit(X_train, y_train)
    
    # Predictions & dynamic metrics
    y_pred = rf.predict(X_test)
    r2 = float(r2_score(y_test, y_pred))
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(root_mean_squared_error(y_test, y_pred))
    
    importances = dict(zip(feature_names, [round(float(imp), 4) for imp in rf.feature_importances_]))
    
    # Model file paths
    model_path = os.path.join(output_dir, "demand_model.joblib")
    meta_path = os.path.join(output_dir, "model_meta.json")
    
    joblib.dump(rf, model_path)
    
    metadata = {
        "model_name": "RandomForestRegressor",
        "n_estimators": 100,
        "max_depth": 12,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "n_samples": len(X),
        "r2_score": round(r2, 4),
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "categories": STANDARD_CATEGORIES,
        "feature_names": feature_names,
        "feature_importances": importances,
        "training_mode": "DOMAIN_INFORMED_BOOTSTRAP"
    }
    
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"ML Model successfully trained and persisted:")
    print(f"  Model File: {model_path}")
    print(f"  Metadata File: {meta_path}")
    print(f"  Dynamic R² Score: {metadata['r2_score']}")
    print(f"  MAE: {metadata['mae']}")
    return metadata

if __name__ == "__main__":
    train_and_save_model()
