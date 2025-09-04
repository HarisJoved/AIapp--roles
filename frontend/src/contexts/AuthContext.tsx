import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  ReactNode,
  useRef,
} from "react";
import keycloak from "../keycloak";

// Define proper types for Keycloak
interface KeycloakTokenParsed {
  sub?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email_verified?: boolean;
  realm_access?: any;
  resource_access?: any;
  [key: string]: any;
}

// Types for Auth Context
interface AuthContextType {
  isLogin: boolean;
  isLoading: boolean;
  token: string | null;
  userInfo: KeycloakTokenParsed | undefined;
  roles: string[];
  login: () => void;
  logout: () => void;
}

// Create context with undefined default (we'll enforce provider use later)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Props type for provider
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isLogin, setIsLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<KeycloakTokenParsed>();
  const [roles, setRoles] = useState<string[]>([]);
  const CLIENT_ID = "embedder-client";
  
  // Use ref to track initialization state
  const initialized = useRef(false);
  const initPromise = useRef<Promise<boolean> | null>(null);

  // Debug userInfo changes
  useEffect(() => {
    console.log('DEBUG: userInfo state changed:', userInfo);
  }, [userInfo]);

  useEffect(() => {
    // Prevent multiple initializations
    if (initialized.current || initPromise.current) {
      return;
    }

    const initKeycloak = async () => {
      try {
        // Check if already initialized and authenticated
        if (keycloak.authenticated === true && keycloak.token) {
          initialized.current = true;
          setIsLoading(false);
          setIsLogin(true);
          setToken(keycloak.token);
          localStorage.setItem("authToken", keycloak.token);
          setUserInfo(keycloak.tokenParsed as KeycloakTokenParsed);
          setRoles(
            (keycloak.tokenParsed as KeycloakTokenParsed)?.resource_access?.[CLIENT_ID]?.roles || []
          );
          handleTokenExpiration();
          return;
        }

        // Check for stored token as fallback
        const storedToken = localStorage.getItem("authToken");
        if (storedToken && !keycloak.authenticated) {
          // Try to restore session with stored token
          try {
            // Validate if token is still valid by attempting to parse it
            const tokenParts = storedToken.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              const currentTime = Math.floor(Date.now() / 1000);

              if (payload.exp && payload.exp > currentTime) {
                // Token is still valid, set it manually
                keycloak.token = storedToken;
                keycloak.tokenParsed = payload;
                initialized.current = true;
                setIsLoading(false);
                setIsLogin(true);
                setToken(storedToken);
                setUserInfo(payload as KeycloakTokenParsed);
                setRoles(
                  (payload as KeycloakTokenParsed)?.resource_access?.[CLIENT_ID]?.roles || []
                );
                handleTokenExpiration();
                return;
              } else {
                // Token expired, remove it
                localStorage.removeItem("authToken");
              }
            }
          } catch (error) {
            console.warn("Failed to restore session from stored token:", error);
            localStorage.removeItem("authToken");
          }
        }

        // Create initialization promise with improved configuration
        initPromise.current = keycloak.init({
          onLoad: "check-sso",
          checkLoginIframe: false,
          silentCheckSsoRedirectUri: window.location.origin + "/silent-check-sso.html",
          pkceMethod: "S256",
          enableLogging: false, // Disable verbose logging in production
        });

        const authenticated = await initPromise.current;

        initialized.current = true;
        setIsLoading(false);
        setIsLogin(!!authenticated);

        console.log('DEBUG: Keycloak initialized, authenticated:', authenticated);

        if (authenticated && keycloak.token) {
          setToken(keycloak.token);
          localStorage.setItem("authToken", keycloak.token);
          const parsedToken = keycloak.tokenParsed as KeycloakTokenParsed;
          console.log('DEBUG: Setting userInfo to:', parsedToken);
          setUserInfo(parsedToken);
          setRoles(
            parsedToken?.resource_access?.[CLIENT_ID]?.roles || []
          );
          handleTokenExpiration();
        } else {
          // Clear any stale data if not authenticated
          localStorage.removeItem("authToken");
        }
      } catch (error: any) {
        console.error("Keycloak initialization failed", error);
        setIsLoading(false);
        setIsLogin(false);
        localStorage.removeItem("authToken");
        initialized.current = true;
      } finally {
        initPromise.current = null;
      }
    };

    initKeycloak();

    // Cleanup function
    return () => {
      // Reset initialization state on unmount
      initialized.current = false;
      initPromise.current = null;
    };
  }, []);

  const handleTokenExpiration = () => {
    keycloak.onTokenExpired = () => {
      keycloak
        .updateToken(30)
        .then((refreshed: boolean) => {
          if (refreshed) {
            setToken(keycloak.token ?? null);
            if (keycloak.token) {
              localStorage.setItem("authToken", keycloak.token);
            }
            setUserInfo(keycloak.tokenParsed as KeycloakTokenParsed);
            setRoles(
              (keycloak.tokenParsed as KeycloakTokenParsed)?.resource_access?.[CLIENT_ID]?.roles || []
            );
          } else {
            console.warn("Token is still valid");
          }
        })
        .catch(() => {
          console.error("Failed to refresh token");
          setIsLogin(false);
          keycloak.logout();
        });
    };
  };

  const login = () => keycloak.login({ redirectUri: window.location.href });

  const logout = () => {
    localStorage.removeItem("authToken");
    keycloak.logout();
  };

  return (
    <AuthContext.Provider value={{ isLogin, isLoading, token, userInfo, roles, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};
