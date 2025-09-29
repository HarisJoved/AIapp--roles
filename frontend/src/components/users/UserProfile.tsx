import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Shield, GraduationCap, Users, BookOpen, Clock, MapPin, Activity, BarChart3, Settings, Edit, Bell } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'teacher' | 'student';
  status: 'active' | 'inactive' | 'suspended';
  created_by?: string;
  parent_id?: string;
  organization_id?: string;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  metadata?: Record<string, any>;
}

interface Teacher {
  user_id: string;
  name: string;
  email: string;
  username: string;
}

interface Student {
  user_id: string;
  name: string;
  email: string;
  username: string;
}

interface StudentAssignment {
  classes: Array<{
    class_id: string;
    class_name: string;
    teacher_id: string;
    students: string[];
    supervisor_id: string;
    created_by: string;
    created_at: string;
  }>;
  teachers: Array<{
    teacher_id: string;
    teacher_name: string;
    class_id: string;
    class_name: string;
  }>;
}

const UserProfileComponent: React.FC = () => {
  const { userInfo, token } = useAuthContext();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentAssignments, setStudentAssignments] = useState<StudentAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'settings'>('overview');

  useEffect(() => {
    if (token) {
      fetchUserProfile();
    }
  }, [token]);

  useEffect(() => {
    if (profile && profile.role === 'student' && token) {
      fetchStudentAssignments();
    }
  }, [profile, token]);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user profile
      const profileResponse = await fetch('/users/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!profileResponse.ok) {
        throw new Error('Failed to fetch profile');
      }
      
      const profileData = await profileResponse.json();
      setProfile(profileData);
      
      // If user is a teacher, fetch their students
      if (profileData.role === 'teacher') {
        const studentsResponse = await fetch(`/users/teachers/${profileData.user_id}/students`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (studentsResponse.ok) {
          const studentsData = await studentsResponse.json();
          setStudents(studentsData);
        }
      }
      
      // If user is a student, fetch their teachers
      if (profileData.role === 'student') {
        const teachersResponse = await fetch(`/users/students/${profileData.user_id}/teachers`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (teachersResponse.ok) {
          const teachersData = await teachersResponse.json();
          setTeachers(teachersData);
        }
      }
      
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch profile');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentAssignments = async () => {
    if (!profile) return;
    
    try {
      const response = await fetch(`/users/students/${profile.user_id}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStudentAssignments(data);
      }
    } catch (error) {
      console.error('Error fetching student assignments:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-5 h-5 text-red-500" />;
      case 'supervisor': return <Users className="w-5 h-5 text-blue-500" />;
      case 'teacher': return <GraduationCap className="w-5 h-5 text-green-500" />;
      case 'student': return <BookOpen className="w-5 h-5 text-purple-500" />;
      default: return <User className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100 border-green-200';
      case 'inactive': return 'text-gray-700 bg-gray-100 border-gray-200';
      case 'suspended': return 'text-red-700 bg-red-100 border-red-200';
      default: return 'text-gray-700 bg-gray-100 border-gray-200';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading profile...</span>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800 mb-2">Error Loading Profile</h3>
        <p className="text-red-600">{error || 'Profile not found'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              {getRoleIcon(profile.role)}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <p className="text-blue-100">@{profile.username} • {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</p>
              <div className="flex items-center space-x-4 mt-2">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                  profile.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : profile.status === 'suspended' 
                    ? 'bg-red-100 text-red-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                </span>
                <span className="text-blue-100 text-sm">
                  Member since {formatDate(profile.created_at)}
                </span>
              </div>
            </div>
          </div>
          <button className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors">
            <Edit className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Calendar className="w-8 h-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Account Created</p>
              <p className="text-lg font-bold text-gray-900">{formatDate(profile.created_at)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Last Login</p>
              <p className="text-lg font-bold text-gray-900">{formatDate(profile.last_login)}</p>
            </div>
          </div>
        </div>
        
        {profile.role === 'teacher' && (
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-purple-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Students</p>
                <p className="text-lg font-bold text-gray-900">{students.length}</p>
              </div>
            </div>
          </div>
        )}
        
        {profile.role === 'student' && (
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <GraduationCap className="w-8 h-8 text-orange-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Teachers</p>
                <p className="text-lg font-bold text-gray-900">{teachers.length}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: User },
              { id: 'activity', label: 'Activity', icon: Activity },
              { id: 'settings', label: 'Settings', icon: Settings }
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
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

        <div className="p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Email</p>
                        <p className="text-sm text-gray-900">{profile.email}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      {getRoleIcon(profile.role)}
                      <div>
                        <p className="text-sm font-medium text-gray-700">Role</p>
                        <p className="text-sm text-gray-900 capitalize">{profile.role}</p>
                      </div>
                    </div>
                    
                    {profile.organization_id && (
                      <div className="flex items-center space-x-3">
                        <MapPin className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Organization ID</p>
                          <p className="text-sm text-gray-900 font-mono">{profile.organization_id}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Calendar className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Account Created</p>
                        <p className="text-sm text-gray-900">{formatDate(profile.created_at)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Last Login</p>
                        <p className="text-sm text-gray-900">{formatDate(profile.last_login)}</p>
                      </div>
                    </div>
                    
                    {profile.updated_at && (
                      <div className="flex items-center space-x-3">
                        <Activity className="w-5 h-5 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-700">Last Updated</p>
                          <p className="text-sm text-gray-900">{formatDate(profile.updated_at)}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* System Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">User ID</p>
                  <p className="text-sm text-gray-900 font-mono break-all">{profile.user_id}</p>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">Account created</p>
                    <p className="text-xs text-gray-500">{formatDate(profile.created_at)}</p>
                  </div>
                </div>
                
                {profile.last_login && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Clock className="w-4 h-4 text-green-500" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">Last login</p>
                      <p className="text-xs text-gray-500">{formatDate(profile.last_login)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Account Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Bell className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Email Notifications</p>
                      <p className="text-xs text-gray-500">Receive notifications about important updates</p>
                    </div>
                  </div>
                  <button className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
                    Enable
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Settings className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Privacy Settings</p>
                      <p className="text-xs text-gray-500">Manage your privacy and data preferences</p>
                    </div>
                  </div>
                  <button className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">
                    Configure
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Teachers (for students) */}
      {profile.role === 'student' && teachers.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
              <GraduationCap className="w-5 h-5 text-green-500" />
              <span>Your Teachers</span>
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {teachers.map((teacher) => (
              <div key={teacher.user_id} className="px-6 py-4">
                <div className="flex items-center space-x-3">
                  <GraduationCap className="w-4 h-4 text-green-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{teacher.name}</div>
                    <div className="text-sm text-gray-500">{teacher.email}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Class Assignments (for students) */}
      {profile.role === 'student' && studentAssignments && studentAssignments.classes.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <span>Your Classes</span>
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200">
            {studentAssignments.classes.map((classItem) => (
              <div key={classItem.class_id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{classItem.class_name}</div>
                    <div className="text-sm text-gray-500">
                      Teacher: {studentAssignments.teachers.find(t => t.class_id === classItem.class_id)?.teacher_name || 'Unknown'}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(classItem.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Students (for teachers) */}
      {profile.role === 'teacher' && students.length > 0 && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-medium text-gray-900 flex items-center space-x-2">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <span>Your Students ({students.length})</span>
            </h3>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {students.map((student) => (
              <div key={student.user_id} className="px-6 py-4">
                <div className="flex items-center space-x-3">
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{student.name}</div>
                    <div className="text-sm text-gray-500">{student.email}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty states */}
      {profile.role === 'student' && teachers.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <GraduationCap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No teachers assigned yet</p>
        </div>
      )}

      {profile.role === 'teacher' && students.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <BookOpen className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-gray-600">No students assigned yet</p>
        </div>
      )}
    </div>
  );
};

export default UserProfileComponent;
