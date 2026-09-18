import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  StatusBar,
  Platform,
  Pressable,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../src/api";
import { theme } from "../src/theme";

export default function SellerEnquiries() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.enquiries("seller")
      .then((x) => setItems(x || []))
      .catch((e) => Alert.alert("Error", e.message || "Failed to load enquiries"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FCF9F8" />

      {/* Top App Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color="#9F3C16" />
        </Pressable>
        <Text style={styles.topBarTitle}>Buyer Enquiries</Text>
        <Pressable onPress={load} style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="reload" size={18} color="#57423B" />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#9F3C16" />
          <Text style={styles.loadingText}>Fetching inquiries...</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={items}
          keyExtractor={(x, i) => String(x.id ?? i)}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.badgePill}>
                  <Text style={styles.badgeText}>ENQUIRY #{item.id || "NEW"}</Text>
                </View>
                <Text style={styles.dateText}>{item.created_at ? new Date(item.created_at).toLocaleDateString() : "Recent"}</Text>
              </View>
              <Text style={styles.name}>{item.subject || item.product_title || "Product Query"}</Text>
              <Text style={styles.meta}>{item.message || item.enquiry_text || "No message provided."}</Text>
              {item.buyer_name && (
                <View style={styles.buyerRow}>
                  <Ionicons name="person-outline" size={14} color="#8A726A" />
                  <Text style={styles.buyerName}>From: {item.buyer_name}</Text>
                </View>
              )}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="chatbubbles-outline" size={48} color="#DEC0B7" />
              <Text style={styles.emptyTitle}>No Enquiries Yet</Text>
              <Text style={styles.emptySub}>
                When prospective buyers ask questions about your crafts, they will appear here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FCF9F8"
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 28) + 10 : 12,
    paddingBottom: 12,
    backgroundColor: "#FCF9F8",
    borderBottomWidth: 1,
    borderBottomColor: "#F0EDED"
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F6F3F2",
    alignItems: "center",
    justifyContent: "center"
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#9F3C16"
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(222, 192, 183, 0.5)",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8
  },
  badgePill: {
    backgroundColor: "#FFDBCF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#822801"
  },
  dateText: {
    fontSize: 11,
    color: "#8A726A"
  },
  name: {
    fontWeight: "800",
    fontSize: 16,
    color: "#1B1C1C",
    marginBottom: 6
  },
  meta: {
    color: "#57423B",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8
  },
  buyerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderTopWidth: 1,
    borderTopColor: "#F0EDED",
    paddingTop: 8,
    marginTop: 4
  },
  buyerName: {
    fontSize: 12,
    color: "#8A726A",
    fontWeight: "600"
  },
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40
  },
  loadingText: {
    fontSize: 13,
    color: "#8A726A",
    marginTop: 10
  },
  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    marginTop: 40
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B1C1C",
    marginTop: 12
  },
  emptySub: {
    fontSize: 13,
    color: "#8A726A",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18
  }
});

