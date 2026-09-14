import re
from typing import Dict, Any, Tuple, List, Set, Optional
from backend.app.schemas import ArtisanFacts

def _normalize_text(text: str) -> str:
    if not text:
        return ""
    # Lowercase and replace non-alphanumeric characters with spaces
    cleaned = re.sub(r'[^\w\s]', ' ', str(text).lower())
    # Collapse multiple spaces
    return re.sub(r'\s+', ' ', cleaned).strip()

def _get_tokens(text: str) -> Set[str]:
    norm = _normalize_text(text)
    return set(norm.split()) if norm else set()

def calculate_market_similarity(
    artisan_facts: ArtisanFacts,
    listing: Dict[str, Any],
    title_hint: Optional[str] = None,
    category_hint: Optional[str] = None
) -> Tuple[float, Dict[str, bool], str]:
    """
    Deterministic similarity scorer for market comparable listings.
    
    Weights:
    - Title/Product match: 40% (0.40)
    - Craft/Category match: 30% (0.30)
    - Material match: 30% (0.30)
    
    Tiers:
    - STRONG: score >= 0.80
    - GOOD:   score >= 0.50
    - WEAK:   score >= 0.20
    - REJECT: score < 0.20
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

    # 1. Product / Title Similarity (40%)
    title_score = 0.0
    matched_product = False
    if fact_prod and list_title:
        prod_tokens = _get_tokens(fact_prod)
        title_tokens = _get_tokens(list_title)
        if prod_tokens:
            overlap = prod_tokens.intersection(title_tokens)
            ratio = len(overlap) / len(prod_tokens)
            title_score = min(1.0, ratio)
            if ratio >= 0.5:
                matched_product = True
    elif not fact_prod:
        # If artisan didn't specify product name, give neutral partial score
        title_score = 0.5

    # 2. Craft / Category Similarity (30%)
    craft_score = 0.0
    matched_craft = False
    if fact_craft and (list_cat or list_title):
        craft_norm = _normalize_text(fact_craft)
        list_cat_norm = _normalize_text(list_cat)
        list_title_norm = _normalize_text(list_title)
        
        if craft_norm in list_cat_norm or list_cat_norm in craft_norm:
            craft_score = 1.0
            matched_craft = True
        elif craft_norm in list_title_norm:
            craft_score = 0.8
            matched_craft = True
        else:
            craft_tokens = set(craft_norm.split())
            combined_tokens = _get_tokens(combined_listing_text)
            if craft_tokens and craft_tokens.intersection(combined_tokens):
                craft_score = 0.5
                matched_craft = True
    elif not fact_craft:
        craft_score = 0.5

    # 3. Material Similarity (30%)
    mat_score = 0.0
    matched_material = False
    if fact_mats:
        match_count = 0
        listing_text_norm = _normalize_text(combined_listing_text)
        for mat in fact_mats:
            mat_norm = _normalize_text(mat)
            if mat_norm and mat_norm in listing_text_norm:
                match_count += 1
        
        if match_count > 0:
            mat_ratio = match_count / len(fact_mats)
            mat_score = min(1.0, mat_ratio)
            matched_material = True
    else:
        mat_score = 0.5

    # Weighted final score
    final_score = round((0.40 * title_score) + (0.30 * craft_score) + (0.30 * mat_score), 2)
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
        "matched_craft": matched_craft
    }

    return final_score, match_flags, match_tier
