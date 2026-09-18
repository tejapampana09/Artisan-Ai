import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  StatusBar,
  Pressable
} from "react-native";
import { router } from "expo-router";
import { getSession } from "../src/storage";

export default function Index() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    // 1. Fade-in and gentle zoom animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      })
    ]).start();

    // 2. Auto-transition into app after brief display (~1.4s)
    const timer = setTimeout(async () => {
      proceedToApp();
    }, 1400);

    return () => clearTimeout(timer);
  }, []);

  const proceedToApp = async () => {
    try {
      const session = await getSession();
      if (session.token && session.domain === "STUDIO") {
        router.replace("/seller");
        return;
      }
    } catch {
      // ignore
    }
    router.replace("/buyer");
  };

  return (
    <Pressable style={styles.container} onPress={proceedToApp}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Animated.View
        style={[
          styles.splashBox,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
      >
        {/* Brand Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/clean-logo-mark.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Brand Text (Exact match to web SplashScreen.jsx) */}
        <View style={styles.textContainer}>
          <Text style={styles.brandTitle}>
            Artisan <Text style={styles.accentAi}>AI</Text>
          </Text>
          <Text style={styles.brandTagline}>
            RURAL CRAFT COMMERCE & INTELLIGENCE
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20
  },
  splashBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  logoContainer: {
    width: 110,
    height: 110,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20
  },
  logo: {
    width: "100%",
    height: "100%"
  },
  textContainer: {
    alignItems: "center",
    justifyContent: "center"
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#2A1E17",
    letterSpacing: -0.5,
    marginBottom: 6
  },
  accentAi: {
    color: "#933D1E"
  },
  brandTagline: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B5B51",
    letterSpacing: 2.2,
    textTransform: "uppercase",
    textAlign: "center"
  }
});
