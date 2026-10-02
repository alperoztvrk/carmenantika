export const ENV = {
  get appId() {
    return process.env.VITE_APP_ID ?? "";
  },
  get cookieSecret() {
    return process.env.JWT_SECRET ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get oAuthServerUrl() {
    return process.env.OAUTH_SERVER_URL ?? "";
  },
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.BUILT_IN_FORGE_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.BUILT_IN_FORGE_API_KEY ?? "";
  },
  get stripeSecretKey() {
    return (process.env.STRIPE_SECRET_KEY ?? "").trim();
  },
  get stripeWebhookSecret() {
    return process.env.STRIPE_WEBHOOK_SECRET ?? "";
  },
  get stripePublishableKey() {
    return process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "";
  },
  get iyzicoApiKey() {
    return (process.env.IYZICO_API_KEY ?? "").trim();
  },
  get iyzicoSecretKey() {
    return (process.env.IYZICO_SECRET_KEY ?? "").trim();
  },
  get iyzicoBaseUrl() {
    return ((process.env.IYZICO_BASE_URL ?? "").trim() || "https://sandbox-api.iyzipay.com").replace(/\/$/, "");
  },
  get siteUrl() {
    return (process.env.SITE_URL ?? "").trim().replace(/\/$/, "");
  },
  get localAdminPassword() {
    return process.env.LOCAL_ADMIN_PASSWORD ?? "";
  },
};
