import { LogBox } from "react-native";
import { initCustomAlert } from "./alertService";

initCustomAlert();

LogBox.ignoreLogs([
  "expo-notifications",
  "Android Push notifications",
  "Use a development build instead of Expo Go",
  "SafeAreaView has been deprecated",
  "VirtualizedLists should never be nested",
  "The action 'GO_BACK' was not handled by any navigator",
  "Unable to activate keep awake",
  "KeepAwake",
  "Uncaught (in promise",
]);

if (typeof console !== "undefined") {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const fullText = args
      .map((a) => {
        if (!a) return "";
        if (a instanceof Error) return `${a.name} ${a.message} ${a.stack || ""}`;
        if (typeof a === "object") {
          try {
            return `${a.message || ""} ${JSON.stringify(a)}`;
          } catch {
            return String(a);
          }
        }
        return String(a);
      })
      .join(" ");

    if (
      fullText.includes("expo-notifications") ||
      fullText.includes("Android Push notifications") ||
      fullText.includes("Use a development build instead of Expo Go") ||
      fullText.includes("VirtualizedLists should never be nested") ||
      fullText.includes("The action 'GO_BACK' was not handled by any navigator") ||
      fullText.includes("Unable to activate keep awake") ||
      fullText.includes("KeepAwake") ||
      fullText.includes("uncaught (in promise")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}
