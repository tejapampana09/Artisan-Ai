import { useEffect, useState } from "react";
import { useLocalSearchParams, router } from "expo-router";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  TextInput,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { api } from "../src/api";
import { theme } from "../src/theme";
import { addToCart } from "../src/cart";
import { toggleWishlist, isWishlisted } from "../src/wishlist";
import { PrimaryButton, OutlineButton } from "../src/components";
import { useI18n } from "../src/i18n";

const { width } = Dimensions.get("window");

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useI18n();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isSaved, setIsSaved] = useState(false);
  const [addedToast, setAddedToast] = useState(false);
  const [showEnquiryModal, setShowEnquiryModal] = useState(false);
  const [enquiryMessage, setEnquiryMessage] = useState("");
  const [sendingEnquiry, setSendingEnquiry] = useState(false);

  // Reviews and Artisan Profile States
  const [reviews, setReviews] = useState<any[]>([]);
  const [showArtisanModal, setShowArtisanModal] = useState(false);
  const [artisanData, setArtisanData] = useState<any>(null);
  const [loadingArtisan, setLoadingArtisan] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (id) {
      setLoading(true);
      isWishlisted(Number(id)).then(setIsSaved).catch(() => {});
      api
        .product(Number(id))
        .then((data) => {
          setProduct(data);
          // Fetch verified reviews for this product
          api
            .productReviews(Number(id))
            .then((revs) => setReviews(Array.isArray(revs) ? revs : []))
            .catch(() => setReviews([]));

          // Fetch artisan public profile if seller_id exists
          if (data?.seller_id) {
            api
              .artisanProfile(data.seller_id)
              .then(setArtisanData)
              .catch(() => {});
          }

          // Record view event for real-time analytics & seller dashboard views counter
          api.recordEvent({
            event_type: "VIEW",
            product_id: Number(id),
            category: data?.category,
            metadata_info: `Buyer viewed ${data?.title || 'craft'}`
          });
        })
        .catch((err) => console.warn("Product fetch error:", err))
        .finally(() => setLoading(false));
    }

    return () => {
      Speech.stop().catch(() => {});
    };
  }, [id]);

  const handleOpenArtisanModal = async () => {
    setShowArtisanModal(true);
    if (product?.seller_id && !artisanData) {
      setLoadingArtisan(true);
      try {
        const data = await api.artisanProfile(product.seller_id);
        setArtisanData(data);
      } catch (e) {
        console.warn("Artisan profile fetch error:", e);
      } finally {
        setLoadingArtisan(false);
      }
    }
  };

  const handleToggleWishlist = async () => {
    if (!product) return;
    const newState = await toggleWishlist(product);
    setIsSaved(newState);
    if (newState) {
      api.recordEvent({
        event_type: "SAVE",
        product_id: product.id,
        category: product.category,
        metadata_info: `Buyer saved ${product.title}`
      });
    }
  };

  const handleSendEnquiry = async () => {
    if (!enquiryMessage.trim()) {
      Alert.alert("Empty Message", "Please write a question or message for the artisan.");
      return;
    }
    setSendingEnquiry(true);
    try {
      await api.sendEnquiry({
        product_id: product.id,
        quantity,
        message: enquiryMessage.trim()
      });
      setShowEnquiryModal(false);
      setEnquiryMessage("");
      Alert.alert(
        "Inquiry Sent",
        "Your message has been sent directly to the artisan's studio. You can track responses in your Inquiries tab.",
        [
          { text: "View Inquiries", onPress: () => router.push("/buyer-enquiries") },
          { text: "OK" }
        ]
      );
    } catch (e: any) {
      Alert.alert("Error", e?.detail || e?.message || "Failed to send enquiry.");
    } finally {
      setSendingEnquiry(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;
    await addToCart(product, quantity);
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2000);
  };

  const handleBuyNow = async () => {
    if (!product) return;
    await addToCart(product, quantity);
    router.push("/buyer-cart");
  };

  const handleToggleStorySpeech = async () => {
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const storyText =
      product?.craft_story ||
      product?.description ||
      "Each piece is handcrafted with timeless techniques passed down through generations.";

    const langCode =
      language === "te"
        ? "te-IN"
        : language === "hi"
        ? "hi-IN"
        : language === "ta"
        ? "ta-IN"
        : language === "bn"
        ? "bn-IN"
        : "en-IN";

    setIsSpeaking(true);
    Speech.speak(storyText, {
      language: langCode,
      rate: 0.9,
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false)
    });
  };

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading authentic craft details…</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.centerBox}>
        <Text style={styles.errorTitle}>Craft not found</Text>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/buyer");
          }}
        >
          <Text style={styles.backButtonText}>‹ Return to Marketplace</Text>
        </Pressable>
      </View>
    );
  }

  const imageUrl = product.enhanced_image_url || product.image_url;
  const mrp = Math.round((Number(product.price) || 0) * 1.25);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1C1C1C" />

      {addedToast && (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>Added {quantity} item(s) to Bag!</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Full Image Header with Top Overlays (Exact Match to Web Modal) */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl || "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800" }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Floating Top Nav on Image */}
          <View style={styles.imageNavRow}>
            <Pressable
              style={styles.iconCircle}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace("/buyer");
              }}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={20} color="#1C1C1C" />
            </Pressable>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                style={[styles.iconCircle, isSaved && styles.iconCircleActive]}
                onPress={handleToggleWishlist}
                hitSlop={10}
              >
                <Ionicons
                  name={isSaved ? "heart" : "heart-outline"}
                  size={20}
                  color={isSaved ? "#E11D48" : "#1C1C1C"}
                />
              </Pressable>

              <Pressable
                style={styles.iconCircle}
                onPress={() => router.push("/buyer-cart")}
                hitSlop={10}
              >
                <Ionicons name="bag-handle-outline" size={20} color="#1C1C1C" />
              </Pressable>
            </View>
          </View>

          {/* Category Tag on Image Bottom */}
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText}>
              {product.category || "Authentic Indian Craft"}
            </Text>
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.body}>
          {/* Craft Origin / Verification Banner (Conditional on real backend data) */}
          {(product.region_of_origin || product.verification_status === "VERIFIED") && (
            <View style={styles.giBanner}>
              <Ionicons name="shield-checkmark" size={18} color="#B85D19" style={{ marginRight: 8 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.giTitle}>
                  {product.region_of_origin ? `Origin: ${product.region_of_origin}` : "Authentic Artisan Craft"}
                </Text>
                <Text style={styles.giSub}>
                  {product.verification_status === "VERIFIED" ? "Platform Verified Artisan Work" : "Direct from craft maker"}
                </Text>
              </View>
            </View>
          )}

          {/* Title and Artisan Info */}
          <Text style={styles.productTitle}>{product.title || "Handcrafted Product"}</Text>

          <View style={styles.artisanContainer}>
            <Pressable
              style={styles.artisanRow}
              onPress={() => setShowArtisanModal(true)}
              hitSlop={6}
            >
              <Ionicons name="person-circle-outline" size={22} color={theme.colors.primary} style={{ marginRight: 6 }} />
              <View>
                <Text style={styles.artisanText}>
                  Crafted by <Text style={{ fontWeight: "800", color: theme.colors.ink }}>{product.artisan_name || "Registered Artisan"}</Text>
                </Text>
                <Text style={styles.viewArtisanLink}>View Artisan Profile ›</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.askArtisanBtn}
              onPress={() => setShowEnquiryModal(true)}
            >
              <Ionicons name="chatbubbles-outline" size={14} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.askArtisanText}>Ask Artisan</Text>
            </Pressable>
          </View>

          {/* Price & Delivery Info Block */}
          <View style={styles.priceCard}>
            <View style={styles.priceMainRow}>
              <View>
                <Text style={styles.priceCurrent}>₹{Number(product.price || 0).toLocaleString("en-IN")}</Text>
              </View>

              <View style={styles.stockBox}>
                <Text style={styles.stockBoxText}>
                  {product.stock > 0 ? "✓ " + product.stock + " In Stock" : "Pre-Order Available"}
                </Text>
              </View>
            </View>

            <View style={styles.ondcRow}>
              <Ionicons name="checkmark-done-circle" size={16} color="#2E7D32" style={{ marginRight: 6 }} />
              <Text style={styles.ondcText}>Direct Artisan Creation • Standard Delivery</Text>
            </View>
          </View>

          {/* Craft Story Section with Audio Narration */}
          <View style={styles.storyCard}>
            <View style={styles.storyHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                <Text style={{ fontSize: 18, marginRight: 6 }}>📜</Text>
                <Text style={styles.storyTitle}>Craft Story & Artisan Heritage</Text>
              </View>
              <Pressable
                style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]}
                onPress={handleToggleStorySpeech}
              >
                <Ionicons
                  name={isSpeaking ? "volume-high" : "volume-medium-outline"}
                  size={15}
                  color={isSpeaking ? "#FFFFFF" : theme.accent}
                />
                <Text style={[styles.audioBtnText, isSpeaking && styles.audioBtnTextActive]}>
                  {isSpeaking ? "Stop Voice" : "🔊 Listen"}
                </Text>
              </Pressable>
            </View>
            <Text style={styles.storyBody}>
              "{product.craft_story || product.description || "Each piece is handcrafted with timeless techniques passed down through generations. Natural organic materials are molded and painted with intricate heritage motifs."}"
            </Text>
          </View>

          {/* Craft Specifications */}
          <View style={styles.specCard}>
            <Text style={styles.specTitle}>AUTHENTICITY SPECIFICATIONS</Text>

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Craft Category</Text>
              <Text style={styles.specVal}>{product.category || "Handloom"}</Text>
            </View>
            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Materials Used</Text>
              <Text style={styles.specVal}>{product.materials || "Natural craft materials"}</Text>
            </View>
            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Origin Cluster</Text>
              <Text style={styles.specVal}>{product.region_of_origin || "India"}</Text>
            </View>
            <View style={styles.specDivider} />

            <View style={styles.specRow}>
              <Text style={styles.specLabel}>Fair Trade Policy</Text>
              <Text style={[styles.specVal, { color: "#2E7D32", fontWeight: "800" }]}>Fair-Trade Protected</Text>
            </View>
          </View>

          {/* Verified Customer Reviews Section */}
          <View style={styles.reviewsCard}>
            <View style={styles.reviewsHeader}>
              <View>
                <Text style={styles.reviewsEyebrow}>VERIFIED BUYER REVIEWS</Text>
                <View style={styles.ratingSummaryRow}>
                  <Ionicons name="star" size={18} color="#F59E0B" />
                  <Text style={styles.ratingBigText}>
                    {reviews.length > 0
                      ? (
                          reviews.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) /
                          reviews.length
                        ).toFixed(1)
                      : "No ratings yet"}
                  </Text>
                  {reviews.length > 0 && (
                    <Text style={styles.reviewsCountText}>
                      ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.verifiedTag}>
                <Ionicons name="shield-checkmark" size={13} color="#2E7D32" style={{ marginRight: 4 }} />
                <Text style={styles.verifiedTagText}>Verified Reviews</Text>
              </View>
            </View>

            {reviews.length === 0 ? (
              <View style={styles.noReviewsBox}>
                <Ionicons name="chatbox-ellipses-outline" size={24} color={theme.muted} style={{ marginBottom: 6 }} />
                <Text style={styles.noReviewsText}>
                  No reviews submitted yet. Be the first verified buyer to review after delivery!
                </Text>
              </View>
            ) : (
              reviews.map((r, i) => (
                <View key={"rev-" + (r.id || i)} style={styles.singleReview}>
                  <View style={styles.singleReviewTop}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={styles.reviewerAvatar}>
                        <Text style={styles.reviewerAvatarText}>
                          {(r.buyer_name || "Buyer")[0].toUpperCase()}
                        </Text>
                      </View>
                      <View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={styles.reviewerName}>{r.buyer_name || "Buyer"}</Text>
                          {!!r.verified_purchase && (
                            <Ionicons name="checkmark-circle" size={13} color="#2E7D32" />
                          )}
                        </View>
                        <Text style={styles.reviewDate}>
                          {r.created_at
                            ? new Date(r.created_at).toLocaleDateString("en-IN", {
                                month: "short",
                                day: "numeric",
                                year: "numeric"
                              })
                            : "Verified Buyer"}
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= (r.rating || 5) ? "star" : "star-outline"}
                          size={13}
                          color="#F59E0B"
                        />
                      ))}
                    </View>
                  </View>
                  {r.comment ? (
                    <Text style={styles.reviewComment}>{r.comment}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.bottomBar}>
        {/* Quantity Stepper */}
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            hitSlop={6}
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>
          <Text style={styles.stepQty}>{quantity}</Text>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setQuantity(quantity + 1)}
            hitSlop={6}
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>

        {/* Add to Cart Button */}
        <Pressable style={styles.addBagBtn} onPress={handleAddToCart}>
          <Ionicons name="bag-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
          <Text style={styles.addBagText}>Add to Bag</Text>
        </Pressable>

        {/* Buy Now Button */}
        <Pressable style={styles.buyNowBtn} onPress={handleBuyNow}>
          <Text style={styles.buyNowText}>Buy Now</Text>
        </Pressable>
      </View>

      {/* Direct Artisan Enquiry Modal */}
      <Modal
        visible={showEnquiryModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEnquiryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Inquire with Artisan</Text>
              <Pressable onPress={() => setShowEnquiryModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.colors.ink} />
              </Pressable>
            </View>

            <Text style={styles.modalSub}>
              Send a direct query to {product.artisan_name || "the master artisan"} regarding customization, materials, or delivery timelines:
            </Text>

            <TextInput
              style={styles.enquiryInput}
              placeholder="e.g. Can this craft piece be made in custom dimensions or colors?"
              placeholderTextColor={theme.colors.inkMuted}
              multiline
              numberOfLines={4}
              value={enquiryMessage}
              onChangeText={setEnquiryMessage}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <PrimaryButton
                title={sendingEnquiry ? "Sending..." : "Send Direct Message"}
                icon="send-outline"
                onPress={handleSendEnquiry}
                disabled={sendingEnquiry}
              />
              <OutlineButton
                title="Cancel"
                onPress={() => setShowEnquiryModal(false)}
                disabled={sendingEnquiry}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Real Master Artisan Heritage & Lineage Modal */}
      <Modal
        visible={showArtisanModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowArtisanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 20, marginRight: 6 }}>🏛️</Text>
                <Text style={styles.modalTitle}>Master Artisan Heritage</Text>
              </View>
              <Pressable onPress={() => setShowArtisanModal(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={theme.colors.ink} />
              </Pressable>
            </View>

            {loadingArtisan ? (
              <View style={{ paddingVertical: 30, alignItems: "center" }}>
                <ActivityIndicator size="small" color={theme.accent} />
                <Text style={{ marginTop: 8, color: theme.muted, fontSize: 12 }}>
                  Loading verified artisan lineage from database…
                </Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
                {/* Profile Banner */}
                <View style={styles.artisanProfileCard}>
                  <Image
                    source={{
                      uri:
                        artisanData?.avatar_url ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                          artisanData?.name || product.artisan_name || "Artisan"
                        )}`
                    }}
                    style={styles.artisanModalAvatar}
                  />
                  <Text style={styles.artisanModalName}>
                    {artisanData?.name || product.artisan_name || "Artisan"}
                  </Text>
                  <View style={styles.artisanBadgeRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#2E7D32" style={{ marginRight: 4 }} />
                    <Text style={styles.artisanBadgeText}>
                      {artisanData?.verification_status === "VERIFIED_ARTISAN"
                        ? "Verified Artisan Seller"
                        : artisanData?.verification_status === "PROFILE_COMPLETE"
                        ? "Profile Complete"
                        : "Registered Craft Maker"}
                    </Text>
                  </View>
                </View>

                {/* Quick Stats Grid */}
                <View style={styles.artisanStatsGrid}>
                  <View style={styles.artisanStatItem}>
                    <Text style={styles.artisanStatNumber}>
                      {artisanData?.experience_years ? `${artisanData.experience_years} Yrs` : "Experienced"}
                    </Text>
                    <Text style={styles.artisanStatLabel}>Experience</Text>
                  </View>
                  <View style={styles.artisanStatItem}>
                    <Text style={styles.artisanStatNumber}>
                      {artisanData?.total_products_count ?? 1}
                    </Text>
                    <Text style={styles.artisanStatLabel}>Craft Works</Text>
                  </View>
                  <View style={styles.artisanStatItem}>
                    <Text style={styles.artisanStatNumber}>
                      {artisanData?.average_rating && artisanData.average_rating > 0
                        ? `⭐ ${artisanData.average_rating}`
                        : "No ratings"}
                    </Text>
                    <Text style={styles.artisanStatLabel}>Artisan Rating</Text>
                  </View>
                </View>

                {/* Craft Bio */}
                <View style={styles.artisanBioBox}>
                  <Text style={styles.artisanBioHeading}>ABOUT THE ARTISAN</Text>
                  <Text style={styles.artisanBioText}>
                    {artisanData?.bio ||
                      product.craft_story ||
                      `${artisanData?.name || product.artisan_name || "This artisan"} specializes in traditional ${
                        artisanData?.craft || product.category || "handicrafts"
                      }.`}
                  </Text>
                </View>

                {/* Origin Location Info */}
                <View style={styles.artisanOriginRow}>
                  <Ionicons name="location-outline" size={16} color={theme.accent} style={{ marginRight: 6 }} />
                  <Text style={styles.artisanOriginText}>
                    Location:{" "}
                    <Text style={{ fontWeight: "700", color: theme.ink }}>
                      {artisanData?.location || product.region_of_origin || "India"}
                    </Text>
                  </Text>
                </View>

                {/* Message Artisan Action */}
                <View style={{ marginTop: 16 }}>
                  <PrimaryButton
                    title="Send Direct Craft Inquiry"
                    icon="chatbubbles-outline"
                    onPress={() => {
                      setShowArtisanModal(false);
                      setShowEnquiryModal(true);
                    }}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FAF9F6"
  },
  artisanContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  askArtisanBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: theme.colors.primaryLight + "30",
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted
  },
  askArtisanText: {
    fontSize: 12,
    fontWeight: "700",
    color: theme.colors.primary
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.ink
  },
  modalSub: {
    fontSize: 13,
    color: theme.colors.inkMuted,
    lineHeight: 18,
    marginBottom: 16
  },
  enquiryInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: theme.colors.ink,
    minHeight: 100,
    marginBottom: 16,
    backgroundColor: "#FAF9F6"
  },
  modalActions: {
    gap: 8
  },
  scroll: {
    paddingBottom: 110
  },
  imageContainer: {
    position: "relative",
    width: "100%",
    height: Platform.OS === "android" ? 360 : 340,
    backgroundColor: "#1C1C1C"
  },
  heroImage: {
    width: "100%",
    height: "100%"
  },
  imageNavRow: {
    position: "absolute",
    top: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 12 : 16,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3
  },
  iconCircleActive: {
    backgroundColor: "#FFE4E6"
  },
  categoryBadge: {
    position: "absolute",
    bottom: 12,
    left: 16,
    backgroundColor: "rgba(28, 28, 28, 0.85)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  body: {
    padding: 16
  },
  giBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FCEEE3",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EADFCF"
  },
  giTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#B85D19"
  },
  giSub: {
    fontSize: 11,
    color: "#8C7A6B",
    marginTop: 2
  },
  productTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: theme.ink,
    lineHeight: 28,
    marginBottom: 8
  },
  artisanRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16
  },
  artisanText: {
    fontSize: 13,
    color: theme.muted
  },
  priceCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 5,
    elevation: 1
  },
  priceMainRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10
  },
  priceCurrent: {
    fontSize: 26,
    fontWeight: "900",
    color: theme.ink
  },
  priceMrp: {
    fontSize: 14,
    color: "#9E9E9E",
    textDecorationLine: "line-through",
    marginRight: 8
  },
  discountTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E11D48",
    backgroundColor: "#FFE4E6",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  stockBox: {
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C8E6C9"
  },
  stockBoxText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32"
  },
  ondcRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F2EDE4"
  },
  ondcText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#356B4A"
  },
  storyCard: {
    backgroundColor: "#FAF6F0",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EADFCF",
    marginBottom: 16
  },
  storyHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8
  },
  storyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: theme.ink
  },
  storyBody: {
    fontSize: 13,
    fontStyle: "italic",
    color: "#5C4D43",
    lineHeight: 20
  },
  specCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  specTitle: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    color: theme.muted,
    marginBottom: 12
  },
  specRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6
  },
  specLabel: {
    fontSize: 13,
    color: theme.muted,
    fontWeight: "600"
  },
  specVal: {
    fontSize: 13,
    color: theme.ink,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right"
  },
  specDivider: {
    height: 1,
    backgroundColor: "#F2ECE1",
    marginVertical: 4
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: "#E8E5DF",
    gap: 8,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAF9F6",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    paddingHorizontal: 6,
    paddingVertical: 4
  },
  stepBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.ink
  },
  stepQty: {
    fontSize: 14,
    fontWeight: "800",
    marginHorizontal: 8,
    color: theme.ink
  },
  addBagBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.accent,
    paddingVertical: 13
  },
  addBagText: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.accent
  },
  buyNowBtn: {
    flex: 1.2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accent,
    borderRadius: 14,
    paddingVertical: 14
  },
  buyNowText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  toast: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    zIndex: 999,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 8
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700"
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#FAF9F6"
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: theme.muted
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.ink,
    marginBottom: 12
  },
  backButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 13
  },
  viewArtisanLink: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: "700",
    marginTop: 2
  },
  audioBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F4EFEA",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: "#E5DFD5"
  },
  audioBtnActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent
  },
  audioBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: theme.accent
  },
  audioBtnTextActive: {
    color: "#FFFFFF"
  },
  reviewsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E8E5DF"
  },
  reviewsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0ECE6"
  },
  reviewsEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    color: theme.colors.primary,
    letterSpacing: 1.2,
    marginBottom: 4
  },
  ratingSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  ratingBigText: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.ink
  },
  reviewsCountText: {
    fontSize: 12,
    color: theme.muted,
    fontWeight: "600"
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10
  },
  verifiedTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2E7D32"
  },
  noReviewsBox: {
    alignItems: "center",
    paddingVertical: 18
  },
  noReviewsText: {
    fontSize: 12,
    color: theme.muted,
    textAlign: "center",
    lineHeight: 18
  },
  singleReview: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F8F6F2"
  },
  singleReviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  reviewerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8
  },
  reviewerAvatarText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800"
  },
  reviewerName: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.ink
  },
  reviewDate: {
    fontSize: 10,
    color: theme.muted,
    fontWeight: "500"
  },
  reviewComment: {
    fontSize: 12,
    lineHeight: 18,
    color: "#4A4036"
  },
  artisanProfileCard: {
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0ECE6",
    marginBottom: 16
  },
  artisanModalAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: theme.accent,
    marginBottom: 8,
    backgroundColor: "#F3EFEA"
  },
  artisanModalName: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.ink,
    marginBottom: 4
  },
  artisanBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  artisanBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32"
  },
  artisanStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FAF6F0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 16
  },
  artisanStatItem: {
    flex: 1,
    alignItems: "center"
  },
  artisanStatNumber: {
    fontSize: 15,
    fontWeight: "900",
    color: theme.ink,
    marginBottom: 2
  },
  artisanStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: theme.muted,
    textTransform: "uppercase"
  },
  artisanBioBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E5DF",
    padding: 14,
    marginBottom: 14
  },
  artisanBioHeading: {
    fontSize: 10,
    fontWeight: "900",
    color: theme.accent,
    letterSpacing: 1.2,
    marginBottom: 6
  },
  artisanBioText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#4A4036"
  },
  artisanOriginRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    marginBottom: 10
  },
  artisanOriginText: {
    fontSize: 12,
    color: theme.muted
  }
});
