// @flow
import React from "react";
import {
  type NavigationScreenProp,
  createStackNavigator
} from "react-navigation";
import { StatusBar } from "react-native";
import { IntroPager, IntroInfo } from "@digidem/wcmc-mapeo-mobile-intro";
import { useNavigationParam } from "react-navigation-hooks";

import HeaderTitle from "../../sharedComponents/HeaderTitle";
import CustomHeaderLeft from "../../sharedComponents/CustomHeaderLeft";

const InfoHeaderTitle = () => {
  const title = useNavigationParam("introInfoTitle");
  return <HeaderTitle>{title}</HeaderTitle>;
};

type InfoNavigationState = {|
  params: {|
    introInfoText: string,
    introInfoTitle: string
  |}
|};

const Info = ({
  navigation
}: {
  navigation: NavigationScreenProp<InfoNavigationState>
}) => {
  const text = navigation.getParam("introInfoText");

  return (
    <>
      <StatusBar hidden={false} />
      <IntroInfo markdownText={text} />
    </>
  );
};

Info.navigationOptions = {
  headerTitle: InfoHeaderTitle
};

const Intro = ({
  navigation
}: {
  navigation: NavigationScreenProp<InfoNavigationState>
}) => {
  const handleShowInfo = React.useCallback(
    ({ title, text }) => {
      navigation.navigate("Info", {
        introInfoTitle: title,
        introInfoText: text
      });
    },
    [navigation]
  );
  const handlePressComplete = React.useCallback(() => {
    navigation.navigate("App");
  }, [navigation]);
  return (
    <>
      <StatusBar hidden />
      <IntroPager
        onShowInfo={handleShowInfo}
        onPressComplete={handlePressComplete}
      />
    </>
  );
};

Intro.navigationOptions = {
  header: null
};

export default createStackNavigator(
  {
    Intro,
    Info
  },
  {
    defaultNavigationOptions: {
      headerStyle: {
        height: 60
      },
      headerLeft: CustomHeaderLeft,
      headerTitleStyle: {
        marginHorizontal: 0
      }
    }
  }
);