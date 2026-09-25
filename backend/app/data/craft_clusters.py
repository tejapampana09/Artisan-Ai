"""
Canonical Indian Heritage Craft Clusters Registry.
Contains authentic coordinates, historical craft traditions, states, and districts.
Used for geocoding, cluster filtering, and verifying artisan locations.
"""

CRAFT_CLUSTERS = [
    {
        "id": "etikoppaka",
        "name": "Etikoppaka",
        "craft": "Lacquer Wooden Toys",
        "category": "Wooden Toys",
        "state": "Andhra Pradesh",
        "district": "Anakapalli",
        "latitude": 17.5255,
        "longitude": 82.7485,
        "description": "Famed for traditional soft-wood toys turned on lathes and colored with natural organic vegetable lacquer and seeds.",
        "heritage_age": "400+ years"
    },
    {
        "id": "kondapalli",
        "name": "Kondapalli",
        "craft": "Kondapalli Bommalu",
        "category": "Wooden Toys",
        "state": "Andhra Pradesh",
        "district": "NTR",
        "latitude": 16.6186,
        "longitude": 80.5367,
        "description": "Centuries-old light-wood figurine carving using Poniki wood depicting village life, mythology, and Dasavataram.",
        "heritage_age": "400+ years"
    },
    {
        "id": "pochampally",
        "name": "Pochampally",
        "craft": "Ikat Handloom Weaving",
        "category": "Textiles",
        "state": "Telangana",
        "district": "Yadadri Bhuvanagiri",
        "latitude": 17.3468,
        "longitude": 78.8183,
        "description": "The Silk City of India, world-renowned for geometric tie-and-dye Ikat weaves on pit looms.",
        "heritage_age": "200+ years"
    },
    {
        "id": "dharmavaram",
        "name": "Dharmavaram",
        "craft": "Pure Silk Handloom Sarees",
        "category": "Textiles",
        "state": "Andhra Pradesh",
        "district": "Sri Sathya Sai",
        "latitude": 14.4137,
        "longitude": 77.7208,
        "description": "Known as the Silk Paradise, weaving heavy broad-bordered pure mulberry silk sarees with rich golden zari pallus.",
        "heritage_age": "150+ years"
    },
    {
        "id": "srikalahasti",
        "name": "Srikalahasti",
        "craft": "Kalamkari Pen Painting",
        "category": "Kalamkari",
        "state": "Andhra Pradesh",
        "district": "Tirupati",
        "latitude": 13.7498,
        "longitude": 79.6984,
        "description": "Sacred figurative temple art painted with bamboo kalam pens using 100% natural vegetable dyes washed in the Swarnamukhi River.",
        "heritage_age": "500+ years"
    },
    {
        "id": "channapatna",
        "name": "Channapatna",
        "craft": "Lacquered Wooden Toys",
        "category": "Wooden Toys",
        "state": "Karnataka",
        "district": "Ramanagara",
        "latitude": 12.6518,
        "longitude": 77.2089,
        "description": "The Gombegala Ooru (Town of Toys), crafting non-toxic wooden toys using Aale Mara wood and natural organic lacquer.",
        "heritage_age": "200+ years"
    },
    {
        "id": "bidar",
        "name": "Bidar",
        "craft": "Bidriware Metal Inlay",
        "category": "Bidriware",
        "state": "Karnataka",
        "district": "Bidar",
        "latitude": 17.9104,
        "longitude": 77.5199,
        "description": "Bahmani sultanate craft of inlaying pure 99.9% silver wire onto blackened zinc-copper alloy using soil from Bidar Fort.",
        "heritage_age": "500+ years"
    },
    {
        "id": "jaipur",
        "name": "Jaipur",
        "craft": "Blue Pottery & Sanganeri Print",
        "category": "Blue Pottery",
        "state": "Rajasthan",
        "district": "Jaipur",
        "latitude": 26.9124,
        "longitude": 75.7873,
        "description": "Turquoise glazed pottery sculpted from ground quartz stone slurry and hand-block textile printing with teak blocks.",
        "heritage_age": "300+ years"
    },
    {
        "id": "madhubani",
        "name": "Madhubani",
        "craft": "Mithila Painting",
        "category": "Painting",
        "state": "Bihar",
        "district": "Madhubani",
        "latitude": 26.3533,
        "longitude": 86.0718,
        "description": "Ancient folk art painted with fingers, twigs, and matchsticks using natural mineral and plant pigments.",
        "heritage_age": "1000+ years"
    },
    {
        "id": "varanasi",
        "name": "Varanasi",
        "craft": "Banarasi Silk Brocades",
        "category": "Textiles",
        "state": "Uttar Pradesh",
        "district": "Varanasi",
        "latitude": 25.3176,
        "longitude": 82.9739,
        "description": "Imperial Mughal brocades woven on jacquard looms with real gold and silver metallic threads (Zari).",
        "heritage_age": "600+ years"
    },
    {
        "id": "kanchipuram",
        "name": "Kanchipuram",
        "craft": "Kanjivaram Silk Weaving",
        "category": "Textiles",
        "state": "Tamil Nadu",
        "district": "Kanchipuram",
        "latitude": 12.8342,
        "longitude": 79.7036,
        "description": "Heavy mulberry silk sarees featuring the Korvai interlocking technique and solid gold zari borders.",
        "heritage_age": "400+ years"
    },
    {
        "id": "bishnupur",
        "name": "Bishnupur",
        "craft": "Terracotta Craft & Baluchari",
        "category": "Terracotta",
        "state": "West Bengal",
        "district": "Bankura",
        "latitude": 23.0678,
        "longitude": 87.3168,
        "description": "Famous Bankura horse terracotta sculptures fired from alluvial clay, echoing the 17th-century terracotta temples.",
        "heritage_age": "350+ years"
    }
]

def find_cluster_by_name(name: str):
    """Finds a cluster by partial or full name match."""
    if not name:
        return None
    name_clean = name.strip().lower()
    for c in CRAFT_CLUSTERS:
        if c["name"].lower() == name_clean or c["id"] == name_clean:
            return c
        if c["name"].lower() in name_clean or name_clean in c["name"].lower():
            return c
    return None

def find_nearest_cluster(lat: float, lng: float):
    """Finds the geographically closest cluster using Haversine distance."""
    import math

    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0 # Earth radius in km
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = (math.sin(dLat / 2) ** 2 +
             math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dLon / 2) ** 2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c

    closest = None
    min_dist = float("inf")
    for c in CRAFT_CLUSTERS:
        dist = haversine(lat, lng, c["latitude"], c["longitude"])
        if dist < min_dist:
            min_dist = dist
            closest = (c, round(dist, 1))

    return closest
