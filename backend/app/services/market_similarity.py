import re
from typing import Dict, Any, Tuple, List, Set, Optional
from backend.app.schemas import ArtisanFacts, MarketSearchProfile

# Configurable Attribute Comparability Weights (Total = 1.00)
WEIGHT_PRODUCT_IDENTITY: float = 0.30
WEIGHT_CRAFT_CATEGORY: float = 0.20
WEIGHT_MATERIAL: float = 0.15
WEIGHT_TECHNIQUE_REGION: float = 0.10
WEIGHT_OTHER_ATTRIBUTES: float = 0.25

# Hard relevance negative indicators
BLOG_NEWS_PATTERNS = [
    r"/blog(?:/|\.|$)",
    r"/news(?:/|\.|$)",
    r"/articles?(?:/|\.|$)",
    r"\bhow\s+to\s+make\b",
    r"\bhistory\s+of\b",
    r"\bguide\s+to\b",
    r"\b10\s+best\b",
    r"\btop\s+\d+\b",
    r"\bwhy\s+you\s+should\b"
]

CATEGORY_SEARCH_PATTERNS = [
    r"/category(?:/|\.|$)",
    r"/collections?(?:/|\.|$)",
    r"/search(?:/|\?|$)",
    r"\bshop\s+all\b",
    r"\bresults\s+for\b",
    r"\bexplore\s+collection\b",
    r"\bbrowse\s+products\b"
]

# Distinct craft object archetypes to avoid cross-domain false matches
PRODUCT_ARCHETYPES = {
    "saree": ["saree", "sari", "drape"],
    "apparel": ["kurta", "shirt", "dress", "dupatta", "scarf", "shawl", "jacket", "tunic"],
    "pottery": ["pot", "vase", "planter", "bowl", "plate", "mug", "terracotta", "pitcher", "urn"],
    "metalware": ["bell", "idol", "statue", "lamp", "diya", "brassware", "utensil", "figurine"],
    "toy": ["toy", "doll", "puppet", "play set", "figurine"],
    "painting": ["painting", "scroll", "canvas", "pattachitra", "kalamkari art", "madhubani", "warli"],
    "basketry": ["basket", "box", "hamper", "tray", "bin", "storage basket"],
    "jewelry": ["necklace", "earring", "bangle", "bracelet", "pendant", "ring"]
}

def _normalize_text(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r'[^\w\s]', ' ', str(text).lower())
    return re.sub(r'\s+', ' ', cleaned).strip()

def _get_tokens(text: str) -> Set[str]:
    norm = _normalize_text(text)
    return set(norm.split()) if norm else set()

def build_market_search_profile(
    artisan_facts: ArtisanFacts,
    title_hint: Optional[str] = None,
    category_hint: Optional[str] = None
) -> MarketSearchProfile:
    """
    Constructs a structured Canonical Market Search Profile from ArtisanFacts.
    Extracts object type, craft, category, materials, technique, region, style, and keywords.
    """
    raw_name = (artisan_facts.product_name or title_hint or "").strip()
    raw_craft = (artisan_facts.craft_type or category_hint or "").strip()
    materials = [str(m).strip() for m in (artisan_facts.materials or []) if str(m).strip()]

    # Clean filler prefixes from product name
    base_name = raw_name
    for prefix in ["this is an authentic", "this is a", "this is", "authentic", "handcrafted", "handmade"]:
        if base_name.lower().startswith(prefix):
            base_name = base_name[len(prefix):].strip()

    # Identify object type
    object_type = base_name
    for archetype, synonyms in PRODUCT_ARCHETYPES.items():
        if any(syn in base_name.lower() or syn in raw_craft.lower() for syn in synonyms):
            object_type = synonyms[0]
            break

    # Extract technique and region keywords if mentioned in story / description
    desc = f"{artisan_facts.artisan_story or ''} {artisan_facts.special_characteristics or ''}".lower()
    
    techniques = []
    technique_keywords = [
        "handloom", "block print", "wood turning", "brass casting", "lost wax",
        "dhokra", "bidri", "lacquer", "embroidery", "kalamkari", "tie dye", "ikat",
        "weaving", "handwoven", "carved", "hand painted"
    ]
    for tech in technique_keywords:
        if tech in desc or tech in raw_craft.lower() or tech in raw_name.lower():
            techniques.append(tech)

    regions = []
    region_keywords = [
        "andhra", "telangana", "jaipur", "rajasthan", "gujarat", "channapatna",
        "kashmir", "bengal", "odisha", "karnataka", "tamil nadu", "varanasi",
        "kutch", "mangalagiri", "pochampally", "kanchipuram"
    ]
    for reg in region_keywords:
        if reg in desc or reg in raw_craft.lower() or reg in raw_name.lower():
            regions.append(reg.title())

    return MarketSearchProfile(
        object_type=object_type or base_name or "handicraft",
        craft=raw_craft or "Handicraft",
        category=category_hint or raw_craft or "Craft",
        material=materials,
        technique=techniques,
        region=regions,
        style=["traditional"],
        color=[],
        keywords=[k for k in [raw_craft, base_name] if k]
    )

