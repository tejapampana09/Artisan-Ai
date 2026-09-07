from typing import Dict, Any, List
from backend.app.models import Product

def calculate_product_readiness(product: Product) -> Dict[str, Any]:
    """
    Computes an explainable 0-100 Artisan Business Readiness score for a product.
    Includes strengths, next improvements, and a specific Next Best Action.
    """
    score = 0
    strengths: List[str] = []
    improvements: List[str] = []

    # 1. Product Info (25 pts)
    if product.title and len(product.title) >= 3:
        score += 10
        strengths.append("Product title configured")
    else:
        improvements.append("Add clear product title")

    if product.description and len(product.description) >= 10:
        score += 10
        strengths.append("Marketplace description ready")
    else:
        improvements.append("Expand marketplace product description")

    if product.materials and product.materials != "Needs artisan confirmation":
        score += 5
        strengths.append("Raw materials specified")
    else:
        improvements.append("Specify natural raw materials used")

    # 2. Images & Presentation (25 pts)
    if product.image_url:
        score += 15
        strengths.append("Original craft photo attached")
    else:
        improvements.append("Capture or upload craft photograph")

    if product.enhanced_image_url and product.enhanced_image_url != product.image_url:
        score += 10
        strengths.append("AI photo studio enhancement applied")
    elif product.image_url:
        score += 5
        improvements.append("Apply AI photo studio lighting enhancement")

    # 3. Pricing & Cost Transparency (25 pts)
    mat = float(product.material_cost or 0)
    lab = float(product.labour_cost or 0)
    pkg = float(product.packaging_cost or 0)
    cost_basis = mat + lab + pkg

    if cost_basis > 0:
        score += 15
        strengths.append(f"Transparent cost structure recorded (₹{cost_basis:.0f})")
    else:
        improvements.append("Record direct material & labour costs to protect fair price")

    if float(product.price or 0) > 0:
        score += 10
        strengths.append(f"Selling price set (₹{float(product.price):.0f})")
    else:
        improvements.append("Set selling price")

    # 4. Craft Story & Provenance (15 pts)
    if product.craft_story and len(product.craft_story) >= 15:
        score += 15
        strengths.append("Heritage craft story & technique documented")
    else:
        improvements.append("Add making process & heritage craft story")

    # 5. Inventory & Stock (10 pts)
    if product.stock > 0:
        score += 10
        strengths.append(f"Stock available ({product.stock} units)")
    else:
        improvements.append("Update stock inventory")

    # Determine Next Best Action
    if "Add making process & heritage craft story" in improvements:
        next_best_action = "Add the traditional making process to your Craft Passport to improve buyer trust."
    elif "Record direct material & labour costs to protect fair price" in improvements:
        next_best_action = "Input your material and labour costs to establish an explainable minimum fair price."
    elif "Apply AI photo studio lighting enhancement" in improvements:
        next_best_action = "Use the AI Studio to generate professional backdrop lighting for your craft."
    elif "Expand marketplace product description" in improvements:
        next_best_action = "Use Voice AI to describe your craft techniques in detail."
    elif improvements:
        next_best_action = f"Improve readiness by addressing: {improvements[0]}."
    else:
        next_best_action = "Your craft is 100% market-ready! Publish to additional sales channels."

    return {
        "product_id": product.id,
        "score": min(100, score),
        "strengths": strengths,
        "improvements": improvements,
        "next_best_action": next_best_action
    }

def calculate_artisan_overall_readiness(products: List[Product]) -> Dict[str, Any]:
    """
    Computes overall business readiness across all products listed by an artisan.
    """
    if not products:
        return {
            "score": 0,
            "strengths": ["Account created"],
            "improvements": ["Create your first craft draft using Voice AI"],
            "next_best_action": "Click 'Create with AI' and speak in your native language to list your first craft."
        }

    readinesses = [calculate_product_readiness(p) for p in products]
    avg_score = round(sum(r["score"] for r in readinesses) / len(readinesses))
    
    # Collect all improvements across products
    all_improvements = []
    for r in readinesses:
        all_improvements.extend(r["improvements"])

    unique_improvements = list(dict.fromkeys(all_improvements))

    return {
        "score": avg_score,
        "total_products": len(products),
        "product_readiness_list": readinesses,
        "strengths": [f"{len(products)} craft product(s) active"],
        "improvements": unique_improvements[:5],
        "next_best_action": readinesses[0]["next_best_action"] if readinesses else "Add products"
    }
