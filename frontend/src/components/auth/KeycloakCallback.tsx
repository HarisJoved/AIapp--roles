import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../../contexts/AuthContext';

const KeycloakCallback: React.FC = () => {
  const { isLogin, isLoading } = useAuthContext();
  const navigate = useNavigate();

  useEffect(() => {
    // If authenticated and not loading, redirect to home
    if (!isLoading && isLogin) {
      navigate('/');
    }
  }, [isLogin, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-4 text-lg font-medium text-gray-900">
              Processing Authentication
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please wait while we complete your sign-in...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeycloakCallback;