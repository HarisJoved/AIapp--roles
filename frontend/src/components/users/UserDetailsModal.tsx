import React from 'react';
import { X, User, Mail, Calendar, Shield, Users, GraduationCap, BookOpen, Clock, MapPin } from 'lucide-react';

interface User {
  user_id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'teacher' | 'student';
  status: 'active' | 'inactive' | 'suspended';
  created_by?: string;
  parent_id?: string;
  created_at?: string;
  last_login?: string;
  organization_id?: string;
  metadata?: Record<string, any>;
}

interface UserDetailsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (user: User) => void;
  onSendMail: (user: User) => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  isOpen,
  onClose,
  onEdit,
  onSendMail
}) => {
  if (!isOpen || !user) return null;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-5 h-5 text-red-500" />;
      case 'supervisor': return <Users className="w-5 h-5 text-blue-500" />;
      case 'teacher': return <GraduationCap className="w-5 h-5 text-green-500" />;
      case 'student': return <BookOpen className="w-5 h-5 text-gray-500" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-gray-600 bg-gray-100';
      case 'suspended': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            {getRoleIcon(user.role)}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-500">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Mail className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Email</p>
                  <p className="text-sm text-gray-900">{user.email}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {getRoleIcon(user.role)}
                <div>
                  <p className="text-sm font-medium text-gray-700">Role</p>
                  <p className="text-sm text-gray-900 capitalize">{user.role}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${user.status === 'active' ? 'bg-green-500' : user.status === 'suspended' ? 'bg-red-500' : 'bg-gray-500'}`}></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                    {user.status}
                  </span>
                </div>
              </div>
              
              {user.organization_id && (
                <div className="flex items-center space-x-3">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Organization ID</p>
                    <p className="text-sm text-gray-900 font-mono">{user.organization_id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Created</p>
                  <p className="text-sm text-gray-900">{formatDate(user.created_at)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Last Login</p>
                  <p className="text-sm text-gray-900">{formatDate(user.last_login)}</p>
                </div>
              </div>
              
              {user.created_by && (
                <div className="flex items-center space-x-3">
                  <User className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Created By</p>
                    <p className="text-sm text-gray-900 font-mono">{user.created_by}</p>
                  </div>
                </div>
              )}
              
              {user.parent_id && (
                <div className="flex items-center space-x-3">
                  <Users className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Parent ID</p>
                    <p className="text-sm text-gray-900 font-mono">{user.parent_id}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Metadata */}
          {user.metadata && Object.keys(user.metadata).length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Information</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                  {JSON.stringify(user.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* User ID */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">User ID</p>
              <p className="text-sm text-gray-900 font-mono break-all">{user.user_id}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onSendMail(user)}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            Send Email
          </button>
          <button
            onClick={() => onEdit(user)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit User
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserDetailsModal;