def build_profile_market_query(profile: MarketSearchProfile) -> str:
    """
    Constructs a concise, targeted search query string from a MarketSearchProfile,
    stripping generic conversational filler.
    """
    query_parts = []

    # Priority terms: region/technique + craft + object_type + primary materials
    if profile.region:
        query_parts.append(profile.region[0])
    if profile.technique:
        query_parts.append(profile.technique[0])
    if profile.craft and profile.craft.lower() not in " ".join(query_parts).lower():
        query_parts.append(profile.craft)
    if profile.object_type and profile.object_type.lower() not in " ".join(query_parts).lower():
        query_parts.append(profile.object_type)
    if profile.material:
        # Include primary material
        primary_mat = profile.material[0]
        if primary_mat.lower() not in " ".join(query_parts).lower():
            query_parts.append(primary_mat)

    base_q = " ".join(query_parts).strip()
    if not base_q:
        base_q = "Indian artisan handicraft"

    # Add intent suffix for e-commerce price discovery
    return f"{base_q} price buy online India".strip()

def is_hard_relevance_match(
    facts_or_profile: Any,
    candidate: Dict[str, Any]
) -> Tuple[bool, Optional[str]]:
    """
    Hard relevance filter: rejects candidates before similarity scoring.
    Rejects:
    - Empty or non-meaningful title
    - Non-product articles, blogs, tutorials, news
    - Category / collection / search listing pages with no identifiable product
    - Severe product archetype mismatch (e.g. Saree vs Bell)
    """
    title = (candidate.get("title") or "").strip()
    if not title or len(title) < 4:
        return False, "Candidate has no meaningful title"

    url = (candidate.get("url") or "").lower()
    t_lower = title.lower()

    # Reject blog / news / informational articles
    for pat in BLOG_NEWS_PATTERNS:
        if re.search(pat, url) or re.search(pat, t_lower):
            return False, "Candidate is an article/blog, not a product page"

    # Reject broad category / collection / search pages
    for pat in CATEGORY_SEARCH_PATTERNS:
        if re.search(pat, url) or re.search(pat, t_lower):
            # If the title clearly designates a general collection rather than a single item
            if "collection" in t_lower or "all products" in t_lower or "results for" in t_lower:
                return False, "Candidate is a category/collection page, not a specific product"

    # Severe product type mismatch check
    target_text = ""
    if isinstance(facts_or_profile, MarketSearchProfile):
        target_text = f"{facts_or_profile.object_type} {facts_or_profile.craft}".lower()
    elif isinstance(facts_or_profile, ArtisanFacts):
        target_text = f"{facts_or_profile.product_name or ''} {facts_or_profile.craft_type or ''}".lower()

    if target_text:
        target_archetype = None
        for arch, syns in PRODUCT_ARCHETYPES.items():
            if any(s in target_text for s in syns):
                target_archetype = arch
                break

        if target_archetype:
            candidate_text = f"{title} {candidate.get('category') or ''}".lower()
            for other_arch, other_syns in PRODUCT_ARCHETYPES.items():
                if other_arch != target_archetype:
                    # If candidate strongly matches an opposing archetype and lacks target synonyms
                    if any(osyn in candidate_text for osyn in other_syns):
                        target_syns = PRODUCT_ARCHETYPES[target_archetype]
                        if not any(tsyn in candidate_text for tsyn in target_syns):
                            return False, f"Product type mismatch: expected {target_archetype}, got {other_arch}"

    return True, None

