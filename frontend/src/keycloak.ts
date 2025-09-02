import Keycloak from "keycloak-js";

// Define Keycloak configuration type
const keycloakConfig = {
  url: "https://auth.idtcities.com", // Keycloak server URL
  realm: "embedder", // Realm name
  clientId: "embedder-client", // Client ID
  "ssl-required": "external" as const,
  "public-client": true as const,
};

// @ts-ignore - Keycloak types are sometimes inconsistent
const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
