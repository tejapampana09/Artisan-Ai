import { View, Text, StyleSheet, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../src/theme";

export default function OrderConfirmation() {
  const params = useLocalSearchParams<{
    count?: string;
    total?: string;
    orderIds?: string;
    paymentMode?: string;
  }>();
  const count = Math.max(1, Number(params.count || 1));
  const total = Number(params.total || 0);
  const orderIds = params.orderIds?.split(",").filter(Boolean) || [];
  const paymentMode = params.paymentMode === "RAZORPAY" ? "Online Paid (Razorpay)" : "Cash on Delivery (COD)";

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.successCircle}>
          <Ionicons name="checkmark" size={48} color="#FFFFFF" />
        </View>
        <Text style={styles.eyebrow}>ORDER CONFIRMED</Text>
        <Text style={styles.title}>Your craft order is confirmed</Text>
        <Text style={styles.subtitle}>
          The artisan has received your order. We will keep you updated as it moves to dispatch.
        </Text>

        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Orders placed</Text>
            <Text style={styles.summaryValue}>{count} Handcrafted {count === 1 ? "Item" : "Items"}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount</Text>
            <Text style={styles.summaryValue}>₹{Math.round(total).toLocaleString("en-IN")}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Payment Mode</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons
                name={params.paymentMode === "RAZORPAY" ? "shield-checkmark" : "cash-outline"}
                size={14}
                color={params.paymentMode === "RAZORPAY" ? "#2E7D32" : theme.accent}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.summaryValue, { fontSize: 13 }]}>{paymentMode}</Text>
            </View>
          </View>
          {orderIds.length > 0 ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.orderIdLabel}>Order ID{orderIds.length > 1 ? "s" : ""}</Text>
              <Text style={styles.orderIds}>{orderIds.join("  ·  ")}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.timelineCard}>
          <View style={styles.timelineRow}>
            <Ionicons name="checkmark-circle" size={22} color={theme.colors.success} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>Order confirmed</Text>
              <Text style={styles.timelineSub}>Your order is safely recorded</Text>
            </View>
          </View>
          <View style={styles.timelineRow}>
            <Ionicons name="time-outline" size={22} color={theme.accent} />
            <View style={styles.timelineText}>
              <Text style={styles.timelineTitle}>Artisan dispatch next</Text>
              <Text style={styles.timelineSub}>Track updates from My Orders</Text>
            </View>
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={() => router.replace("/buyer-orders")}>
          <Ionicons name="receipt-outline" size={19} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>View My Orders</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.replace("/buyer")}>
          <Text style={styles.secondaryButtonText}>Continue Shopping</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.bg,
    justifyContent: "center",
    padding: 24
  },
  content: { alignItems: "center" },
  successCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: theme.colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 10
  },
  title: {
    color: theme.ink,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center"
  },
  subtitle: {
    color: theme.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 22
  },
  summaryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    marginBottom: 12
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: theme.muted, fontSize: 13 },
  summaryValue: { color: theme.ink, fontSize: 16, fontWeight: "900" },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  orderIdLabel: { color: theme.muted, fontSize: 11, marginBottom: 4 },
  orderIds: { color: theme.ink, fontSize: 12, fontWeight: "700" },
  timelineCard: {
    width: "100%",
    backgroundColor: "#FAF6F0",
    borderRadius: 16,
    padding: 16,
    marginBottom: 22
  },
  timelineRow: { flexDirection: "row", alignItems: "center", marginVertical: 6 },
  timelineText: { marginLeft: 10 },
  timelineTitle: { color: theme.ink, fontSize: 13, fontWeight: "800" },
  timelineSub: { color: theme.muted, fontSize: 11, marginTop: 2 },
  primaryButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: theme.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "900" },
  secondaryButton: { padding: 16 },
  secondaryButtonText: { color: theme.accent, fontSize: 14, fontWeight: "800" }
});
