# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# react-native-config reads the .env values from BuildConfig fields by name at
# runtime. Without this, R8 strips them and release builds lose SUPABASE_URL.
-keep class com.sharelith.app.BuildConfig { *; }

# Room databases are created by name at runtime (WorkManager's, pulled in by
# AdMob, crashed release builds on launch when R8 removed it).
-keep class * extends androidx.room.RoomDatabase { <init>(); }
