import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Settings, Upload, Search, FileText, Activity, MessageSquare, Users, GraduationCap, User as UserIcon, BarChart3, Home } from 'lucide-react';

// Components
import ErrorBoundary from './components/ErrorBoundary';
import EmbedderConfig from './components/config/EmbedderConfig';
import VectorDBConfig from './components/config/VectorDBConfig';
import ChatModelConfig from './components/config/ChatModelConfig';
import PromptManager from './components/config/PromptManager';
import DocumentUploader from './components/upload/DocumentUploader';
import DocumentList from './components/results/DocumentList';
import SearchInterface from './components/results/SearchInterface';
import ChatInterface from './components/chat/ChatInterface';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import KeycloakCallback from './components/auth/KeycloakCallback';
import UserManagement from './components/users/UserManagement';
import UserProfile from './components/users/UserProfile';
import ClassManagement from './components/users/ClassManagement';
import SchoolDashboard from './components/dashboard/SchoolDashboard';

// Services
import { configAPI, generalAPI } from './services/api';
import { AppConfig, HealthStatus, DocumentUploadResponse } from './types/api';

// Contexts
import { AuthProvider, useAuthContext } from './contexts/AuthContext';

// Layout Components
const Sidebar: React.FC = () => {
  const location = useLocation();
  const { isLogin, userInfo, logout } = useAuthContext();
  const [userPermissions, setUserPermissions] = useState<any>(null);
  
  const isActive = (path: string) => location.pathname === path;
  
  const linkClass = (path: string) => `
    flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
    ${isActive(path) 
      ? 'bg-blue-100 text-blue-700' 
      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'}
  `;

  // Fetch user permissions when logged in
  useEffect(() => {
    const fetchPermissions = async () => {
      if (isLogin && userInfo) {
        try {
          const token = localStorage.getItem('authToken');
          if (token) {
            console.log('DEBUG: Fetching permissions with token:', token.substring(0, 20) + '...');
            const response = await fetch('/users/permissions', {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('DEBUG: Permissions response status:', response.status);
            if (response.ok) {
              const permissions = await response.json();
              console.log('DEBUG: Received permissions:', permissions);
              setUserPermissions(permissions);
            } else {
              const errorText = await response.text();
              console.error('DEBUG: Permissions request failed:', response.status, errorText);
            }
          } else {
            console.log('DEBUG: No token available for permissions request');
          }
        } catch (error) {
          console.error('DEBUG: Failed to fetch permissions:', error);
        }
      }
    };

    fetchPermissions();
  }, [isLogin, userInfo]);

  // Check if user can access a page
  const canAccessPage = (page: string) => {
    if (!userPermissions) {
      // Fallback: only show chat and users if permissions haven't loaded yet
      // This prevents students from seeing upload page before permissions load
      const basicPages = ['chat', 'users', 'profile'];
      return basicPages.includes(page);
    }
    return userPermissions.accessible_pages?.includes(page) || false;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="w-64 bg-white shadow-md h-screen overflow-y-auto">
      <div className="p-6">
        <h1 className="text-xl font-bold text-gray-900">Document Embedder</h1>
        <p className="text-sm text-gray-600 mt-1">AI-Powered Document Platform</p>
        {isLogin && userInfo && (
          <div className="mt-3 p-2 bg-gray-50 rounded-md">
            {/* <p className="text-xs text-gray-600">Signed in as:</p>
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.name || user.preferred_username || user.email}
            </p> */}
          </div>
        )}
      </div>
      
      <nav className="px-4 space-y-1">
        {/* Debug info */}
        {isLogin && (
          <div className="px-3 py-2 text-xs text-gray-500 border-b mb-2">
            Permissions: {userPermissions ? 'Loaded' : 'Loading...'}
            {userPermissions && (
              <div>Role: {userPermissions.role}</div>
            )}
          </div>
        )}
        
        {/* Dashboard - Home */}
        <Link to="/" className={linkClass('/')}> 
          <Home className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        
        {/* Profile */}
        <Link to="/profile" className={linkClass('/profile')}> 
          <UserIcon className="w-4 h-4" />
          <span>My Profile</span>
        </Link>
        {/* Upload - Available to admin, supervisor, teacher */}
        {canAccessPage('upload') && (
          <Link to="/upload" className={linkClass('/upload')}> 
          <Upload className="w-4 h-4" />
          <span>Upload & Process</span>
        </Link>
        )}
        
        {/* Chat - Available to all roles */}
        {canAccessPage('chat') && (
        <Link to="/chat" className={linkClass('/chat')}>
          <MessageSquare className="w-4 h-4" />
          <span>AI Chat</span>
        </Link>
        )}
        
        {/* Search - Available to admin, supervisor, teacher */}
        {canAccessPage('search') && (
        <Link to="/search" className={linkClass('/search')}>
          <Search className="w-4 h-4" />
          <span>Search Documents</span>
        </Link>
        )}
        
        {/* Documents - Available to admin, supervisor, teacher */}
        {canAccessPage('documents') && (
        <Link to="/documents" className={linkClass('/documents')}>
          <FileText className="w-4 h-4" />
          <span>Document Library</span>
        </Link>
        )}
        
        {/* Users - Available to all roles (different views based on role) */}
        {canAccessPage('users') && (
          <Link to="/users" className={linkClass('/users')}>
            <Users className="w-4 h-4" />
            <span>Users</span>
          </Link>
        )}
        {/* Classes - Available to admin and supervisor */}
        {userPermissions && ['admin','supervisor'].includes(userPermissions.role) && (
          <Link to="/classes" className={linkClass('/classes')}>
            <GraduationCap className="w-4 h-4" />
            <span>Classes</span>
          </Link>
        )}
        
        {/* Configuration - Available to admin only */}
        {canAccessPage('config') && (
        <Link to="/config" className={linkClass('/config')}>
          <Settings className="w-4 h-4" />
          <span>Configuration</span>
        </Link>
        )}
        
        {/* Health - Available to admin only */}
        {canAccessPage('health') && (
        <Link to="/health" className={linkClass('/health')}>
          <Activity className="w-4 h-4" />
          <span>System Health</span>
        </Link>
        )}

        <div className="pt-4 border-t mt-4">
          {!isLogin ? (
            <>
              <Link to="/login" className={linkClass('/login')}>
                <span>Login</span>
              </Link>
              <Link to="/signup" className={linkClass('/signup')}>
                <span>Sign Up</span>
              </Link>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            >
              Logout
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

// Page Components
const UploadPage: React.FC<{ onUpload: () => void }> = ({ onUpload }) => {
  const handleUploadComplete = (response: DocumentUploadResponse) => {
    console.log('Upload completed:', response);
    onUpload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload & Process Documents</h2>
        <p className="text-gray-600 mt-1">Upload documents to be processed and embedded for search</p>
      </div>
      
      <DocumentUploader onUploadComplete={handleUploadComplete} />
    </div>
  );
};

const SearchPage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Search Documents</h2>
      <p className="text-gray-600 mt-1">Find relevant information across your document collection</p>
    </div>
    
    <SearchInterface />
  </div>
);

const DocumentsPage: React.FC<{ refreshTrigger: number }> = ({ refreshTrigger }) => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">Document Library</h2>
      <p className="text-gray-600 mt-1">Manage your uploaded documents and view processing status</p>
    </div>
    
    <DocumentList refreshTrigger={refreshTrigger} />
  </div>
);

const ChatPage: React.FC = () => (
  <div className="h-full -m-8">
    <ErrorBoundary>
      <ChatInterface className="h-screen" />
    </ErrorBoundary>
  </div>
);

const UsersPage: React.FC = () => {
  const { userInfo } = useAuthContext();
  const canManageUsers = userInfo && userInfo.resource_access?.['embedder-client']?.roles?.some(
    (role: string) => ['admin', 'supervisor', 'teacher'].includes(role)
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <p className="text-gray-600 mt-1">Manage users and class assignments in your organization</p>
      </div>
      {canManageUsers ? (
        <UserManagement />
      ) : (
        <div className="bg-white p-6 rounded-lg shadow text-gray-600">You do not have permission to manage users.</div>
      )}
    </div>
  );
};

const DashboardPage: React.FC = () => (
  <div className="space-y-6">
    <SchoolDashboard />
  </div>
);

const ProfilePage: React.FC = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-gray-900">My Profile</h2>
      <p className="text-gray-600 mt-1">View your account details and class assignments</p>
    </div>
    <UserProfile />
  </div>
);

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isLogin, isLoading } = useAuthContext();

  // Show loading spinner while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <h2 className="mt-4 text-lg font-medium text-gray-900">
                Checking Authentication
              </h2>
              <p className="mt-2 text-sm text-gray-600">
                Please wait while we verify your session...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLogin) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const ConfigPage: React.FC<{ onConfigUpdate: () => void }> = ({ onConfigUpdate }) => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'embedder' | 'vectordb' | 'chat' | 'prompts'>('embedder');

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await configAPI.getCurrentConfig();
        setConfig(response.config || null);
      } catch (error) {
        console.error('Failed to fetch config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleConfigUpdate = () => {
    onConfigUpdate();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading configuration...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'embedder', label: 'Embedder', icon: Upload },
    { id: 'vectordb', label: 'Vector Database', icon: FileText },
    { id: 'chat', label: 'Chat Model', icon: MessageSquare },
    { id: 'prompts', label: 'RAG Prompts', icon: Settings },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">System Configuration</h2>
        <p className="text-gray-600 mt-1">Configure your embedder, vector database, and chat model settings</p>
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'embedder' && (
          <EmbedderConfig 
            initialConfig={config?.embedder} 
            onConfigUpdate={handleConfigUpdate}
          />
        )}
        
        {activeTab === 'vectordb' && (
          <VectorDBConfig 
            initialConfig={config?.vector_db} 
            onConfigUpdate={handleConfigUpdate}
          />
        )}
        
        {activeTab === 'chat' && (
          <ChatModelConfig onConfigUpdate={handleConfigUpdate} />
        )}

        {activeTab === 'prompts' && (
          <PromptManager />
        )}
      </div>
    </div>
  );
};

