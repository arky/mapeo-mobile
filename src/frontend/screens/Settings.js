// @flow
import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
// import { Picker as OriginalPicker } from "@react-native-community/picker";
import HeaderTitle from "../sharedComponents/HeaderTitle";
import { FormattedMessage, defineMessages, useIntl } from "react-intl";
import * as DocumentPicker from "expo-document-picker";

import Button from "../sharedComponents/Button";
import ConfigContext from "../context/ConfigContext";
import type { Status } from "../types";

const m = defineMessages({
  settingsTitle: {
    id: "screens.Settings.title",
    defaultMessage: "Settings",
    description: "Title of settings screen"
  },
  currentConfig: {
    id: "screens.Settings.currentConfig",
    defaultMessage: "Current Configuration",
    description: "Label for name & version of current configuration"
  },
  projectKey: {
    id: "screens.Settings.projectKey",
    defaultMessage: "Project Key",
    description: "Label for project key"
  },
  unnamedConfig: {
    id: "screens.Settings.unnamedConfig",
    defaultMessage: "Un-named",
    description: "Config name when do name is defined"
  }
});

// const Picker = ({ label, children, ...props }) => (
//   <View style={styles.pickerWrapper}>
//     <Text style={styles.pickerLabel}>{label}</Text>
//     <View style={styles.picker}>
//       <OriginalPicker mode="dialog" {...props} prompt={label}>
//         {children}
//       </OriginalPicker>
//     </View>
//   </View>
// );

// Picker.Item = OriginalPicker.Item;

const Settings = () => {
  const { formatMessage: t } = useIntl();
  const [status, setStatus] = React.useState<Status>("idle");
  const [config, { replace: replaceConfig }] = React.useContext(ConfigContext);

  const handleImportPress = React.useCallback(async () => {
    setStatus("loading");
    const result = await DocumentPicker.getDocumentAsync();
    setStatus("idle");
    if (result.type === "success") replaceConfig(result.uri);
  }, [replaceConfig]);

  const configName =
    config.metadata.name || config.metadata.dataset_id || t(m.unnamedConfig);
  const configVersion = config.metadata.version;
  const projectKeySlice =
    config.metadata.projectKey && config.metadata.projectKey.slice(0, 5);

  return (
    <View style={styles.root}>
      <View style={styles.configInfo}>
        <Text style={styles.centerText}>
          <FormattedMessage {...m.currentConfig} />:
        </Text>
        <Text style={[styles.centerText, styles.configName]}>
          {configName}
          {configVersion && (
            <Text style={styles.configVersion}>{" v" + configVersion}</Text>
          )}
        </Text>
        <Text style={styles.centerText}>
          <FormattedMessage {...m.projectKey} />:
        </Text>
        <Text style={[styles.centerText, styles.projectKey]}>
          {projectKeySlice ? projectKeySlice + "**********" : "MAPEO"}
        </Text>
        {(status === "loading" || config.status === "loading") && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
          </View>
        )}
      </View>
      <Button
        disabled={status === "loading" || config.status === "loading"}
        variant="outlined"
        onPress={handleImportPress}>
        Import config
      </Button>
    </View>
  );
};

Settings.navigationOptions = {
  headerTitle: (
    <HeaderTitle>
      <FormattedMessage {...m.settingsTitle} />
    </HeaderTitle>
  )
};

export default Settings;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 20
  },
  // pickerWrapper: {
  //   marginBottom: 15
  // },
  // pickerLabel: {
  //   marginBottom: 5,
  //   marginLeft: 2
  // },
  // picker: {
  //   borderWidth: 1,
  //   borderColor: "#CCCCCC",
  //   borderStyle: "solid",
  //   borderRadius: 5,
  //   paddingLeft: 10
  // },
  configInfo: {
    marginBottom: 20,
    position: "relative"
  },
  centerText: {
    textAlign: "center"
  },
  configName: {
    fontWeight: "bold",
    color: "#444444",
    fontSize: 20,
    marginBottom: 10
  },
  configVersion: {
    fontWeight: "normal"
  },
  projectKey: {
    fontSize: 16,
    color: "#444444",
    fontFamily: "monospace",
    marginTop: 2
  },
  loadingContainer: {
    position: "absolute",
    width: "100%",
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center"
  }
});