// Reading an undeclared import.meta.env variable is a type error. The build also refuses VITE_*
// variables that are not on the allowlist in src/lib/client-env-policy.ts.
interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
