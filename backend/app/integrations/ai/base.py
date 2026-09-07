from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class BaseAIProvider(ABC):
    """
    Abstract Base Class for Multimodal AI Providers.
    Decouples business logic from specific vendor implementations (Gemini, OpenAI, Local models).
    """

    @abstractmethod
    async def generate_catalog_draft(
        self,
        voice_description: str,
        language: str = "en",
        image_url: Optional[str] = None,
        category_hint: Optional[str] = None,
        material_cost: Optional[float] = None,
        labour_cost: Optional[float] = None,
        packaging_cost: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Generates a structured catalog draft from voice description, photo, and cost inputs.
        MUST mark uncertain fields (origin, GI certification) as "Needs artisan confirmation".
        """
        pass
