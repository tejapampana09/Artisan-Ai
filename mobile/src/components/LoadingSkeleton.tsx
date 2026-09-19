import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, ViewStyle } from "react-native";
import { theme } from "../theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export const SkeletonBox: React.FC<SkeletonProps> = ({
  width = "100%",
  height = 20,
  borderRadius = theme.radius.sm,
  style
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.box,
        {
          width: width as any,
          height,
          borderRadius,
          opacity
        },
        style
      ]}
    />
  );
};

export const LoadingSkeleton = SkeletonBox;

export const ProductCardSkeleton: React.FC = () => {
  return (
    <View style={styles.cardSkeleton}>
      <SkeletonBox height={170} borderRadius={theme.radius.md} />
      <View style={{ marginTop: 10, gap: 6 }}>
        <SkeletonBox width="60%" height={12} />
        <SkeletonBox width="90%" height={16} />
        <SkeletonBox width="40%" height={14} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  box: {
    backgroundColor: "#E4DFD7"
  },
  cardSkeleton: {
    backgroundColor: "#FFFFFF",
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight
  }
});
