from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from backend.app.database import get_db
from backend.app.models import User, Product, Review, PayoutAccount
from backend.app.schemas import (
    ArtisanProfileResponse, 
    ArtisanProfileUpdate,
    ArtisanLocationUpdate,
    CraftClusterInfo,
    ArtisanMapPin,
    ProductResponse, 
    UserResponse, 
    AdminCreateSellerRequest, 
    PayoutAccountUpdate, 
    PayoutAccountResponse,
    ArtisanRegister,
    ArtisanApplicationResponse,
    TokenResponse
)
from backend.app.data.craft_clusters import CRAFT_CLUSTERS, find_cluster_by_name, find_nearest_cluster
from backend.app.services.auth import get_current_user, require_admin, require_artisan, hash_password, create_domain_token
from backend.app.services.rate_limiter import rate_limiter, get_client_identifier

router = APIRouter(prefix="/api/artisan", tags=["Artisan Profile & Verification"])

@router.get("/map/clusters", response_model=List[CraftClusterInfo])
def get_craft_clusters(
    state: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns canonical heritage craft clusters across India with real-time registered artisan counts."""
    result = []
    for c in CRAFT_CLUSTERS:
        if state and state.lower() not in c["state"].lower():
            continue
        if category and category.lower() not in c["category"].lower() and category.lower() not in c["craft"].lower():
            continue

        artisan_count = db.query(User).filter(
            User.role == "ARTISAN",
            User.status == "ACTIVE",
            or_(
                User.craft_cluster == c["name"],
                User.location.ilike(f"%{c['name']}%"),
                User.craft_specialization.ilike(f"%{c['name']}%")
            )
        ).count()

        products_count = db.query(Product).join(User, Product.seller_id == User.id).filter(
            User.role == "ARTISAN",
            Product.status == "PUBLISHED",
            or_(
                User.craft_cluster == c["name"],
                User.location.ilike(f"%{c['name']}%"),
                Product.region_of_origin.ilike(f"%{c['name']}%"),
                Product.category.ilike(f"%{c['category']}%")
            )
        ).count()

        result.append(CraftClusterInfo(
            id=c["id"],
            name=c["name"],
            craft=c["craft"],
            category=c["category"],
            state=c["state"],
            district=c["district"],
            latitude=c["latitude"],
            longitude=c["longitude"],
            description=c["description"],
            heritage_age=c["heritage_age"],
            artisan_count=artisan_count,
            products_count=products_count
        ))
    return result

@router.get("/map/pins", response_model=List[ArtisanMapPin])
def get_artisan_map_pins(
    cluster: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns real geolocation pins for active master artisans across India."""
    query = db.query(User).filter(User.role == "ARTISAN", User.status == "ACTIVE")
    if cluster:
        query = query.filter(User.craft_cluster == cluster)
    if state:
        query = query.filter(User.state == state)

    artisans = query.all()
    pins = []
    for a in artisans:
        lat = float(a.latitude) if a.latitude is not None else None
        lng = float(a.longitude) if a.longitude is not None else None

        cluster_info = None
        if a.craft_cluster:
            cluster_info = find_cluster_by_name(a.craft_cluster)
        elif a.location:
            cluster_info = find_cluster_by_name(a.location)

        if lat is None or lng is None:
            if cluster_info:
                lat = cluster_info["latitude"]
                lng = cluster_info["longitude"]
            else:
                continue

        prods = db.query(Product).filter(
            Product.seller_id == a.id,
            Product.status == "PUBLISHED"
        ).limit(3).all()

        sample_prods = [
            {
                "id": p.id,
                "title": p.title,
                "price": float(p.price) if p.price else 0.0,
                "image_url": p.enhanced_image_url or p.image_url,
                "category": p.category
            }
            for p in prods
        ]

        avg_res = (
            db.query(func.avg(Review.rating))
            .join(Product, Review.product_id == Product.id)
            .filter(Product.seller_id == a.id)
            .scalar()
        )
        avg_rating = round(float(avg_res), 1) if avg_res else 4.9

        pins.append(ArtisanMapPin(
            artisan_id=a.id,
            artisan_name=a.name,
            avatar_url=a.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={a.name}",
            craft=a.craft or a.craft_specialization or "Heritage Craft",
            craft_cluster=a.craft_cluster or (cluster_info["name"] if cluster_info else None),
            state=a.state or (cluster_info["state"] if cluster_info else "India"),
            district=a.district or (cluster_info["district"] if cluster_info else None),
            latitude=lat,
            longitude=lng,
            verification_status=a.verification_status or "VERIFIED_ARTISAN",
            products_count=len(prods),
            average_rating=avg_rating,
            sample_products=sample_prods
        ))

    return pins

@router.put("/location", response_model=ArtisanProfileResponse)
def update_artisan_location(
    req: ArtisanLocationUpdate,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    """Updates artisan's studio location with real-time GPS coordinates or selected craft cluster."""
    if req.latitude is not None:
        current_artisan.latitude = req.latitude
    if req.longitude is not None:
        current_artisan.longitude = req.longitude
    if req.craft_cluster is not None:
        current_artisan.craft_cluster = req.craft_cluster
        cluster = find_cluster_by_name(req.craft_cluster)
        if cluster:
            if not current_artisan.state:
                current_artisan.state = cluster["state"]
            if not current_artisan.district:
                current_artisan.district = cluster["district"]
            if current_artisan.latitude is None or current_artisan.longitude is None:
                current_artisan.latitude = cluster["latitude"]
                current_artisan.longitude = cluster["longitude"]
    if req.state is not None:
        current_artisan.state = req.state
    if req.district is not None:
        current_artisan.district = req.district
    if req.pincode is not None:
        current_artisan.pincode = req.pincode

    if current_artisan.latitude is not None and current_artisan.longitude is not None and not current_artisan.craft_cluster:
        nearest = find_nearest_cluster(float(current_artisan.latitude), float(current_artisan.longitude))
        if nearest and nearest[1] <= 60.0:
            current_artisan.craft_cluster = nearest[0]["name"]
            if not current_artisan.state:
                current_artisan.state = nearest[0]["state"]
            if not current_artisan.district:
                current_artisan.district = nearest[0]["district"]

    db.commit()
    db.refresh(current_artisan)
    return get_artisan_public_profile(current_artisan.id, db)

@router.get("/{artisan_id}", response_model=ArtisanProfileResponse)
def get_artisan_public_profile(artisan_id: int, db: Session = Depends(get_db)):
    """Fetch public master artisan profile details, experience, verification status, and average rating."""
    artisan = db.query(User).filter(User.id == artisan_id).first()
    if not artisan:
        raise HTTPException(status_code=404, detail="Master Artisan profile not found")

    prods_count = db.query(Product).filter(Product.seller_id == artisan_id).count()

    # Calculate average review rating across artisan's products
    avg_res = (
        db.query(func.avg(Review.rating))
        .join(Product, Review.product_id == Product.id)
        .filter(Product.seller_id == artisan_id)
        .scalar()
    )
    avg_rating = round(float(avg_res), 1) if avg_res else 0.0

    ver_status = artisan.verification_status or "UNVERIFIED"
    if ver_status == "UNVERIFIED" and artisan.bio and artisan.craft:
        ver_status = "PROFILE_COMPLETE"

    return ArtisanProfileResponse(
        id=artisan.id,
        name=artisan.name,
        email=None,
        phone=None,
        location=artisan.location or "India",
        craft=artisan.craft or "Handicrafts",
        avatar_url=artisan.avatar_url or f"https://api.dicebear.com/7.x/bottts/svg?seed={artisan.name}",
        bio=artisan.bio or f"Master artisan specializing in traditional {artisan.craft or 'handicrafts'}.",
        craft_specialization=artisan.craft_specialization or artisan.craft or "Handicrafts",
        experience_years=artisan.experience_years or 5,
        verification_status=ver_status,
        total_products_count=prods_count,
        average_rating=avg_rating,
        latitude=float(artisan.latitude) if artisan.latitude is not None else None,
        longitude=float(artisan.longitude) if artisan.longitude is not None else None,
        craft_cluster=artisan.craft_cluster,
        state=artisan.state,
        district=artisan.district,
        pincode=artisan.pincode
    )

@router.put("/profile", response_model=ArtisanProfileResponse)
def update_artisan_profile(
    req: ArtisanProfileUpdate,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan)
):
    """Updates current artisan profile details."""
    if req.avatar_url is not None:
        current_artisan.avatar_url = req.avatar_url
    if req.bio is not None:
        current_artisan.bio = req.bio
    if req.craft_specialization is not None:
        current_artisan.craft_specialization = req.craft_specialization
    if req.experience_years is not None:
        current_artisan.experience_years = req.experience_years
    if req.location is not None:
        current_artisan.location = req.location
    if req.latitude is not None:
        current_artisan.latitude = req.latitude
    if req.longitude is not None:
        current_artisan.longitude = req.longitude
    if req.craft_cluster is not None:
        current_artisan.craft_cluster = req.craft_cluster
        cluster = find_cluster_by_name(req.craft_cluster)
        if cluster:
            if not current_artisan.state:
                current_artisan.state = cluster["state"]
            if not current_artisan.district:
                current_artisan.district = cluster["district"]
    if req.state is not None:
        current_artisan.state = req.state
    if req.district is not None:
        current_artisan.district = req.district
    if req.pincode is not None:
        current_artisan.pincode = req.pincode

    # Auto-update status to PROFILE_COMPLETE if basic fields filled
    if current_artisan.verification_status == "UNVERIFIED" and current_artisan.bio:
        current_artisan.verification_status = "PROFILE_COMPLETE"

    db.commit()
    db.refresh(current_artisan)

    return get_artisan_public_profile(current_artisan.id, db)

@router.post("/register", response_model=ArtisanApplicationResponse, status_code=status.HTTP_201_CREATED)
def register_artisan(payload: ArtisanRegister, request: Request, db: Session = Depends(get_db)):
    """
    Public Artisan Registration endpoint for creators joining the marketplace.
    Creates an artisan account in PENDING verification status. The profile must be
    verified and approved by Platform Administrator before Studio login is permitted.
    """
    rate_limiter.check_rate_limit(f"reg_artisan:{get_client_identifier(request)}", max_requests=5, window_seconds=60)

    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    clean_phone = payload.phone.strip() if (payload.phone and payload.phone.strip()) else None

    if not clean_email and not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide an email address or phone number for artisan registration."
        )

    filters = []
    if clean_email:
        filters.append(User.email == clean_email)
    if clean_phone:
        filters.append(User.phone == clean_phone)

    if filters:
        existing = db.query(User).filter(or_(*filters)).first()
        if existing:
            conflict = "email" if (clean_email and existing.email == clean_email) else "phone number"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An account with this {conflict} is already registered."
            )

    new_artisan = User(
        name=payload.name.strip(),
        email=clean_email,
        phone=clean_phone,
        hashed_password=hash_password(payload.password),
        role="ARTISAN",
        status="PENDING",
        location=payload.location.strip() if payload.location else "India",
        craft=payload.craft.strip() if payload.craft else "Handicrafts",
        craft_specialization=payload.craft.strip() if payload.craft else "Handicrafts",
        bio=payload.bio.strip() if payload.bio else f"Master artisan specializing in traditional {payload.craft or 'handicrafts'}.",
        verification_status="PENDING_VERIFICATION",
        experience_years=payload.experience_years or 0
    )
    db.add(new_artisan)
    db.commit()
    db.refresh(new_artisan)

    return ArtisanApplicationResponse(
        application_id=new_artisan.id,
        status="PENDING",
        verification_status="PENDING_VERIFICATION",
        message="Artisan application submitted successfully! Your application is currently pending admin verification. Once approved by the administrator, you can log in to your Studio.",
        user=new_artisan
    )

