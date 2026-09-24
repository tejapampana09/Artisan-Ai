export const theme = {
  colors: {
    primary: "#9F3C16", // Terracotta Heritage
    primaryDark: "#7B2E10",
    primaryLight: "#FBF3F0",
    primaryMuted: "#DEC0B7",
    
    accent: "#9F3C16", // Terracotta Artisan Accent
    accentLight: "#FBF3F0",
    accentDark: "#7B2E10",

    bg: "#FAF7F2", // Natural Warm Off-White Heritage Linen
    surface: "#FFFFFF",
    surfaceMuted: "#F5EFEB",
    card: "#FFFFFF",
    border: "#E8E2D9",
    borderLight: "#F0EDED",
    borderDark: "#D1C7BD",

    ink: "#1C1C1C", // Charcoal Text
    inkMuted: "#6B5B51", // Earthy Grey
    inkSubtle: "#8A726A",
    inkLight: "#A89A92",

    success: "#2E7D32", // Forest Green
    successLight: "#E8F5E9",
    successBorder: "#C8E6C9",

    warning: "#835500", // Amber
    warningLight: "#FFF8E1",
    warningBorder: "#FFE082",

    danger: "#C62828", // Crimson
    dangerLight: "#FFEBEE",
    dangerBorder: "#FFCDD2",

    info: "#1565C0", // Indigo
    infoLight: "#E3F2FD",
    infoBorder: "#BBDEFB",

    white: "#FFFFFF",
    black: "#000000",

    // Aliases
    background: "#FAF7F2",
    surfaceVariant: "#F5EFEB",
    error: "#C62828"
  },

  typography: {
    sizes: {
      xs: 11,
      sm: 12,
      md: 14,
      base: 15,
      lg: 17,
      xl: 20,
      xxl: 24,
      display: 30
    },
    weights: {
      regular: "400" as const,
      medium: "500" as const,
      semibold: "600" as const,
      bold: "700" as const,
      black: "900" as const
    },
    lineHeights: {
      tight: 1.15,
      normal: 1.35,
      relaxed: 1.5
    },
    h1: {
      fontSize: 24,
      fontWeight: "700" as const,
      color: "#1C1C1C"
    },
    h2: {
      fontSize: 20,
      fontWeight: "700" as const,
      color: "#1C1C1C"
    },
    h3: {
      fontSize: 17,
      fontWeight: "700" as const,
      color: "#1C1C1C"
    },
    subtitle: {
      fontSize: 15,
      fontWeight: "600" as const,
      color: "#1C1C1C"
    },
    body: {
      fontSize: 14,
      fontWeight: "400" as const,
      color: "#1C1C1C"
    },
    bodySmall: {
      fontSize: 12,
      fontWeight: "400" as const,
      color: "#6B5B51"
    },
    caption: {
      fontSize: 11,
      fontWeight: "500" as const,
      color: "#8A726A"
    }
  },

  spacing: {
    xxs: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32
  },

  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    full: 9999
  },

  press: {
    opacity: 0.85,
    scale: 0.98
  },

  shadows: {
    sm: {
      shadowColor: "#2A1E17",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1
    },
    md: {
      shadowColor: "#2A1E17",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2
    },
    lg: {
      shadowColor: "#2A1E17",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 4
    }
  },

  // Backward compatibility convenience properties
  bg: "#FAF7F2",
  surface: "#FFFFFF",
  card: "#FFFFFF",
  ink: "#1C1C1C",
  muted: "#6B5B51",
  accent: "#9F3C16",
  accentHover: "#7B2E10",
  accentLight: "#FBF3F0",
  border: "#E8E2D9",
  success: "#2E7D32",
  successLight: "#E8F5E9",
  warning: "#835500",
  rose: "#C62828",
  roseLight: "#FFEBEE"
};

export type Theme = typeof theme;
