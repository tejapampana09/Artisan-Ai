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

def has_verified_artisan_input(
    artisan_facts: Optional[Any] = None,
    qna_answers: Optional[Dict[str, str]] = None,
    voice_description: Optional[str] = "",
    category_hint: Optional[str] = None,
) -> bool:
    """
    Provenance helper determining if artisan provided explicit factual inputs
    (Q&A, voice note, category hint, or non-empty ArtisanFacts properties).
    Returns False for pure photo-only uploads.
    """
    if artisan_facts:
        if isinstance(artisan_facts, ArtisanFacts):
            facts = artisan_facts
        elif isinstance(artisan_facts, dict):
            from backend.app.services.ai_adapter import extract_artisan_facts
            facts = extract_artisan_facts(artisan_facts=artisan_facts)
        else:
            facts = None

        if facts:
            has_facts = any([
                bool((facts.product_name or "").strip()),
                bool((facts.craft_type or "").strip()),
                bool(facts.materials and len(facts.materials) > 0),
                facts.handmade is not None,
                bool((facts.making_time or "").strip()),
                bool((facts.artisan_story or "").strip()),
                bool((facts.special_characteristics or "").strip()),
            ])
            if has_facts:
                return True

    if qna_answers and isinstance(qna_answers, dict):
        if any(bool(str(v or "").strip()) for v in qna_answers.values()):
            return True

    if bool((voice_description or "").strip() or (category_hint or "").strip()):
        return True

    return False


