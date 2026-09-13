import json
import re
from typing import Dict, Any, Optional, List
from copy import deepcopy

from backend.app.schemas import ArtisanFacts

FORBIDDEN_HERITAGE_TERMS = [
    "generation", "generations", "ancestral", "centuries-old",
    "passed down", "family tradition", "heritage tradition",
    "three generations", "20 years of family", "ancestor", "ancestors"
]

FORBIDDEN_AWARD_TERMS = [
    "gi tag", "gi tagged", "gi status", "geographical indication",
    "national award", "award-winning", "award winning",
    "certified authentic", "government certified"
]

def _sanitize_text_heritage(text: str, facts_story: str, fallback: str) -> str:
    if not text:
        return fallback or ""

    fs_lower = (facts_story or "").lower()
    negative_signals = ["ఏమీ చెప్పలేదు", "చెప్పలేదు", "no family", "nothing", "not specified", "no story"]
    has_negative = any(neg in fs_lower for neg in negative_signals)

    has_explicit_heritage = (not has_negative) and any(
        kw in fs_lower
        for kw in ["family", "generations", "generation", "years", "ancestor", "ancestors", "తరాల", "సంవత్సరాల"]
    )

    if not has_explicit_heritage:
        text_lower = text.lower()
        if any(term in text_lower for term in FORBIDDEN_HERITAGE_TERMS):
            return fallback or "Handcrafted artisan product made with care."

    return text

def _sanitize_text_awards(text: str, facts_combined: str) -> str:
    if not text:
        return ""

    sanitized = text
    fc_lower = (facts_combined or "").lower()

    for award_term in FORBIDDEN_AWARD_TERMS:
        if award_term not in fc_lower:
            pattern = re.compile(re.escape(award_term), re.IGNORECASE)
            sanitized = pattern.sub("", sanitized)

    # Clean up extra spaces
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    return sanitized

def validate_catalog_draft(
    generated_catalog: Dict[str, Any],
    artisan_facts: Optional[ArtisanFacts] = None
) -> Dict[str, Any]:
    """
    Deterministic backend validator/sanitizer for generated product catalog drafts.
    
    Guarantees:
    1. Product facts strictly conform to canonical ArtisanFacts.
    2. Empty facts materials -> empty materials list [] / "".
    3. Invented materials filtered; if all invalid, falls back to ArtisanFacts.materials.
    4. Fabricated family history/heritage scrubbed if not in ArtisanFacts.artisan_story.
    5. Unsupported awards/certifications/GI tags scrubbed.
    6. Handmade status preserved (None is not converted to True).
    7. Making time cleared if ArtisanFacts.making_time is empty.
    8. Category prioritizes verified ArtisanFacts.craft_type when present.
    9. Pricing fields strictly untouched.
    10. Returns catalog intact if artisan_facts is None.
    """
    if not generated_catalog:
        return {}

    catalog = deepcopy(generated_catalog)

    if artisan_facts is None:
        return catalog

    facts_materials = artisan_facts.materials or []
    facts_story = (artisan_facts.artisan_story or "").strip()
    facts_spec = (artisan_facts.special_characteristics or "").strip()
    facts_craft_type = (artisan_facts.craft_type or "").strip()
    facts_making_time = (artisan_facts.making_time or "").strip()
    facts_handmade = artisan_facts.handmade

    facts_combined = f"{facts_story} {facts_spec}".strip()

    # -------------------------------------------------------------------------
    # 1. Materials Validation
    # -------------------------------------------------------------------------
    raw_gen_materials = catalog.get("materials")
    if not facts_materials:
        if isinstance(raw_gen_materials, list):
            catalog["materials"] = raw_gen_materials
        else:
            catalog["materials"] = raw_gen_materials or ""
    else:
        if isinstance(raw_gen_materials, str):
            gen_list = [m.strip() for m in raw_gen_materials.split(",") if m.strip()]
        elif isinstance(raw_gen_materials, list):
            gen_list = [str(m).strip() for m in raw_gen_materials if str(m).strip()]
        else:
            gen_list = []

        facts_lower = [f.lower().strip() for f in facts_materials if f.strip()]
        valid_materials = []
        for gen in gen_list:
            gen_l = gen.lower()
            if any(f in gen_l or gen_l in f for f in facts_lower):
                valid_materials.append(gen)

        final_mat_list = valid_materials if valid_materials else facts_materials

        if isinstance(raw_gen_materials, list):
            catalog["materials"] = final_mat_list
        else:
            catalog["materials"] = ", ".join(final_mat_list)

    # -------------------------------------------------------------------------
    # 2. Craft Story & Heritage Validation
    # -------------------------------------------------------------------------
    fallback_desc = catalog.get("description") or catalog.get("description_en") or "Handcrafted artisan creation."
    
    if "craft_story" in catalog:
        catalog["craft_story"] = _sanitize_text_heritage(catalog["craft_story"], facts_story, fallback_desc)
    
    if "craft_story_en" in catalog:
        catalog["craft_story_en"] = _sanitize_text_heritage(catalog["craft_story_en"], facts_story, fallback_desc)

    # Sanitize translations JSON if present
    if catalog.get("translations"):
        try:
            trans_data = json.loads(catalog["translations"])
            if isinstance(trans_data, dict):
                for lang_code, lang_fields in trans_data.items():
                    if isinstance(lang_fields, dict) and "craft_story" in lang_fields:
                        lang_fallback = lang_fields.get("description") or fallback_desc
                        lang_fields["craft_story"] = _sanitize_text_heritage(lang_fields["craft_story"], facts_story, lang_fallback)
                catalog["translations"] = json.dumps(trans_data, ensure_ascii=False)
        except Exception:
            pass

    # -------------------------------------------------------------------------
    # 3. Awards / Certifications / GI Tag Validation
    # -------------------------------------------------------------------------
    for text_field in ["title", "title_en", "description", "description_en", "craft_story", "craft_story_en"]:
        if catalog.get(text_field):
            catalog[text_field] = _sanitize_text_awards(catalog[text_field], facts_combined)

    if catalog.get("tags") and isinstance(catalog["tags"], list):
        sanitized_tags = []
        for tag in catalog["tags"]:
            san_tag = _sanitize_text_awards(str(tag), facts_combined)
            if san_tag:
                sanitized_tags.append(san_tag)
        catalog["tags"] = sanitized_tags

    # -------------------------------------------------------------------------
    # 4. Handmade Status Validation
    # -------------------------------------------------------------------------
    if facts_handmade is None:
        if "handmade" in catalog:
            catalog["handmade"] = None

    # -------------------------------------------------------------------------
    # 5. Making Time Validation
    # -------------------------------------------------------------------------
    if not facts_making_time:
        if "making_time" in catalog:
            catalog["making_time"] = ""
    else:
        if "making_time" in catalog:
            catalog["making_time"] = facts_making_time

    # -------------------------------------------------------------------------
    # 6. Craft Type / Category Prioritization
    # -------------------------------------------------------------------------
    if facts_craft_type:
        catalog["category"] = facts_craft_type

    return catalog

