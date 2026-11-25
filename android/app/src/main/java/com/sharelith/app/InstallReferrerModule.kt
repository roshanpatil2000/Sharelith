package com.sharelith.app

import com.android.installreferrer.api.InstallReferrerClient
import com.android.installreferrer.api.InstallReferrerStateListener
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Reads the Play Store install referrer: the `referrer` parameter of the
 * store link that led to this install. Resolves null when there is none
 * (installs from outside the Play Store) or it can't be read.
 */
class InstallReferrerModule(context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {

  override fun getName() = "InstallReferrer"

  @ReactMethod
  fun getReferrer(promise: Promise) {
    val done = AtomicBoolean(false)
    fun finish(value: String?) {
      if (done.compareAndSet(false, true)) promise.resolve(value)
    }
    val client = try {
      InstallReferrerClient.newBuilder(reactApplicationContext).build()
    } catch (e: Exception) {
      finish(null)
      return
    }
    try {
      client.startConnection(object : InstallReferrerStateListener {
        override fun onInstallReferrerSetupFinished(code: Int) {
          val referrer =
            if (code == InstallReferrerClient.InstallReferrerResponse.OK) {
              try {
                client.installReferrer.installReferrer
              } catch (e: Exception) {
                null
              }
            } else {
              null
            }
          finish(referrer)
          client.endConnection()
        }

        override fun onInstallReferrerServiceDisconnected() {
          finish(null)
        }
      })
    } catch (e: Exception) {
      finish(null)
    }
  }
}

class InstallReferrerPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
    listOf(InstallReferrerModule(context))

  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
