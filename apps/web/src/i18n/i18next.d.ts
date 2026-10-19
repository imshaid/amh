import "i18next";

import type bn from "./locales/bn.json";

// Bangla is the reference catalogue: every key used in code must exist in bn.json, and a test
// keeps en.json in step with it.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: {
      common: typeof bn;
    };
  }
}
