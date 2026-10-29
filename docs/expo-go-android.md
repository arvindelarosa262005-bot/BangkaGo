# Run BangkaGo on an Android phone

BangkaGo passenger and owner screens are one React Native/Expo mobile application. The administration console is a separate browser application.

## Expo Go: development and testing

Install/update Expo Go on the Android phone. This project uses Expo SDK 58; use a compatible Expo Go version. Keep the phone and computer on the same Wi-Fi, or connect the computer to the phone's hotspot.

From `C:\Boatsystem`:

```sh
npm run dev:go
```

Scan the development server's QR code using **Scan QR code inside Expo Go**. The URL must use the computer's Wi-Fi address, not 127.0.0.1/localhost (those refer to the phone when opened on the phone). Keep the development server running while testing. Edits can refresh through Metro/Fast Refresh.

If the network isolates devices, try `npm run start:tunnel -w @bangkago/mobile` and scan the new QR code. A tunnel requires internet and can be slower. No OS firewall/security settings are changed automatically.

An Android bundle compiling successfully proves packaging, not physical-phone rendering or network reachability. Scan the QR and review the actual device before considering phone testing complete.

Supabase configuration is still required for real login, bookings, payments and Realtime. Until the dedicated BangkaGo project is connected, the app displays its honest Not connected state. No credentials belong in a QR code.

Remote/background push is not supported in Expo Go. BangkaGo now avoids loading the push module in Expo Go and explains this limitation when the user taps Enable push notifications. In-app database updates are a separate feature and use the configured Supabase connection.

## APK: install the app without Expo Go

The supplied `apps/mobile/eas.json` includes a **preview** profile with Android `buildType: apk`. APK is the directly installable Android package. Before creating a real distributable build, sign in to the intended Expo account, link the app to the owner's EAS project, configure signing, and set the public Supabase variables in the EAS preview environment. Do not upload service-role/provider secrets as public build variables.

From `apps/mobile`, after reviewing EAS CLI help and completing the owner's account/project setup:

```sh
npx eas-cli@latest build --platform android --profile preview
```

EAS returns a build page and APK download when it actually succeeds. This repository configuration does **not** mean an APK has already been built, signed, installed or published. An Expo account, project ownership, signing and any applicable build costs must be resolved before starting a cloud build.

## Google Play: AAB

The **production** profile uses Android `buildType: app-bundle` and produces an AAB for Google Play distribution. AAB files are not directly installable like APKs. Google Play account setup and store review are separate from building the file.

```sh
npx eas-cli@latest build --platform android --profile production
```

References: [Start developing with Expo](https://docs.expo.dev/get-started/start-developing/), [APK builds](https://docs.expo.dev/build-reference/apk/), [EAS profiles](https://docs.expo.dev/build/eas-json/), [Expo Go notification limitations](https://docs.expo.dev/push-notifications/what-you-need-to-know/).