@router.post("/admin/create-seller", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def admin_create_seller(
    payload: AdminCreateSellerRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Admin Dashboard Endpoint: Allows Admin to create verified seller profiles
    and assign login credentials for artisans. Strictly protected by require_admin.
    """
    from backend.app.services.auth import hash_password

    clean_email = payload.email.strip().lower() if (payload.email and payload.email.strip()) else None
    clean_phone = payload.phone.strip() if (payload.phone and payload.phone.strip()) else None

    if not clean_email and not clean_phone:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please provide at least an email address or phone number for the artisan seller profile."
        )

    # Check for duplicate email/phone
    filters = []
    if clean_email:
        filters.append(User.email == clean_email)
    if clean_phone:
        filters.append(User.phone == clean_phone)

    if filters:
        from sqlalchemy import or_
        existing = db.query(User).filter(or_(*filters)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A seller profile with this email or phone number already exists."
            )

    try:
        new_seller = User(
            name=payload.name.strip(),
            email=clean_email,
            phone=clean_phone,
            hashed_password=hash_password(payload.password),
            role="ARTISAN",
            status="ACTIVE",
            location=payload.location or "India",
            craft=payload.craft or "Handicrafts",
            bio=payload.bio or f"Master artisan specializing in traditional {payload.craft or 'handicrafts'}.",
            verification_status=payload.verification_status or "UNVERIFIED"
        )
        db.add(new_seller)
        db.commit()
        db.refresh(new_seller)
        return new_seller
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        import logging
        logging.getLogger("artisan_ai").error("Failed to provision seller in artisan route: %s", str(exc), exc_info=True)
        err_str = str(exc).lower()
        if "unique" in err_str or "conflict" in err_str or "already exists" in err_str:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A seller profile with this email or phone number already exists."
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not provision seller profile: {str(exc)}"
        )

@router.get("/admin/sellers", response_model=List[UserResponse])
def admin_list_sellers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Lists all registered verified artisan seller profiles. Strictly protected by require_admin."""
    return db.query(User).filter(User.role == "ARTISAN").all()


@router.get("/admin/system-accounts")
def admin_get_system_accounts(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Fetches all system accounts (Admins & Artisans) from the active database. Strictly requires Admin session."""
    admins = db.query(User).filter(User.role == "ADMIN").all()
    artisans = db.query(User).filter(User.role == "ARTISAN").all()
    buyers_count = db.query(User).filter(User.role == "BUYER").count()

    return {
        "status": "success",
        "admins": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "verification_status": u.verification_status
            }
            for u in admins
        ],
        "artisans": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "craft": u.craft,
                "location": u.location,
                "verification_status": u.verification_status
            }
            for u in artisans
        ],
        "buyers_count": buyers_count
    }


@router.post("/admin/cleanup-buyers")
def admin_cleanup_buyers(
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """
    Cleans up all BUYER accounts and their associated records.
    Retains all ADMIN and ARTISAN accounts intact. Strictly requires Admin session.
    """
    from backend.app.models import Order, Notification, Enquiry, Event, Review

    buyer_ids = [u.id for u in db.query(User.id).filter(User.role == "BUYER").all()]
    deleted_count = len(buyer_ids)

    if buyer_ids:
        db.query(Notification).filter(Notification.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Event).filter(Event.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Enquiry).filter(Enquiry.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Review).filter(Review.buyer_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(Order).filter(Order.user_id.in_(buyer_ids)).delete(synchronize_session=False)
        db.query(User).filter(User.id.in_(buyer_ids)).delete(synchronize_session=False)
        db.commit()

    admins = db.query(User).filter(User.role == "ADMIN").all()
    artisans = db.query(User).filter(User.role == "ARTISAN").all()

    return {
        "status": "success",
        "deleted_buyers_count": deleted_count,
        "admins": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "verification_status": u.verification_status
            }
            for u in admins
        ],
        "artisans": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "role": u.role,
                "craft": u.craft,
                "location": u.location,
                "verification_status": u.verification_status
            }
            for u in artisans
        ]
    }


@router.post("/admin/seed-account")
def admin_seed_account(
    payload: dict,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin)
):
    """Provisions or updates an Admin or Artisan account in the active database. Strictly requires Admin session."""
    from backend.app.services.auth import hash_password
    
    email = payload.get("email", "").strip().lower()
    name = payload.get("name", "").strip()
    phone = payload.get("phone")
    password = payload.get("password")
    role = payload.get("role", "ADMIN").upper()
    craft = payload.get("craft", "Handicrafts")
    location = payload.get("location", "India")

    if not email or not password:
        raise HTTPException(status_code=400, detail="Email and password are required.")

    user = db.query(User).filter(User.email == email).first()
    if user:
        user.name = name or user.name
        user.role = role
        user.status = "ACTIVE"
        user.hashed_password = hash_password(password)
        if phone:
            user.phone = phone
        user.verification_status = "VERIFIED_ARTISAN" if role == "ARTISAN" else "PROFILE_COMPLETE"
    else:
        user = User(
            name=name or email.split("@")[0].title(),
            email=email,
            phone=phone,
            hashed_password=hash_password(password),
            role=role,
            status="ACTIVE",
            location=location,
            craft=craft,
            verification_status="VERIFIED_ARTISAN" if role == "ARTISAN" else "PROFILE_COMPLETE"
        )
        db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "craft": user.craft,
            "location": user.location
        }
    }


# ─── Payout Account Endpoints ────────────────────────────────────────────────

@router.get("/payout", response_model=PayoutAccountResponse)
def get_payout_account(
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan),
):
    """Get or initialise payout / bank account details for the current artisan."""
    payout = db.query(PayoutAccount).filter(PayoutAccount.artisan_id == current_artisan.id).first()
    if not payout:
        payout = PayoutAccount(artisan_id=current_artisan.id)
        db.add(payout)
        db.commit()
        db.refresh(payout)
    return payout


@router.put("/payout", response_model=PayoutAccountResponse)
def update_payout_account(
    payload: PayoutAccountUpdate,
    db: Session = Depends(get_db),
    current_artisan: User = Depends(require_artisan),
):
    """Create or update the payout / bank & UPI account for the current artisan."""
    payout = db.query(PayoutAccount).filter(PayoutAccount.artisan_id == current_artisan.id).first()
    if not payout:
        payout = PayoutAccount(artisan_id=current_artisan.id)
        db.add(payout)

    if payload.upi_id is not None:
        payout.upi_id = payload.upi_id.strip() or None
    if payload.account_holder_name is not None:
        payout.account_holder_name = payload.account_holder_name.strip() or None
    if payload.account_number is not None:
        payout.account_number = payload.account_number.strip() or None
    if payload.ifsc_code is not None:
        payout.ifsc_code = payload.ifsc_code.strip().upper() or None
    if payload.bank_name is not None:
        payout.bank_name = payload.bank_name.strip() or None

    db.commit()
    db.refresh(payout)
    return payout
