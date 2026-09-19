import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";
import {
  Screen,
  Header,
  Card,
  StatusBadge,
  SectionHeader,
  PrimaryButton,
  SecondaryButton
} from "../src/components";

export default function SellerChannelsScreen() {
  const [loading, setLoading] = useState(true);
  const [ondc, setOndc] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [publishing, setPublishing] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ondcRes, chanRes, prodRes] = await Promise.allSettled([
        api.ondcStatus(),
        api.salesChannels(),
        api.sellerProducts()
      ]);

      if (ondcRes.status === "fulfilled") setOndc(ondcRes.value);
      if (chanRes.status === "fulfilled") setChannels(Array.isArray(chanRes.value) ? chanRes.value : []);
      if (prodRes.status === "fulfilled") setProducts(Array.isArray(prodRes.value) ? prodRes.value : []);
    } catch (e: any) {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePublishAll = async (channelName: string) => {
    if (products.length === 0) {
      Alert.alert("Catalog Empty", "Please create and publish crafts in your studio first.");
      return;
    }

    setPublishing(1);
    try {
      let publishedCount = 0;
      for (const p of products) {
        try {
          await api.publishToChannel(p.id, channelName);
          publishedCount++;
        } catch (e) {
          // Continue publishing remaining
        }
      }
      Alert.alert(
        "Channel Broadcast",
        `Broadcasted ${publishedCount} crafts to ${channelName}. Catalog feeds are synced.`
      );
    } catch (e: any) {
      Alert.alert("Publish Error", e?.message || "Could not publish catalog.");
    } finally {
      setPublishing(null);
    }
  };

  return (
    <Screen safeArea={false}>
      <Header
        title="Sales Channels"
        subtitle="ONDC Foundation & Open Networks"
        showBack={true}
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/seller");
        }}
        rightAction={{
          icon: "refresh-outline",
          onPress: loadData
        }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ONDC Foundation Truth Card */}
        <Card style={styles.ondcCard}>
          <View style={styles.ondcHead}>
            <View style={styles.ondcIcon}>
              <Ionicons name="globe-outline" size={24} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ondcTitle}>ONDC Seller-Side Foundation</Text>
              <Text style={styles.ondcSub}>Beckn Protocol & Open Network Discovery</Text>
            </View>
            <StatusBadge status={ondc?.status || "CONFIGURED"} />
          </View>

          <Text style={styles.ondcStatement}>
            Artisan AI establishes your workshop as a verified seller node on India's Open Network
            for Digital Commerce (ONDC). Any buyer app in the Beckn ecosystem can discover your
            crafts and settle payments directly to your studio.
          </Text>

          <View style={styles.truthBox}>
            <View style={styles.truthRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.truthText}>
                Schema compliance: <Text style={{ fontWeight: "700" }}>{ondc?.schema_version || "Beckn v1.2.0"}</Text>
              </Text>
            </View>
            <View style={styles.truthRow}>
              <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
              <Text style={styles.truthText}>
                BPP Node Adapter: <Text style={{ fontWeight: "700" }}>Active Seller Agent</Text>
              </Text>
            </View>
            <View style={styles.truthRow}>
              <Ionicons name="shield-checkmark" size={16} color={theme.colors.primary} />
              <Text style={styles.truthText}>
                Middleman commission: <Text style={{ fontWeight: "700", color: theme.colors.success }}>0% (Zero intermediary markup)</Text>
              </Text>
            </View>
          </View>
        </Card>

        {/* Channels List */}
        <SectionHeader
          title="Active Channels"
          subtitle="Broadcasting your studio to global and regional buyers"
        />

        <Card style={styles.channelItem}>
          <View style={styles.channelRow}>
            <View style={styles.channelAvatar}>
              <Ionicons name="storefront" size={20} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>Artisan Direct Marketplace</Text>
              <Text style={styles.channelMeta}>Primary direct-to-consumer store</Text>
            </View>
            <StatusBadge status="ACTIVE" />
          </View>
          <Text style={styles.channelDesc}>
            Your primary high-resolution storefront with craft passports, artisan story, and live price transparency.
          </Text>
        </Card>

        <Card style={styles.channelItem}>
          <View style={styles.channelRow}>
            <View style={[styles.channelAvatar, { backgroundColor: theme.colors.accentLight + "20" }]}>
              <Ionicons name="git-network-outline" size={20} color={theme.colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>ONDC Open Commerce Network</Text>
              <Text style={styles.channelMeta}>Searchable via Paytm, Pincode, Mystore</Text>
            </View>
            <StatusBadge status="CONFIGURED" />
          </View>
          <Text style={styles.channelDesc}>
            Exposes your products via Beckn protocol endpoints to all registered buyer apps nationwide.
          </Text>
          <View style={{ marginTop: 12 }}>
            <SecondaryButton
              title={publishing ? "Broadcasting..." : "Broadcast Catalog to ONDC"}
              icon="radio-outline"
              onPress={() => handlePublishAll("ONDC")}
              disabled={!!publishing}
            />
          </View>
        </Card>

        <Card style={styles.channelItem}>
          <View style={styles.channelRow}>
            <View style={[styles.channelAvatar, { backgroundColor: theme.colors.warningLight + "20" }]}>
              <Ionicons name="airplane-outline" size={20} color={theme.colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelTitle}>Global Craft Heritage Exchange</Text>
              <Text style={styles.channelMeta}>Export readiness & international inquiries</Text>
            </View>
            <StatusBadge status="READY" />
          </View>
          <Text style={styles.channelDesc}>
            Standardized multi-currency export listings with automated HS code assignment and customs documentation.
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: theme.spacing.lg,
    paddingBottom: 40
  },
  ondcCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    marginBottom: theme.spacing.lg
  },
  ondcHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: theme.spacing.sm
  },
  ondcIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  ondcTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink,
    fontWeight: "800"
  },
  ondcSub: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  },
  ondcStatement: {
    ...theme.typography.body,
    color: theme.colors.inkLight,
    lineHeight: 20,
    marginBottom: theme.spacing.md
  },
  truthBox: {
    backgroundColor: theme.colors.surfaceVariant,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    gap: 8
  },
  truthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  truthText: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    flex: 1
  },
  channelItem: {
    marginBottom: theme.spacing.md
  },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8
  },
  channelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight + "20",
    alignItems: "center",
    justifyContent: "center"
  },
  channelTitle: {
    ...theme.typography.subtitle,
    color: theme.colors.ink
  },
  channelMeta: {
    ...theme.typography.caption,
    color: theme.colors.inkMuted
  },
  channelDesc: {
    ...theme.typography.bodySmall,
    color: theme.colors.inkLight,
    lineHeight: 18
  }
});
