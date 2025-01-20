/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference path="../.astro/types.d.ts" />
 
declare namespace App {
    // Note: 'import {} from ""' syntax does not work in .d.ts files.
    interface Locals {
        user: import("better-auth").User | null;
        session: import("better-auth").Session | null;
    }
}

interface ImportMetaEnv {
  readonly STRIPE_SECRET_KEY: string;
  readonly PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
  readonly STRIPE_WEBHOOK_SECRET: string;
  readonly MAILJET_API_KEY: string;
  readonly MAILJET_API_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
