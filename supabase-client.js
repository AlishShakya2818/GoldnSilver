/*
 * Gold N Silver Rates
 * Supabase client configuration
 *
 * Add your actual project URL and publishable key
 * after the Supabase project has been created.
 */

const SUPABASE_URL = "https://rlbrlnnzmgpytqjmetfw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_G4bV2xNoWlb9_8EnoiOIlg_GJVhBFuj";

if (
    !window.supabase ||
    !window.supabase.createClient
) {
    throw new Error("Supabase JavaScript library has not loaded.");
}

if (
    SUPABASE_URL.startsWith("YOUR_") ||
    SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
) {
    console.warn("Supabase credentials have not been configured yet.");
} else {
    window.gnsSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );

    console.log("Gold N Silver Rates: Supabase client initialised.");
}
