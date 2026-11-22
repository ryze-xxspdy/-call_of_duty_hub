/** Types for things that live outside our own code (loaded from <script> tags or added at runtime). */
interface Window {
  STUDYHUB_CONFIG: { SUPABASE_URL: string; SUPABASE_ANON_KEY: string };
  supabase: any;
}

/** Errors thrown by Auth carry the ban details so the login page can show the pop-up. */
interface Error {
  ban?: any;
}
