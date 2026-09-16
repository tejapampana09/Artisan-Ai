from sqlalchemy.orm import Session
from backend.app.models import Product

SAMPLE_PRODUCTS = [
    {
        "title": "Hand-painted Tree of Life Kalamkari Saree",
        "description": "Authentic Srikalahasti style hand-painted Kalamkari saree depicting the sacred Tree of Life with peacocks and floral vine borders.",
        "craft_story": "Created using bamboo kalam and 100% natural vegetable pigments (indigo, madder, turmeric, pomegranate rind). Washed in flowing river water and treated with buffalo milk.",
        "category": "Kalamkari",
        "materials": "Pure Mulberry Silk, Natural Dyes, Tamarind Twig Ink",
        "price": 1250.0,
        "stock": 6,
        "image_url": None,
        "enhanced_image_url": None,
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
        "image_url": None,
        "enhanced_image_url": None,
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
        "image_url": None,
        "enhanced_image_url": None,
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
        "image_url": None,
        "enhanced_image_url": None,
        "status": "PUBLISHED",
        "material_cost": 720.0,
        "labour_cost": 810.0,
        "packaging_cost": 100.0,
        "min_margin_pct": 0.20,
    }
]

def seed_sample_products(db: Session, seller_id: int):
    """
    Idempotent product seeding for testing fixtures.
    """
    for p in SAMPLE_PRODUCTS:
        existing = db.query(Product).filter(Product.title == p["title"]).first()
        if not existing:
            prod = Product(**p, seller_id=seller_id)
            db.add(prod)
    db.commit()


def seed_initial_database(db: Session):
    """
    Idempotent database seeder. Guarantees existence of default Artisan & Admin accounts
    and sample products if database is uninitialized or user table is empty.
    """
    from backend.app.models import User
    from backend.app.services.auth import hash_password

    # Check if default Artisan exists
    artisan = db.query(User).filter(User.email == "tejapampana09@gmail.com").first()
    if not artisan:
        artisan = User(
            name="Teja Pampana",
            email="tejapampana09@gmail.com",
            phone="9876543210",
            hashed_password=hash_password("password123"),
            role="ARTISAN",
            status="ACTIVE",
            location="Andhra Pradesh, India",
            craft="Kalamkari & Handloom Weaving",
            verification_status="VERIFIED_ARTISAN",
            bio="Master artisan specializing in traditional hand-painted Kalamkari and natural dye textiles.",
            experience_years=15,
            craft_specialization="Kalamkari",
            token_version=1
        )
        db.add(artisan)
        db.commit()
        db.refresh(artisan)
    else:
        artisan.hashed_password = hash_password("password123")
        artisan.role = "ARTISAN"
        artisan.status = "ACTIVE"
        db.commit()

    # Check if default Admin exists
    admin = db.query(User).filter(User.email == "admin@artisanai.com").first()
    if not admin:
        admin = User(
            name="System Administrator",
            email="admin@artisanai.com",
            phone="9000000000",
            hashed_password=hash_password("password123"),
            role="ADMIN",
            status="ACTIVE",
            location="HQ",
            craft="System Administration",
            verification_status="VERIFIED_ARTISAN",
            token_version=1
        )
        db.add(admin)
        db.commit()

    # Seed sample products for the default artisan
    seed_sample_products(db, seller_id=artisan.id)

