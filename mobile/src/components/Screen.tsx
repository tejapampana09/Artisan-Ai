import React from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  backgroundColor?: string;
  statusBarStyle?: "dark-content" | "light-content";
  withBottomNavPadding?: boolean;
  safeArea?: boolean;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = true,
  safeArea = true,
  refreshing = false,
  onRefresh,
  style,
  contentContainerStyle,
  backgroundColor = theme.colors.bg,
  statusBarStyle = "dark-content",
  withBottomNavPadding = true
}) => {
  const insets = useSafeAreaInsets();

  const containerStyle: ViewStyle = {
    flex: 1,
    backgroundColor,
    paddingTop: insets.top,
    paddingLeft: insets.left,
    paddingRight: insets.right
  };

  const bottomPadding = withBottomNavPadding ? 80 : insets.bottom + 16;

  return (
    <View style={[styles.screen, containerStyle, style]}>
      <StatusBar
        barStyle={statusBarStyle}
        backgroundColor={backgroundColor}
        translucent={Platform.OS === "android"}
      />
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scrollable ? (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: bottomPadding },
              contentContainerStyle
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.staticContent, { paddingBottom: bottomPadding }, contentContainerStyle]}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1
  },
  keyboardAvoid: {
    flex: 1
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  staticContent: {
    flex: 1
  }
});
