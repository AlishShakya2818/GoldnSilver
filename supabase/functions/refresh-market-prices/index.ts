import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-market-refresh-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Only callers who know this separate refresh secret can run ingestion.
  const refreshSecret = Deno.env.get("MARKET_REFRESH_SECRET");
  const suppliedSecret = req.headers.get("x-market-refresh-secret");

  if (!refreshSecret || !suppliedSecret || suppliedSecret !== refreshSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const goldApiKey = Deno.env.get("GOLDAPI_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  // Supabase currently provides secret keys as a JSON dictionary.
  // The legacy service-role variable is retained as a fallback.
  let secretKey: string | undefined;

  try {
    const secretKeys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    );
    secretKey = secretKeys.default;
  } catch {
    secretKey = undefined;
  }

  secretKey ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!goldApiKey || !supabaseUrl || !secretKey) {
    console.error("A required server configuration is missing.");
    return jsonResponse({ error: "Server configuration incomplete" }, 500);
  }

  const supabase = createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const metals = [
    { metal: "gold", symbol: "XAU" },
    { metal: "silver", symbol: "XAG" },
  ];

  const saved: string[] = [];

  try {
    for (const item of metals) {
      const apiUrl =
        https://goldapi.dev/api/v1/price/${item.symbol}/USD;

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "X-API-Key": goldApiKey,
          "Accept": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          GoldAPI request failed for ${item.symbol}:,
          response.status,
          errorText.slice(0, 300),
        );
        throw new Error(
          Price provider returned HTTP ${response.status} for ${item.symbol},
        );
      }

      const data = await response.json();

      if (
        data.symbol !== item.symbol ||
        data.currency !== "USD" ||
        data.unit !== "oz" ||
        typeof data.price !== "number" ||
        !Number.isFinite(data.price) ||
        data.price <= 0 ||
        typeof data.updatedAt !== "string"
      ) {
        throw new Error(Invalid price response for ${item.symbol});
      }

      const observedAt = new Date(data.updatedAt);

      if (Number.isNaN(observedAt.getTime())) {
        throw new Error(Invalid observation timestamp for ${item.symbol});
      }

      const { error } = await supabase
        .from("market_price_cache")
        .upsert(
          {
            metal: item.metal,
            provider: "goldapi.dev",
            provider_symbol: ${item.symbol}/USD,
            quote_currency: "USD",
            price_per_troy_ounce: data.price,
            observed_at: observedAt.toISOString(),
            fetched_at: new Date().toISOString(),
            is_stale: false,
            raw_payload: data,
          },
          {
            onConflict:
              "metal,provider,provider_symbol,quote_currency",
          },
        );

      if (error) {
        console.error(Database save failed for ${item.symbol}:, error);
        throw new Error(Could not save ${item.symbol} price);
      }

      saved.push(item.metal);
    }

    return jsonResponse({
      success: true,
      updated: saved,
      provider: "goldapi.dev",
      currency: "USD",
      unit: "troy ounce",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Market price refresh failed:", error);

    return jsonResponse(
      {
        success: false,
        updated: saved,
        error: error instanceof Error
          ? error.message
          : "Market price refresh failed",
      },
      500,
    );
  }
});