def validate_catalog_draft(
    generated_catalog: Dict[str, Any],
    artisan_facts: Optional[ArtisanFacts] = None,
    allow_ai_visual_inference: bool = False,
    initial_draft: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Provenance-aware backend validator/sanitizer for generated product catalog drafts.
    
    Guarantees:
    1. If user provided materials -> strictly enforced & locked 🔒.
    2. If photo-only upload (allow_ai_visual_inference=True or no verified user input) -> preserves Gemini Vision materials 🤖.
    3. If user provided facts but omitted materials & allow_ai_visual_inference=False -> clears materials.
    4. Fabricated family history/heritage scrubbed if not in ArtisanFacts.artisan_story (even in photo-only mode).
    5. Unsupported awards/certifications/GI tags scrubbed.
    6. Category prioritizes verified ArtisanFacts.craft_type when present.
    7. Adds ai_inferred_fields for UI transparency.
    """
    if not generated_catalog:
        return {}

    catalog = deepcopy(generated_catalog)

    if artisan_facts is None:
        if allow_ai_visual_inference:
            ai_inferred = []
            for field in ["title", "category", "materials", "description"]:
                if catalog.get(field):
                    ai_inferred.append(field)
            catalog["ai_inferred_fields"] = ai_inferred
        return catalog

    facts_materials = artisan_facts.materials or []
    facts_story = (artisan_facts.artisan_story or "").strip()
    facts_spec = (artisan_facts.special_characteristics or "").strip()
    facts_craft_type = (artisan_facts.craft_type or "").strip()
    facts_making_time = (artisan_facts.making_time or "").strip()
    facts_handmade = artisan_facts.handmade

    facts_combined = f"{facts_story} {facts_spec}".strip()

    # -------------------------------------------------------------------------
    # 1. Materials Validation (Provenance Aware)
    # -------------------------------------------------------------------------
    raw_gen_materials = catalog.get("materials")
    
    # Extract allowed reference materials
    allowed_ref_materials = list(facts_materials)
    is_photo_only = allow_ai_visual_inference or not has_verified_artisan_input(artisan_facts)
    if not facts_materials and is_photo_only and (allow_ai_visual_inference or (initial_draft and initial_draft.get("materials"))):
        init_mats = (initial_draft.get("materials") if initial_draft else catalog.get("materials"))
        if isinstance(init_mats, str):
            init_list = [m.strip() for m in init_mats.split(",") if m.strip()]
        elif isinstance(init_mats, list):
            init_list = [str(m).strip() for m in init_mats if str(m).strip()]
        else:
            init_list = []
        allowed_ref_materials.extend(init_list)

    if not facts_materials:
        if is_photo_only and (allow_ai_visual_inference or (initial_draft and initial_draft.get("materials"))):
            # Photo-only mode / AI visual inference -> preserve & validate visually inferred materials! 🤖
            if isinstance(raw_gen_materials, str):
                gen_list = [m.strip() for m in raw_gen_materials.split(",") if m.strip()]
            elif isinstance(raw_gen_materials, list):
                gen_list = [str(m).strip() for m in raw_gen_materials if str(m).strip()]
            else:
                gen_list = []

            ref_lower = [f.lower().strip() for f in allowed_ref_materials if f.strip()]
            valid_materials = []
            for gen in gen_list:
                gen_l = gen.lower()
                if any(r in gen_l or gen_l in r for r in ref_lower):
                    valid_materials.append(gen)

            final_mat_list = valid_materials if valid_materials else gen_list

            if isinstance(raw_gen_materials, list):
                catalog["materials"] = final_mat_list
            else:
                catalog["materials"] = ", ".join(final_mat_list)
        else:
            # User provided facts object/Q&A but gave no materials -> clear materials!
            if isinstance(raw_gen_materials, list):
                catalog["materials"] = []
            else:
                catalog["materials"] = ""
    else:
        # User provided materials 🔒 -> strictly enforce user materials & discard hallucinations
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

def sanitize_translation_fields(
    translations_data: Any,
    facts_story: str,
    facts_combined: str,
    fallback_desc: str = "Handcrafted artisan creation."
) -> Optional[str]:
    """
    Sanitizes title, description, and craft_story across all language keys
    inside translations JSON against heritage and award/GI claims.
    """
    if not translations_data:
        return None

    try:
        trans_data = json.loads(translations_data) if isinstance(translations_data, str) else translations_data
        if not isinstance(trans_data, dict):
            return None

        for lang_code, lang_fields in trans_data.items():
            if isinstance(lang_fields, dict):
                lang_fallback = lang_fields.get("description") or fallback_desc
                for tf in ["title", "description", "craft_story"]:
                    if tf in lang_fields and lang_fields[tf]:
                        val = str(lang_fields[tf])
                        if tf == "craft_story":
                            val = _sanitize_text_heritage(val, facts_story, lang_fallback)
                        val = _sanitize_text_awards(val, facts_combined)
                        lang_fields[tf] = val

        return json.dumps(trans_data, ensure_ascii=False)
    except Exception:
        return str(translations_data) if isinstance(translations_data, str) else None

# -------------------------------------------------------------------------
# Main Draft & Edit Validation Functions
# -------------------------------------------------------------------------
def validate_catalog_draft(
    generated_catalog: Dict[str, Any],
    artisan_facts: Optional[ArtisanFacts] = None,
    allow_ai_visual_inference: bool = False,
    initial_draft: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Provenance-aware backend validator/sanitizer for generated product catalog drafts.
    
    Guarantees:
    1. If user provided materials -> strictly enforced & locked 🔒.
    2. If photo-only upload (allow_ai_visual_inference=True or no verified user input) -> preserves Gemini Vision materials 🤖.
    3. If user provided facts but omitted materials & allow_ai_visual_inference=False -> clears materials.
    4. Fabricated family history/heritage scrubbed if not in ArtisanFacts.artisan_story (even in photo-only mode).
    5. Unsupported awards/certifications/GI tags scrubbed across all language fields and translations JSON.
    6. Category prioritizes verified ArtisanFacts.craft_type when present.
    7. Adds ai_inferred_fields for UI transparency.
    """
    if not generated_catalog:
        return {}

    catalog = deepcopy(generated_catalog)

    if artisan_facts is None:
        if allow_ai_visual_inference:
            ai_inferred = []
            for field in ["title", "category", "materials", "description"]:
                if catalog.get(field):
                    ai_inferred.append(field)
            catalog["ai_inferred_fields"] = ai_inferred
        return catalog

    facts_materials = artisan_facts.materials or []
    facts_story = (artisan_facts.artisan_story or "").strip()
    facts_spec = (artisan_facts.special_characteristics or "").strip()
    facts_craft_type = (artisan_facts.craft_type or "").strip()
    facts_making_time = (artisan_facts.making_time or "").strip()
    facts_handmade = artisan_facts.handmade

    facts_combined = f"{facts_story} {facts_spec}".strip()

    # -------------------------------------------------------------------------
    # 1. Materials Validation (Provenance Aware)
    # -------------------------------------------------------------------------
    raw_gen_materials = catalog.get("materials")
    
    # Extract allowed reference materials
    allowed_ref_materials = list(facts_materials)
    is_photo_only = allow_ai_visual_inference or not has_verified_artisan_input(artisan_facts)
    if not facts_materials and is_photo_only and (allow_ai_visual_inference or (initial_draft and initial_draft.get("materials"))):
        init_mats = (initial_draft.get("materials") if initial_draft else catalog.get("materials"))
        if isinstance(init_mats, str):
            init_list = [m.strip() for m in init_mats.split(",") if m.strip()]
        elif isinstance(init_mats, list):
            init_list = [str(m).strip() for m in init_mats if str(m).strip()]
        else:
            init_list = []
        allowed_ref_materials.extend(init_list)

    if not facts_materials:
        if is_photo_only and (allow_ai_visual_inference or (initial_draft and initial_draft.get("materials"))):
            # Photo-only mode / AI visual inference -> preserve & validate visually inferred materials! 🤖
            if isinstance(raw_gen_materials, str):
                gen_list = [m.strip() for m in raw_gen_materials.split(",") if m.strip()]
            elif isinstance(raw_gen_materials, list):
                gen_list = [str(m).strip() for m in raw_gen_materials if str(m).strip()]
            else:
                gen_list = []

            ref_lower = [f.lower().strip() for f in allowed_ref_materials if f.strip()]
            valid_materials = []
            for gen in gen_list:
                gen_l = gen.lower()
                if any(r in gen_l or gen_l in r for r in ref_lower):
                    valid_materials.append(gen)

            final_mat_list = valid_materials if valid_materials else gen_list

            if isinstance(raw_gen_materials, list):
                catalog["materials"] = final_mat_list
            else:
                catalog["materials"] = ", ".join(final_mat_list)
        else:
            # User provided facts object/Q&A but gave no materials -> clear materials!
            if isinstance(raw_gen_materials, list):
                catalog["materials"] = []
            else:
                catalog["materials"] = ""
    else:
        # User provided materials 🔒 -> strictly enforce user materials & discard hallucinations
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
        catalog["translations"] = sanitize_translation_fields(
            catalog["translations"],
            facts_story=facts_story,
            facts_combined=facts_combined,
            fallback_desc=fallback_desc
        )

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

    # -------------------------------------------------------------------------
    # 7. AI Inferred Fields Tagging
    # -------------------------------------------------------------------------
    if allow_ai_visual_inference:
        ai_inferred = []
        user_has_name = bool(artisan_facts and (artisan_facts.product_name or "").strip())
        user_has_craft = bool(artisan_facts and (artisan_facts.craft_type or "").strip())
        user_has_mat = bool(artisan_facts and artisan_facts.materials and len(artisan_facts.materials) > 0)
        user_has_story = bool(artisan_facts and (artisan_facts.artisan_story or "").strip())

        if not user_has_name and catalog.get("title"):
            ai_inferred.append("title")
        if not user_has_craft and catalog.get("category"):
            ai_inferred.append("category")
        if not user_has_mat and catalog.get("materials"):
            ai_inferred.append("materials")
        if not user_has_story and (catalog.get("description") or catalog.get("craft_story")):
            ai_inferred.append("description")

        catalog["ai_inferred_fields"] = ai_inferred

    return catalog

def validate_edited_catalog_strictly(
    edited_catalog: Dict[str, Any],
    artisan_facts: Optional[ArtisanFacts] = None,
    initial_draft: Optional[Dict[str, Any]] = None
) -> List[str]:
    """
    Strictly validates human edits against canonical ArtisanFacts and initial AI draft during publish phase (Behavior B).
    
    Guarantees:
    - User-provided materials 🔒: strictly required. Unverified materials rejected.
    - Photo-only AI materials 🤖: AI-inferred materials from initial draft are accepted if artisan approves/edits them.
    - Manually added completely new unsupported materials are rejected.
    - Fabricated family heritage and unverified awards/GI tags are strictly rejected.
    """
    if artisan_facts is None and initial_draft is None:
        return []

    errors: List[str] = []

    facts_materials = (artisan_facts.materials or []) if artisan_facts else []
    facts_story = (artisan_facts.artisan_story or "").strip() if artisan_facts else ""
    facts_spec = (artisan_facts.special_characteristics or "").strip() if artisan_facts else ""

    allowed_materials = list(facts_materials)

    # Allow initial AI draft materials if genuinely photo-only or if materials were AI-inferred in initial draft
    ai_inferred_fields = initial_draft.get("ai_inferred_fields", []) if initial_draft else []
    is_photo_only = (not has_verified_artisan_input(artisan_facts)) or ("materials" in ai_inferred_fields)
    if not facts_materials and is_photo_only and initial_draft:
        raw_init_mats = initial_draft.get("materials")
        if isinstance(raw_init_mats, str):
            init_list = [m.strip() for m in raw_init_mats.split(",") if m.strip()]
        elif isinstance(raw_init_mats, list):
            init_list = [str(m).strip() for m in raw_init_mats if str(m).strip()]
        else:
            init_list = []
        allowed_materials.extend(init_list)

    facts_lower = [f.lower().strip() for f in allowed_materials if f.strip()]

    # 1. Strict Materials Check
    raw_materials = edited_catalog.get("materials")
    if raw_materials:
        if isinstance(raw_materials, str):
            edited_list = [m.strip() for m in raw_materials.split(",") if m.strip()]
        elif isinstance(raw_materials, list):
            edited_list = [str(m).strip() for m in raw_materials if str(m).strip()]
        else:
            edited_list = []

        if not allowed_materials and edited_list:
            errors.append("No materials were declared in your verified Q&A facts or initial AI draft, but materials were specified in publish request.")
        else:
            unverified = []
            for mat in edited_list:
                mat_l = mat.lower()
                if not any(f in mat_l or mat_l in f for f in facts_lower):
                    unverified.append(mat)
            if unverified:
                errors.append(f"Material(s) '{', '.join(unverified)}' are not listed in your verified artisan facts or initial AI draft ({', '.join(allowed_materials)}).")

    # 2. Strict Heritage Claims Check
    fs_lower = facts_story.lower()
    negative_signals = ["ఏమీ చెప్పలేదు", "చెప్పలేదు", "no family", "nothing", "not specified", "no story"]
    has_negative = any(neg in fs_lower for neg in negative_signals)
    has_explicit_heritage = (not has_negative) and any(
        kw in fs_lower
        for kw in ["family", "generations", "generation", "years", "ancestor", "ancestors", "తరాల", "సంవత్సరాల"]
    )

    check_fields = ["craft_story", "craft_story_en", "description", "description_en", "title", "title_en"]

    if not has_explicit_heritage:
        for field_name in check_fields:
            text_val = (edited_catalog.get(field_name) or "").lower()
            if any(term in text_val for term in FORBIDDEN_HERITAGE_TERMS):
                errors.append(f"Unverified family heritage claim found in {field_name}. Please remove ancestral/generational claims not present in your Q&A answers.")

        if edited_catalog.get("translations"):
            try:
                trans_data = json.loads(edited_catalog["translations"])
                if isinstance(trans_data, dict):
                    for lang_code, lang_fields in trans_data.items():
                        if isinstance(lang_fields, dict):
                            for fk, fval in lang_fields.items():
                                text_val = str(fval or "").lower()
                                if any(term in text_val for term in FORBIDDEN_HERITAGE_TERMS):
                                    errors.append(f"Unverified family heritage claim found in translations.{lang_code}.{fk}. Please remove ancestral/generational claims not present in your Q&A answers.")
            except Exception:
                pass

    # 3. Strict Awards / GI Tag Check
    for field_name in check_fields:
        text_val = (edited_catalog.get(field_name) or "").lower()
        if any(term in text_val for term in FORBIDDEN_AWARD_TERMS):
            errors.append(f"Unverified award/GI tag claim found in {field_name}. Official awards or GI status must be verified.")

    if edited_catalog.get("translations"):
        try:
            trans_data = json.loads(edited_catalog["translations"])
            if isinstance(trans_data, dict):
                for lang_code, lang_fields in trans_data.items():
                    if isinstance(lang_fields, dict):
                        for fk, fval in lang_fields.items():
                            text_val = str(fval or "").lower()
                            if any(term in text_val for term in FORBIDDEN_AWARD_TERMS):
                                errors.append(f"Unverified award/GI tag claim found in translations.{lang_code}.{fk}. Official awards or GI status must be verified.")
        except Exception:
            pass

    return errors


