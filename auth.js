
/*
 * Gold N Silver Rates
 * Authentication Service
 *
 * Handles:
 * - Registration
 * - Login
 * - Logout
 * - Password reset
 * - Current session
 * - Authentication state changes
 *
 * Requires supabase-client.js to load first.
 */

(function () {
    "use strict";

    function getClient() {
        if (!window.gnsSupabase) {
            throw new Error(
                "Supabase is not configured. Please check supabase-client.js."
            );
        }

        return window.gnsSupabase;
    }

    // REGISTER NEW USER
    async function signUp(email, password, displayName) {
        const client = getClient();

        if (!email || !password || !displayName) {
            throw new Error("Please complete all registration fields.");
        }

        if (password.length < 8) {
            throw new Error("Password must contain at least 8 characters.");
        }

        const { data, error } = await client.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
                data: {
                    display_name: displayName.trim()
                }
            }
        });

        if (error) throw error;

        return {
            user: data.user,
            session: data.session,
            message: data.session
                ? "Your account has been created."
                : "Check your email to confirm your account."
        };
    }

    // LOGIN
    async function signIn(email, password) {
        const client = getClient();

        if (!email || !password) {
            throw new Error("Email and password are required.");
        }

        const { data, error } = await client.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password
        });

        if (error) throw error;

        return data;
    }

    // LOGOUT
    async function signOut() {
        const client = getClient();

        const { error } = await client.auth.signOut();

        if (error) throw error;

        return true;
    }

    // PASSWORD RESET
    async function resetPassword(email) {
        const client = getClient();

        if (!email) {
            throw new Error("Please enter your email address.");
        }

        const { data, error } = await client.auth.resetPasswordForEmail(
            email.trim().toLowerCase()
        );

        if (error) throw error;

        return data;
    }

    // GET CURRENT SESSION
    async function getSession() {
        const client = getClient();

        const { data, error } = await client.auth.getSession();

        if (error) throw error;

        return data.session;
    }

    // GET CURRENT USER
    async function getCurrentUser() {
        const client = getClient();

        const { data, error } = await client.auth.getUser();

        if (error) throw error;

        return data.user;
    }

    // LISTEN FOR LOGIN / LOGOUT CHANGES
    function onAuthStateChange(callback) {
        const client = getClient();

        const { data } = client.auth.onAuthStateChange(
            (event, session) => {
                callback({
                    event,
                    session,
                    user: session?.user ?? null
                });
            }
        );

        return data.subscription;
    }

    // Expose authentication methods to the website.
    window.gnsAuth = {
        signUp,
        signIn,
        signOut,
        resetPassword,
        getSession,
        getCurrentUser,
        onAuthStateChange
    };

})();
