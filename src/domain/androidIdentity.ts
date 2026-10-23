import { requireNativeModule } from 'expo-modules-core';
import {
  createNativeSigningProvider,
  type NativeSigningIdentityModule,
  type SigningKeyProvider,
} from './identity';

/** Android 生产实现：私钥始终留在 Android Keystore，不经过 JS。 */
export function createAndroidKeystoreProvider(): SigningKeyProvider {
  return createNativeSigningProvider(
    requireNativeModule<NativeSigningIdentityModule>('SproutIdentity'),
  );
}
