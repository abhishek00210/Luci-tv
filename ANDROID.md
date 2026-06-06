# Luci-TV Android APK

This project uses Capacitor as an Android wrapper around the hosted Luci-TV frontend.

Default app URL:

```txt
https://abhishekstreaming.vercel.app
```

To build with another hosted frontend URL, edit `capacitor.config.json`:

```json
{
  "server": {
    "url": "https://your-vercel-domain.vercel.app"
  }
}
```

Then sync Android:

```sh
npm run android:sync
```

The debug APK will be generated at:

```txt
android/app/build/outputs/apk/debug/app-debug.apk
```

Open the native project in Android Studio:

```sh
npm run android:open
```

Build requirements:

- Java Runtime / JDK
- Android Studio or Android SDK
- Android SDK build tools accepted licenses
