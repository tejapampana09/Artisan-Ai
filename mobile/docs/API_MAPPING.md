# Mobile API Mapping

| Mobile feature | Existing backend |
|---|---|
| Seller login | `POST /api/studio/auth/login` |
| Buyer login | `POST /api/marketplace/auth/login` |
| Products | `GET /api/products`, `GET /api/products/{id}` |
| Seller create product | `POST /api/products` |
| AI catalog | `POST /api/ai/process-catalog` |
| AI publish | `POST /api/ai/approve-and-publish` |
| Image enhancement | `POST /api/ai/enhance-image` |
| Pricing | `GET /api/products/{id}/price-recommendation` |
| Orders | `GET /api/marketplace/orders` |
| Seller orders | `GET /api/marketplace/orders?role_view=seller` |
| Enquiries | `GET /api/marketplace/enquiries` |
| Seller enquiries | `GET /api/marketplace/enquiries?role_view=seller` |
| Buyer enquiry | `POST /api/marketplace/enquire` |
| Place order | `POST /api/marketplace/order` |
| Trending | `GET /api/marketplace/trending` |
| Buyer Copilot | `POST /api/buyer/copilot-chat` |
| ONDC status | `GET /api/ondc/status` |
