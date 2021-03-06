/* global __DEV__ */
// @flow
import * as React from "react";
import debug from "debug";
// import { useScreens } from "react-native-screens";
import SplashScreen from "react-native-splash-screen";
import AsyncStorage from "@react-native-community/async-storage";

import ErrorScreen from "./screens/UncaughtError";
import AppLoading from "./AppLoading";
import AppContainer from "./AppContainer";
import PermissionsContext from "./context/PermissionsContext";
import AppProvider from "./context/AppProvider";
import bugsnag from "./lib/logger";

// Turn on logging if in debug mode
if (__DEV__) debug.enable("*");
const log = debug("mapeo:App");
// WARNING: This needs to change if we change the navigation structure
const NAV_STORE_KEY = "@MapeoNavigation@5";

const persistNavigationState = async navState => {
  try {
    await AsyncStorage.setItem(NAV_STORE_KEY, JSON.stringify(navState));
  } catch (err) {
    log("Error saving navigation state", err);
  }
};
const loadNavigationState = async () => {
  const jsonString = await AsyncStorage.getItem(NAV_STORE_KEY);
  return JSON.parse(jsonString);
};

// Use native navigation screens, see: https://github.com/kmagiera/react-native-screens
// useScreens();

/**
 * Catches Javascript errors anywhere in the child component tree, logs the
 * errors and displays a fallback UI.
 */
class ErrorBoundary extends React.Component<
  {
    children: React.Node
  },
  {
    hasError: boolean
  }
> {
  state = {
    hasError: false
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // This is rendered outside AppLoading, so SpashScreen could still be
    // showing if error occurs in AppLoading before it's hidden
    SplashScreen.hide();
    bugsnag.notify(error, function(report) {
      report.severity = "error";
      report.metadata = {
        react: {
          componentStack: formatComponentStack(info.componentStack)
        }
      };
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return <ErrorScreen />;
  }
}

const App = () => (
  <ErrorBoundary>
    {/* Permissions provider must be before AppLoading because it waits for
        permissions before showing main app screen */}
    <PermissionsContext.Provider>
      <AppLoading>
        <AppProvider>
          <AppContainer
            persistNavigationState={persistNavigationState}
            loadNavigationState={loadNavigationState}
          />
        </AppProvider>
      </AppLoading>
    </PermissionsContext.Provider>
  </ErrorBoundary>
);

export default App;

const formatComponentStack = str => {
  const lines = str.split(/\s*\n\s*/g);
  let ret = "";
  for (let line = 0, len = lines.length; line < len; line++) {
    if (lines[line].length) ret += `${ret.length ? "\n" : ""}${lines[line]}`;
  }
  return ret;
};
