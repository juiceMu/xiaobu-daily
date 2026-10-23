package com.smallsteps.checkin.identity

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.nio.charset.StandardCharsets
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec

private const val KEYSTORE = "AndroidKeyStore"
private const val KEY_ALIAS = "sprout.identity.v1"

class SproutIdentityModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SproutIdentity")

    AsyncFunction("getIdentity") {
      identityOrNull()
    }

    AsyncFunction("createIdentity") {
      ensureKey()
      identity()
    }

    AsyncFunction("sign") { payloadBase64: String ->
      val key = keyStore().getKey(KEY_ALIAS, null)
        ?: throw IllegalStateException("Android Keystore identity is not initialized")
      val signer = Signature.getInstance("SHA256withECDSA")
      signer.initSign(key as java.security.PrivateKey)
      signer.update(decode(payloadBase64))
      encode(signer.sign())
    }

    AsyncFunction("verify") {
        publicKeyBase64: String,
        payloadBase64: String,
        signatureBase64: String,
      ->
      try {
        val keyFactory = java.security.KeyFactory.getInstance("EC")
        val publicKey = keyFactory.generatePublic(
          java.security.spec.X509EncodedKeySpec(decode(publicKeyBase64)),
        )
        val verifier = Signature.getInstance("SHA256withECDSA")
        verifier.initVerify(publicKey)
        verifier.update(decode(payloadBase64))
        verifier.verify(decode(signatureBase64))
      } catch (_: Exception) {
        false
      }
    }

    AsyncFunction("forgetIdentity") {
      keyStore().deleteEntry(KEY_ALIAS)
    }
  }

  private fun keyStore(): KeyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }

  private fun ensureKey() {
    if (keyStore().containsAlias(KEY_ALIAS)) return
    val generator = KeyPairGenerator.getInstance(
      KeyProperties.KEY_ALGORITHM_EC,
      KEYSTORE,
    )
    val spec = KeyGenParameterSpec.Builder(
      KEY_ALIAS,
      KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY,
    )
      .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
      .setDigests(KeyProperties.DIGEST_SHA256)
      .setUserAuthenticationRequired(false)
      .build()
    generator.initialize(spec)
    generator.generateKeyPair()
  }

  private fun identityOrNull(): Map<String, Any>? {
    if (!keyStore().containsAlias(KEY_ALIAS)) return null
    return identity()
  }

  private fun identity(): Map<String, Any> {
    val certificate = keyStore().getCertificate(KEY_ALIAS)
      ?: throw IllegalStateException("Android Keystore public key is unavailable")
    val encoded = encode(certificate.publicKey.encoded)
    val digest = MessageDigest.getInstance("SHA-256")
      .digest(certificate.publicKey.encoded)
    val fingerprint = digest.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    return mapOf(
      "accountId" to "id-${fingerprint.substring(0, 32)}",
      "publicKey" to encoded,
      "fingerprint" to fingerprint,
      "keyEpoch" to 1,
    )
  }

  private fun decode(value: String): ByteArray =
    Base64.decode(value, Base64.NO_WRAP)

  private fun encode(value: ByteArray): String =
    Base64.encodeToString(value, Base64.NO_WRAP)
}