const HealthPage: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      const response = await configAPI.checkServiceHealth();
      setHealth(response);
    } catch (error) {
      console.error('Failed to fetch health:', error);
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Checking system health...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Health</h2>
          <p className="text-gray-600 mt-1">Monitor the status of your embedder and vector database</p>
        </div>
        <button
          onClick={fetchHealth}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
      
      {health ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Embedder Health */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Embedder Status</h3>
            <div className={`flex items-center space-x-2 mb-3 ${
              health.embedder.healthy ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                health.embedder.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">
                {health.embedder.healthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
            {health.embedder.info && (
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Provider:</strong> {health.embedder.info.provider || 'Unknown'}</p>
                <p><strong>Model:</strong> {health.embedder.info.model_name || 'Unknown'}</p>
                <p><strong>Dimension:</strong> {health.embedder.info.dimension || 'Unknown'}</p>
              </div>
            )}
            {health.embedder.error && (
              <p className="text-sm text-red-600 mt-2">{health.embedder.error}</p>
            )}
          </div>

          {/* Vector DB Health */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">Vector Database Status</h3>
            <div className={`flex items-center space-x-2 mb-3 ${
              health.vector_db.healthy ? 'text-green-600' : 'text-red-600'
            }`}>
              <div className={`w-3 h-3 rounded-full ${
                health.vector_db.healthy ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span className="font-medium">
                {health.vector_db.healthy ? 'Healthy' : 'Unhealthy'}
              </span>
            </div>
            {health.vector_db.stats && (
              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>Total Vectors:</strong> {health.vector_db.stats.total_vectors || 0}</p>
                {health.vector_db.stats.collection_name && (
                  <p><strong>Collection:</strong> {health.vector_db.stats.collection_name}</p>
                )}
              </div>
            )}
            {health.vector_db.error && (
              <p className="text-sm text-red-600 mt-2">{health.vector_db.error}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md text-center">
          <p className="text-gray-600">Failed to fetch system health status</p>
        </div>
      )}
    </div>
  );
};

// App Layout Component (wrapped with Keycloak context)
const AppLayout: React.FC = () => {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleUpload = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleConfigUpdate = () => {
    // Could trigger health check refresh or other updates
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/auth/callback" element={<KeycloakCallback />} />
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/upload" element={<ProtectedRoute><UploadPage onUpload={handleUpload} /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
            <Route path="/documents" element={<ProtectedRoute><DocumentsPage refreshTrigger={refreshTrigger} /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
            <Route path="/classes" element={<ProtectedRoute><ClassManagement /></ProtectedRoute>} />
            <Route path="/config" element={<ProtectedRoute><ConfigPage onConfigUpdate={handleConfigUpdate} /></ProtectedRoute>} />
            <Route path="/health" element={<ProtectedRoute><HealthPage /></ProtectedRoute>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppLayout />
      </Router>
    </AuthProvider>
  );
};

export default App; 