def calculate_market_similarity(
    artisan_facts: ArtisanFacts,
    listing: Dict[str, Any],
    title_hint: Optional[str] = None,
    category_hint: Optional[str] = None
) -> Tuple[float, Dict[str, Any], str]:
    """
    Deterministic Attribute Comparability Engine for market research comparables.
    Evaluates comparability across structured product attributes:
    - Product Identity (30%)
    - Craft / Category (20%)
    - Materials (15%)
    - Technique / Region (10%)
    - Other Attributes / Context (25%)

    Returns:
    - score (float 0.0 - 1.0)
    - match_flags (dict with matched_product, matched_material, matched_craft, matched_technique, match_reasons)
    - match_tier ("STRONG", "GOOD", "WEAK", "REJECT")
    """
    fact_prod = (artisan_facts.product_name or title_hint or "").strip()
    fact_craft = (artisan_facts.craft_type or category_hint or "").strip()
    fact_mats = [m.strip() for m in (artisan_facts.materials or []) if m.strip()]

    list_title = (listing.get("title") or "").strip()
    list_cat = (listing.get("category") or "").strip()
    
    raw_list_mats = listing.get("materials", [])
    if isinstance(raw_list_mats, list):
        list_mats_str = " ".join([str(m) for m in raw_list_mats])
    elif isinstance(raw_list_mats, str):
        list_mats_str = raw_list_mats
    else:
        list_mats_str = ""

    list_desc = (listing.get("description") or "").strip()
    combined_listing_text = f"{list_title} {list_cat} {list_mats_str} {list_desc}"
    listing_text_norm = _normalize_text(combined_listing_text)

    match_reasons: List[str] = []

    # 1. Product Identity Score (30%)
    title_score = 0.0
    matched_product = False
    if fact_prod and list_title:
        prod_tokens = _get_tokens(fact_prod)
        title_tokens = _get_tokens(list_title)
        if prod_tokens:
            overlap = prod_tokens.intersection(title_tokens)
            ratio = len(overlap) / len(prod_tokens)
            title_score = min(1.0, ratio)
            if ratio >= 0.40:
                matched_product = True
                match_reasons.append("matched product type")
    elif not fact_prod:
        title_score = 0.5

    # 2. Craft / Category Score (20%)
    craft_score = 0.0
    matched_craft = False
    if fact_craft and (list_cat or list_title):
        craft_norm = _normalize_text(fact_craft)
        list_cat_norm = _normalize_text(list_cat)
        list_title_norm = _normalize_text(list_title)
        
        if craft_norm in list_cat_norm or list_cat_norm in craft_norm:
            craft_score = 1.0
            matched_craft = True
            match_reasons.append("same craft category")
        elif craft_norm in list_title_norm:
            craft_score = 0.8
            matched_craft = True
            match_reasons.append("craft identified in title")
        else:
            craft_tokens = set(craft_norm.split())
            combined_tokens = _get_tokens(combined_listing_text)
            if craft_tokens and craft_tokens.intersection(combined_tokens):
                craft_score = 0.5
                matched_craft = True
                match_reasons.append("partial craft keyword match")
    elif not fact_craft:
        craft_score = 0.5

    # 3. Material Score (15%)
    mat_score = 0.0
    matched_material = False
    if fact_mats:
        match_count = 0
        for mat in fact_mats:
            mat_norm = _normalize_text(mat)
            if mat_norm and mat_norm in listing_text_norm:
                match_count += 1
        
        if match_count > 0:
            mat_ratio = match_count / len(fact_mats)
            mat_score = min(1.0, mat_ratio)
            matched_material = True
            match_reasons.append("matched material composition")
    else:
        mat_score = 0.5

    # 4. Technique & Regional Heritage Score (10%)
    technique_score = 0.0
    matched_technique = False
    fact_desc = f"{artisan_facts.artisan_story or ''} {artisan_facts.special_characteristics or ''}".lower()
    common_techniques = [
        "handloom", "block print", "dhokra", "bidri", "lacquer", "handwoven",
        "channapatna", "kalamkari", "ikat", "wood turning", "brass casting"
    ]
    matched_techs = [t for t in common_techniques if t in fact_desc or t in (fact_craft or "").lower()]
    if matched_techs:
        for t in matched_techs:
            if t in listing_text_norm:
                technique_score = 1.0
                matched_technique = True
                match_reasons.append(f"matched technique ({t})")
                break
    else:
        technique_score = 0.5

    # 5. Other Attributes / Context Overlap (25%)
    context_score = 0.0
    all_fact_tokens = _get_tokens(f"{fact_prod} {fact_craft} {' '.join(fact_mats)}")
    if all_fact_tokens:
        listing_tokens = _get_tokens(combined_listing_text)
        shared = all_fact_tokens.intersection(listing_tokens)
        context_score = min(1.0, len(shared) / len(all_fact_tokens))
    else:
        context_score = 0.5

    final_score = round(
        (WEIGHT_PRODUCT_IDENTITY * title_score) +
        (WEIGHT_CRAFT_CATEGORY * craft_score) +
        (WEIGHT_MATERIAL * mat_score) +
        (WEIGHT_TECHNIQUE_REGION * technique_score) +
        (WEIGHT_OTHER_ATTRIBUTES * context_score),
        2
    )
    final_score = min(1.0, max(0.0, final_score))

    # Tier assignment
    if final_score >= 0.80:
        match_tier = "STRONG"
    elif final_score >= 0.50:
        match_tier = "GOOD"
    elif final_score >= 0.20:
        match_tier = "WEAK"
    else:
        match_tier = "REJECT"

    match_flags = {
        "matched_product": matched_product,
        "matched_material": matched_material,
        "matched_craft": matched_craft,
        "matched_technique": matched_technique,
        "match_reasons": match_reasons
    }

    return final_score, match_flags, match_tier