def validate_edited_catalog_strictly(
    edited_catalog: Dict[str, Any],
    artisan_facts: Optional[ArtisanFacts] = None
) -> List[str]:
    """
    Strictly validates human edits against canonical ArtisanFacts during the publish phase (Behavior B).
    Returns a list of violation error messages if the edited catalog contains unverified materials,
    unsupported family heritage claims, or unverified award/certification/GI tags.
    Returns an empty list [] if validation succeeds.
    """
    if artisan_facts is None:
        return []

    errors: List[str] = []

    facts_materials = artisan_facts.materials or []
    facts_story = (artisan_facts.artisan_story or "").strip()
    facts_spec = (artisan_facts.special_characteristics or "").strip()
    facts_lower = [f.lower().strip() for f in facts_materials if f.strip()]

    # 1. Strict Materials Check
    raw_materials = edited_catalog.get("materials")
    if raw_materials:
        if isinstance(raw_materials, str):
            edited_list = [m.strip() for m in raw_materials.split(",") if m.strip()]
        elif isinstance(raw_materials, list):
            edited_list = [str(m).strip() for m in raw_materials if str(m).strip()]
        else:
            edited_list = []

        if not facts_materials and edited_list:
            errors.append("No materials were declared in your verified Q&A facts, but materials were specified in publish request.")
        else:
            unverified = []
            for mat in edited_list:
                mat_l = mat.lower()
                if not any(f in mat_l or mat_l in f for f in facts_lower):
                    unverified.append(mat)
            if unverified:
                errors.append(f"Material(s) '{', '.join(unverified)}' are not listed in your verified artisan facts ({', '.join(facts_materials)}).")

    # 2. Strict Heritage Claims Check
    fs_lower = facts_story.lower()
    negative_signals = ["ఏమీ చెప్పలేదు", "చెప్పలేదు", "no family", "nothing", "not specified", "no story"]
    has_negative = any(neg in fs_lower for neg in negative_signals)
    has_explicit_heritage = (not has_negative) and any(
        kw in fs_lower
        for kw in ["family", "generations", "generation", "years", "ancestor", "ancestors", "తరాల", "సంవత్సరాల"]
    )

    if not has_explicit_heritage:
        for field_name in ["craft_story", "description", "title"]:
            text_val = (edited_catalog.get(field_name) or "").lower()
            if any(term in text_val for term in FORBIDDEN_HERITAGE_TERMS):
                errors.append(f"Unverified family heritage claim found in {field_name}. Please remove ancestral/generational claims not present in your Q&A answers.")

    # 3. Strict Awards / GI Tag Check
    for field_name in ["title", "description", "craft_story"]:
        text_val = (edited_catalog.get(field_name) or "").lower()
        if any(term in text_val for term in FORBIDDEN_AWARD_TERMS):
            errors.append(f"Unverified award/GI tag claim found in {field_name}. Official awards or GI status must be verified.")

    return errors

