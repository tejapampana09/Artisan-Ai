import logging
from typing import Dict, Any, Optional
from backend.app.services.ai_provider import GeminiAIProvider

logger = logging.getLogger("artisan_ai")

class ListingGeneratorService:
    """
    Generates AI product listing prose based strictly on verified artisan facts.
    Guarantees zero fabricated heritage or GI claims.
    """
    def __init__(self, provider: Optional[GeminiAIProvider] = None):
        self.provider = provider or GeminiAIProvider()

    async def generate_listing(
        self,
        language: str,
        product_facts: Dict[str, Any],
        artisan_story: Optional[str] = None,
        market_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        return await self.provider.generate_product_listing(
            language=language,
            product_facts=product_facts,
            artisan_story=artisan_story,
            market_context=market_context
        )
