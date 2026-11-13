import { Global, Module } from '@nestjs/common';
import { IdentityCrypto } from './identity-crypto.js';

// Provides one IdentityCrypto, built from the keys in backend/.env, to the whole app.
// The app refuses to start if the keys are missing, so personal data is never stored unprotected.
@Global()
@Module({
  providers: [{ provide: IdentityCrypto, useFactory: () => IdentityCrypto.fromEnv() }],
  exports: [IdentityCrypto],
})
export class IdentityModule {}
