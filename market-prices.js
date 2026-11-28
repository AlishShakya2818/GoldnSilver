(() => {
    const REFRESH_INTERVAL = 5 * 60 * 1000;
    const STALE_AFTER = 90 * 60 * 1000;

    const priceFormatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

    const nepalTimeFormatter = new Intl.DateTimeFormat("en-NP", {
        timeZone: "Asia/Kathmandu",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
    });

    function setText(id, value) {
        const element = document.getElementById(id);

        if (element) {
            element.textContent = value;
        }
    }

    function formatNepalTime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Time unavailable";
        }

        return nepalTimeFormatter.format(date) + " NPT";
    }

    function displayMetalPrice(metal, record) {
        const isGold = metal === "gold";

        const priceId = isGold
            ? "internationalGoldPrice"
            : "internationalSilverPrice";

        const updatedId = isGold
            ? "internationalGoldUpdated"
            : "internationalSilverUpdated";

        if (!record) {
            setText(priceId, "Unavailable");
            setText(updatedId, "No verified price available");
            return false;
        }

        const price = Number(record.price_per_troy_ounce);

        if (!Number.isFinite(price) || price <= 0) {
            setText(priceId, "Unavailable");
            setText(updatedId, "Invalid price data");
            return false;
        }

        const fetchedAt = new Date(record.fetched_at);
        const age = Date.now() - fetchedAt.getTime();

        const stale =
            record.is_stale ||
            Number.isNaN(fetchedAt.getTime()) ||
            age < 0 ||
            age > STALE_AFTER;

        setText(priceId, priceFormatter.format(price));

        const observed = formatNepalTime(record.observed_at);
        const fetched = formatNepalTime(record.fetched_at);

        setText(
            updatedId,
            stale
                ? `STALE · Provider updated ${observed} · Fetched ${fetched}`
                : `Provider updated ${observed} · Fetched ${fetched}`
        );

        return !stale;
    }

    async function loadInternationalPrices() {
        const status = document.getElementById(
            "internationalPriceStatus"
        );

        if (!window.gnsSupabase) {
            setText("internationalGoldPrice", "Unavailable");
            setText("internationalSilverPrice", "Unavailable");
            setText("internationalGoldUpdated", "Database connection unavailable");
            setText("internationalSilverUpdated", "Database connection unavailable");
            setText("internationalPriceStatus", "Connection unavailable");
            return;
        }

        if (status) {
            status.textContent = "Updating...";
        }

        try {
            const { data, error } = await window.gnsSupabase
                .from("market_price_cache")
                .select(`
                    metal,
                    provider,
                    price_per_troy_ounce,
                    quote_currency,
                    observed_at,
                    fetched_at,
                    is_stale
                `)
                .eq("provider", "goldapi.dev")
                .eq("quote_currency", "USD")
                .in("metal", ["gold", "silver"])
                .order("fetched_at", { ascending: false });

            if (error) {
                throw error;
            }

            const records = {};

            for (const record of data || []) {
                if (!records[record.metal]) {
                    records[record.metal] = record;
                }
            }

            const goldFresh = displayMetalPrice(
                "gold",
                records.gold
            );

            const silverFresh = displayMetalPrice(
                "silver",
                records.silver
            );

            if (goldFresh && silverFresh) {
                setText("internationalPriceStatus", "Prices updated");
            } else if (records.gold || records.silver) {
                setText("internationalPriceStatus", "Check data freshness");
            } else {
                setText("internationalPriceStatus", "No price data");
            }
        } catch (error) {
            console.error(
                "Could not load international market prices:",
                error
            );

            setText("internationalPriceStatus", "Unable to load prices");
            setText("internationalGoldPrice", "Unavailable");
            setText("internationalSilverPrice", "Unavailable");

            setText(
                "internationalGoldUpdated",
                "Price data temporarily unavailable"
            );

            setText(
                "internationalSilverUpdated",
                "Price data temporarily unavailable"
            );
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadInternationalPrices();

        // Read the Supabase cache every five minutes.
        // This does not make additional GoldAPI requests.
        window.setInterval(
            loadInternationalPrices,
            REFRESH_INTERVAL
        );
    });
})();