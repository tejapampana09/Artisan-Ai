import { Alert } from "react-native";

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export interface CustomAlertData {
  id: string;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

type AlertListener = (data: CustomAlertData | null) => void;

let listener: AlertListener | null = null;
const originalAlert = Alert.alert.bind(Alert);

export function setCustomAlertListener(fn: AlertListener | null) {
  listener = fn;
}

export function showCustomAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) {
  if (listener) {
    listener({
      id: Math.random().toString(36).slice(2, 9),
      title: title || "",
      message: message || "",
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: "OK" }],
      options: options || { cancelable: true }
    });
  } else {
    // Fallback if UI is not yet registered
    originalAlert(title, message, buttons, options);
  }
}

export function hideCustomAlert() {
  if (listener) {
    listener(null);
  }
}

let isInitialized = false;

export function initCustomAlert() {
  if (isInitialized) return;
  isInitialized = true;

  (Alert as any).alert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => {
    showCustomAlert(title, message, buttons, options);
  };
}
