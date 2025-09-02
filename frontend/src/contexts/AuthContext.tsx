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
  const [token, setToken] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState<KeycloakTokenParsed>();
  const [roles, setRoles] = useState<string[]>([]);
  const CLIENT_ID = "idtcities";
  
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
        // Check if already initialized
        if (keycloak.authenticated !== undefined) {
          initialized.current = true;
          setIsLogin(!!keycloak.authenticated);
          if (keycloak.authenticated) {
            setToken(keycloak.token ?? null);
            if (keycloak.token) {
              sessionStorage.setItem("authToken", keycloak.token);
            }
            setUserInfo(keycloak.tokenParsed as KeycloakTokenParsed);
            setRoles(
              (keycloak.tokenParsed as KeycloakTokenParsed)?.resource_access?.[CLIENT_ID]?.roles || []
            );
            handleTokenExpiration();
          }
          return;
        }

        // Create initialization promise
        initPromise.current = keycloak.init({
          onLoad: "check-sso",
          checkLoginIframe: false,
          silentCheckSsoRedirectUri: "http://localhost:8880/silent-check-sso.html",
          pkceMethod: "S256",
        });

        const authenticated = await initPromise.current;
        
        initialized.current = true;
        setIsLogin(!!authenticated);
        
        console.log('DEBUG: Keycloak initialized, authenticated:', authenticated);
        console.log('DEBUG: keycloak.tokenParsed:', keycloak.tokenParsed);
        
        if (authenticated) {
          setToken(keycloak.token ?? null);
          if (keycloak.token) {
            sessionStorage.setItem("authToken", keycloak.token);
          }
          const parsedToken = keycloak.tokenParsed as KeycloakTokenParsed;
          console.log('DEBUG: Setting userInfo to:', parsedToken);
          setUserInfo(parsedToken);
          setRoles(
            parsedToken?.resource_access?.[CLIENT_ID]?.roles || []
          );
          handleTokenExpiration();
        }
      } catch (error: any) {
        console.error("Keycloak initialization failed", error);
        setIsLogin(false);
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
              sessionStorage.setItem("authToken", keycloak.token);
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
    sessionStorage.removeItem("authToken");
    keycloak.logout();
  };

  return (
    <AuthContext.Provider value={{ isLogin, token, userInfo, roles, login, logout }}>
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
