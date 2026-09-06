from sqlalchemy.orm import Session
from backend.app.models import Product, User

SAMPLE_PRODUCTS = [
    {
        "title": "Hand-painted Tree of Life Kalamkari Saree",
        "description": "Authentic Srikalahasti style hand-painted Kalamkari saree depicting the sacred Tree of Life with peacocks and floral vine borders.",
        "craft_story": "Created using bamboo kalam and 100% natural vegetable pigments (indigo, madder, turmeric, pomegranate rind). Washed in flowing river water and treated with buffalo milk.",
        "category": "Kalamkari",
        "materials": "Pure Mulberry Silk, Natural Dyes, Tamarind Twig Ink",
        "price": 1250.0,
        "stock": 6,
        "image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
        "enhanced_image_url": "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80",
        "status": "PUBLISHED",
        "material_cost": 480.0,
        "labour_cost": 420.0,
        "packaging_cost": 60.0,
        "min_margin_pct": 0.20,
    },
    {
        "title": "Channapatna Hand-turned Wooden Rocking Horse",
        "description": "Traditional non-toxic GI-tagged wooden rocking horse crafted for toddlers using child-safe organic lac dyes.",
        "craft_story": "Handcrafted on traditional wood-turning lathes by hereditary toy artisans using seasoned Wrightia tinctoria wood and polished with natural kiwi leaves.",
        "category": "Wooden Toys",
        "materials": "Ivory Wood (Aale Mara), Natural Lacquer, Turmeric & Indigo dye",
        "price": 850.0,
        "stock": 14,
        "image_url": "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80",
        "enhanced_image_url": "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop&q=80",
        "status": "PUBLISHED",
        "material_cost": 260.0,
        "labour_cost": 310.0,
        "packaging_cost": 50.0,
        "min_margin_pct": 0.20,
    },
    {
        "title": "Jaipur Handcrafted Blue Pottery Floral Urn",
        "description": "Exquisite Persian floral motif vase sculpted without clay using traditional quartz stone slurry technique.",
        "craft_story": "Glazed with Egyptian blue cobalt oxide and hand-painted with intricate Mughal botanical patterns, fired in wood-fueled kilns.",
        "category": "Blue Pottery",
        "materials": "Ground Quartz, Glass, Natural Multani Mitti, Cobalt Oxide",
        "price": 1650.0,
        "stock": 8,
        "image_url": "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80",
        "enhanced_image_url": "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=800&auto=format&fit=crop&q=80",
        "status": "PUBLISHED",
        "material_cost": 520.0,
        "labour_cost": 620.0,
        "packaging_cost": 120.0,
        "min_margin_pct": 0.20,
    },
    {
        "title": "Bidriware Pure Silver Wire Inlay Trinket Box",
        "description": "Masterpiece zinc-copper alloy box featuring intricate silver inlay geometry preserved with soil from Bidar Fort.",
        "craft_story": "Centuries-old metal craft of Bidar where pure 99.9% silver wire is gently hammered into engraved blackened metal alloys.",
        "category": "Bidriware",
        "materials": "Zinc-Copper Alloy, 99.9% Pure Silver Wire",
        "price": 2100.0,
        "stock": 5,
        "image_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
        "enhanced_image_url": "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=80",
        "status": "PUBLISHED",
        "material_cost": 720.0,
        "labour_cost": 810.0,
        "packaging_cost": 100.0,
        "min_margin_pct": 0.20,
    }
]

def seed_sample_products(db: Session, seller_id: int):
    """
    Idempotent product seeding: ensures every baseline sample product
    exists in the database, avoiding state drift between test runs or sessions.
    """
    for p in SAMPLE_PRODUCTS:
        existing = db.query(Product).filter(Product.title == p["title"]).first()
        if not existing:
            prod = Product(**p, seller_id=seller_id)
            db.add(prod)
    db.commit()
