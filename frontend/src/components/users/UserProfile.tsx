import React, { useState, useEffect } from 'react';
import { User, Mail, Calendar, Shield, GraduationCap, Users, BookOpen } from 'lucide-react';
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

      {/* Profile Card */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center space-x-3">
            {getRoleIcon(profile.role)}
            <div>
              <h3 className="text-lg font-medium text-gray-900">{profile.name}</h3>
              <p className="text-sm text-gray-500">@{profile.username}</p>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center space-x-1">
                <Mail className="w-4 h-4" />
                <span>Email</span>
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{profile.email}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Role</dt>
              <dd className="mt-1">
                <span className="inline-flex items-center space-x-1">
                  {getRoleIcon(profile.role)}
                  <span className="text-sm font-medium text-gray-900">
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </span>
                </span>
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(profile.status)}`}>
                  {profile.status.charAt(0).toUpperCase() + profile.status.slice(1)}
                </span>
              </dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Member Since</span>
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(profile.created_at)}</dd>
            </div>
            
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Login</dt>
              <dd className="mt-1 text-sm text-gray-900">{formatDate(profile.last_login)}</dd>
            </div>
            
            {profile.organization_id && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Organization ID</dt>
                <dd className="mt-1 text-sm text-gray-900">{profile.organization_id}</dd>
              </div>
            )}
          </dl>
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
