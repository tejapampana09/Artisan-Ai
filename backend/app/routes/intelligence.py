from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, Product, Order, Enquiry, Event
from backend.app.schemas import (
    SellerDashboardResponse, DeliveryStatusBreakdown, ProductPerformance,
    BuyerCopilotRequest, BuyerCopilotResponse, ProductResponse
)
from backend.app.services.auth import get_current_user, get_optional_current_user
from backend.app.services.demand_engine import calculate_category_demand, generate_seller_opportunities
from backend.app.services.readiness_engine import calculate_artisan_overall_readiness

router = APIRouter(prefix="/api", tags=["Market Intelligence & Seller Copilot"])

@router.get("/market/demand")
def get_market_demand(db: Session = Depends(get_db)):
    return calculate_category_demand(db)

@router.get("/seller/readiness")
def get_seller_readiness(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seller_products = db.query(Product).filter(Product.seller_id == current_user.id).all()
    return calculate_artisan_overall_readiness(seller_products)

@router.get("/seller/opportunities")
def get_seller_opportunities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return generate_seller_opportunities(db, current_user.id)

@router.get("/seller/copilot-insight")
def get_copilot_insight(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = generate_seller_opportunities(db, current_user.id)
    return result["copilot_insight"]

@router.get("/seller/dashboard", response_model=SellerDashboardResponse)
def get_seller_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    seller_products = db.query(Product).filter(Product.seller_id == current_user.id).all()
    seller_product_ids = [p.id for p in seller_products]

    if not seller_product_ids:
        return SellerDashboardResponse(
            total_revenue=0.0,
            units_sold=0,
            total_orders=0,
            total_views=0,
            total_enquiries=0,
            delivery_status=DeliveryStatusBreakdown(),
            product_performance=[]
        )

    orders = db.query(Order).filter(Order.product_id.in_(seller_product_ids)).all()
    enquiries_count = db.query(Enquiry).filter(Enquiry.product_id.in_(seller_product_ids)).count()

    event_views = db.query(Event).filter(
        Event.product_id.in_(seller_product_ids),
        Event.event_type.in_(["VIEW", "SEARCH", "SAVE"])
    ).all()
    
    views_by_prod = {}
    for ev in event_views:
        views_by_prod[ev.product_id] = views_by_prod.get(ev.product_id, 0) + 1
        
    total_views = sum(views_by_prod.values())

    status_counts = {"CONFIRMED": 0, "PROCESSING": 0, "SHIPPED": 0, "DELIVERED": 0, "CANCELLED": 0}
    total_revenue = 0.0
    units_sold = 0
    
    prod_stats = {
        p.id: {"units_sold": 0, "revenue": 0.0, "orders_count": 0}
        for p in seller_products
    }

    for ord in orders:
        st = (ord.status or "CONFIRMED").upper()
        if st in status_counts:
            status_counts[st] += 1
            
        if st != "CANCELLED":
            tot = float(ord.total_price or 0.0)
            total_revenue += tot
            units_sold += ord.quantity
            
            if ord.product_id in prod_stats:
                prod_stats[ord.product_id]["units_sold"] += ord.quantity
                prod_stats[ord.product_id]["revenue"] += tot
                prod_stats[ord.product_id]["orders_count"] += 1

    perf_list = []
    for p in seller_products:
        st = prod_stats.get(p.id, {"units_sold": 0, "revenue": 0.0, "orders_count": 0})
        perf_list.append(ProductPerformance(
            product_id=p.id,
            title=p.title,
            category=p.category,
            price=float(p.price),
            stock=p.stock,
            status=p.status,
            image_url=p.image_url,
            views=views_by_prod.get(p.id, 0),
            units_sold=st["units_sold"],
            revenue=st["revenue"],
            orders_count=st["orders_count"]
        ))

    return SellerDashboardResponse(
        total_revenue=total_revenue,
        units_sold=units_sold,
        total_orders=len(orders),
        total_views=total_views,
        total_enquiries=enquiries_count,
        delivery_status=DeliveryStatusBreakdown(
            confirmed=status_counts["CONFIRMED"],
            processing=status_counts["PROCESSING"],
            shipped=status_counts["SHIPPED"],
            delivered=status_counts["DELIVERED"],
            cancelled=status_counts["CANCELLED"]
        ),
        product_performance=perf_list
    )

from fastapi.responses import Response
import csv
import io

@router.get("/seller/analytics/export")
def export_seller_analytics_csv(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Generates a downloadable CSV report of seller products, cost basis, margins, and sales volume."""
    seller_products = db.query(Product).filter(Product.seller_id == current_user.id).all()
    seller_product_ids = [p.id for p in seller_products]

    output = io.StringIO()
    writer = csv.writer(output)

    # Write Header
    writer.writerow([
        "Product ID", "Title", "Category", "Listing Price (INR)", "Stock Available",
        "Material Cost", "Labour Cost", "Packaging Cost", "Protected Margin %",
        "Units Sold", "Total Revenue (INR)", "Status"
    ])

    if seller_product_ids:
        orders = db.query(Order).filter(Order.product_id.in_(seller_product_ids)).all()
        sales_map = {}
        for ord in orders:
            if (ord.status or "CONFIRMED").upper() != "CANCELLED":
                if ord.product_id not in sales_map:
                    sales_map[ord.product_id] = {"units": 0, "revenue": 0.0}
                sales_map[ord.product_id]["units"] += ord.quantity
                sales_map[ord.product_id]["revenue"] += float(ord.total_price or 0.0)

        for p in seller_products:
            st = sales_map.get(p.id, {"units": 0, "revenue": 0.0})
            writer.writerow([
                p.id,
                p.title,
                p.category,
                f"{float(p.price):.2f}",
                p.stock,
                f"{float(p.material_cost):.2f}",
                f"{float(p.labour_cost):.2f}",
                f"{float(p.packaging_cost):.2f}",
                f"{float(p.min_margin_pct * 100):.1f}%",
                st["units"],
                f"{st['revenue']:.2f}",
                p.status
            ])

    filename = f"Artisan_Analytics_Report_{current_user.id}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/buyer/copilot-chat", response_model=BuyerCopilotResponse)
def buyer_copilot_chat(
    req: BuyerCopilotRequest,
    db: Session = Depends(get_db)
):
    """
    Multilingual AI Buyer Guide & Live Marketplace Search Engine:
    Parses buyer's query for category, keywords, and budget constraints.
    Searches published crafts in SQLite live database and returns structured recommendations
    with tailored responses in Telugu, Hindi, English, Tamil, or Bengali.
    """
    import re
    raw_msg = (req.message or "").strip().lower()
    lang = (req.language or "te").lower()

    # 1. Parse budget threshold
    budget = req.max_budget
    if not budget:
        # Regex for price patterns like '1000', '2000', '500'
        budget_match = re.search(r'(?:under|below|lopu|less than|₹|rs|రూ|రూపాయల|\bs\b)?\s*(\d{3,6})', raw_msg)
        if budget_match:
            try:
                budget = float(budget_match.group(1))
            except ValueError:
                budget = None

    # 2. Detect category / craft keywords
    cat_keywords = {
        "Kalamkari": ["kalamkari", "దుపట్టా", "కలంకారి", "कलमकारी", "saree", "dupatta", "fabric"],
        "Wooden Toys": ["toy", "wooden", "channapatna", "బొమ్మలు", "చెక్క", "खिलौने", "लकड़ी", "sculpture"],
        "Blue Pottery": ["pottery", "blue pottery", "bowl", "పాట్టరీ", "జైపూర్", "पॉटरी"],
        "Bidriware": ["bidri", "bidriware", "silver", "బిద్రి", "बीदरी"],
        "Pochampally Ikat": ["ikat", "pochampally", "పోచంపల్లి", "इकत"],
        "Terracotta": ["terracotta", "clay", "మట్టి", "मिट्टी"],
        "Handloom": ["handloom", "shawl", "హ్యాండ్‌లూమ్", "हैंडलूम"]
    }

    matched_cat = req.category
    if not matched_cat:
        for cat, keywords in cat_keywords.items():
            if any(kw in raw_msg for kw in keywords):
                matched_cat = cat
                break

    # 3. Perform Live Database Query
    query = db.query(Product).filter(Product.status == "PUBLISHED")

    if matched_cat:
        query = query.filter(Product.category == matched_cat)

    if budget and budget > 0:
        query = query.filter(Product.price <= budget)

    # General keyword search if specific words present
    words = [w for w in re.findall(r'\w+', raw_msg) if len(w) > 2 and w not in ["want", "show", "need", "give", "kavali", "kaho", "chupinchu", "kya", "have"]]
    if words:
        from sqlalchemy import or_
        filters = []
        for word in words:
            filters.append(Product.title.ilike(f"%{word}%"))
            filters.append(Product.description.ilike(f"%{word}%"))
            filters.append(Product.category.ilike(f"%{word}%"))
            filters.append(Product.materials.ilike(f"%{word}%"))
        query = query.filter(or_(*filters))

    matching_products = query.order_by(Product.id.desc()).limit(6).all()

    # Fallback to top published products if specific search yielded no results
    if not matching_products:
        matching_products = db.query(Product).filter(Product.status == "PUBLISHED").order_by(Product.id.desc()).limit(6).all()

    match_count = len(matching_products)

    # 4. Generate Natural Language Response by Language
    if lang == "te":
        if match_count > 0:
            reply = f"అభివందనాలు! మీ కోరిక ('{req.message}') ప్రకారం లైవ్ మార్కెట్‌ప్లేస్‌లో శోధించాను. ఇక్కడ మీకోసం {match_count} అథెంటిక్ చేతివృత్తుల కళారూపాలు లభించాయి:"
        else:
            reply = "మీరు కోరిన వివరాలకు ఉత్పత్తులు లైవ్‌లో లభించాయి. మా ప్రాచుర్యం పొందిన కొన్ని విశిష్ట ఉత్పత్తులు ఇవిగోండి:"
    elif lang == "hi":
        if match_count > 0:
            reply = f"नमस्ते! आपकी खोज ('{req.message}') के अनुसार लाइव मार्केटप्लेस में {match_count} प्रामाणिक हस्तशिल्प उत्पाद मिले हैं:"
        else:
            reply = "आपकी पसंद के अनुसार हमारे लोकप्रिय कारीगर उत्पाद यहाँ दिए गए हैं:"
    elif lang == "ta":
        reply = f"வணக்கம்! உங்கள் தேடலின் படி ({match_count}) நேரலை கைவினைப்பொருட்கள் கண்டறியப்பட்டுள்ளன:"
    elif lang == "bn":
        reply = f"নমস্কার! আপনার অনুসন্ধান অনুযায়ী ({match_count}) কারিগর সামগ্রী পাওয়া গেছে:"
    else: # English
        if match_count > 0:
            reply = f"Hello! I searched our live database for '{req.message}'. Here are {match_count} authentic master artisan crafts matching your query:"
        else:
            reply = "Here are top certified GI heritage crafts curated for you:"

    return BuyerCopilotResponse(
        reply_text=reply,
        language=lang,
        recommended_products=[
            ProductResponse.model_validate(p) for p in matching_products
        ],
        search_query_used=req.message,
        match_count=match_count
    )

