# Układ i safe area

## Safe area

`react-native-safe-area-context` jest peerem Expo Router. Używasz `useSafeAreaInsets` albo `SafeAreaView` z tej biblioteki, nigdy `SafeAreaView` z `react-native`.

Uniwind ma też klasy safe area (skill `uniwind`, `references/variants-and-selectors.md`).

## Ekran ze Stack

Pierwszym elementem jest `ScrollView` albo lista z `contentInsetAdjustmentBehavior="automatic"`: natywny nagłówek i wcięcia układają się same. Dolne wcięcie dokładasz sam, gdy na dole jest pasek akcji.

## SDK 58 i iOS 27

Changelog SDK 58 ostrzega, że przy iPhone Duo i scene lifecycle `SafeAreaView` może być potrzebny w większej liczbie miejsc. Od iOS 27 aplikacje na iPhone'a mają zmienny rozmiar: `requireFullScreen` tego nie wyłącza, a `ScreenOrientation.lockAsync` może nie działać. Układ opierasz na rzeczywistych wymiarach (`useWindowDimensions`), nie na stałych urządzenia.

Źródła: https://docs.expo.dev/develop/user-interface/safe-areas/ , https://expo.dev/changelog/sdk-58

## Paski systemowe

`expo-status-bar`, a na Androidzie `expo-navigation-bar`: https://docs.expo.dev/develop/user-interface/system-bars/
