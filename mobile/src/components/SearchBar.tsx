import React from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  ViewStyle
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: ViewStyle;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder = "Search authentic crafts, materials, stories…",
  onClear,
  style
}) => {
  return (
    <View style={[styles.container, style]}>
      <Ionicons
        name="search-outline"
        size={18}
        color={theme.colors.inkMuted}
        style={styles.searchIcon}
      />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkSubtle}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => {
            onChangeText("");
            onClear?.();
          }}
          hitSlop={8}
          style={styles.clearBtn}
        >
          <Ionicons name="close-circle" size={18} color={theme.colors.inkSubtle} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    height: 44,
    ...theme.shadows.sm
  },
  searchIcon: {
    marginRight: theme.spacing.sm
  },
  input: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.ink,
    paddingVertical: 0
  },
  clearBtn: {
    padding: 2
  }
});
