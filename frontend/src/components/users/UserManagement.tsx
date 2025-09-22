import React, { useState, useEffect } from 'react';
import { Plus, Users, Settings, Search, Eye, UserCheck, UserX, GraduationCap, Shield } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

// Types
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
}

interface UserCreationRequest {
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'teacher' | 'student';
  password: string;
  parent_id?: string;
  metadata?: Record<string, any>;
}

interface ClassAssignment {
  class_id: string;
  class_name: string;
  teacher_id: string;
  teacher_name?: string;
  teacher_email?: string;
  students: string[];
  supervisor_id: string;
  prompt?: { prompt_id: string; name: string; content?: string };
}

interface UserPermissions {
  role: string;
  accessible_pages: string[];
  can_create_roles: string[];
  role_level: number;
}

const UserManagement: React.FC = () => {
  const { userInfo, token } = useAuthContext();
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'classes' | 'create'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const USERS_PAGE_SIZE = 10;
  
  // User creation form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createUserData, setCreateUserData] = useState<UserCreationRequest>({
    username: '',
    email: '',
    name: '',
    role: 'student',
    password: ''
  });

  // Class management
  const [classes, setClasses] = useState<ClassAssignment[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [prompts, setPrompts] = useState<{ prompt_id: string; name: string }[]>([]);
  const [selectedPromptByClass, setSelectedPromptByClass] = useState<Record<string, string>>({});
  // UI state for managing large student lists per class
  const [expandedClass, setExpandedClass] = useState<Record<string, boolean>>({});
  const [studentSearchByClass, setStudentSearchByClass] = useState<Record<string, string>>({});
  const [studentPageByClass, setStudentPageByClass] = useState<Record<string, number>>({});
  const STUDENT_PAGE_SIZE = 10;

  useEffect(() => {
    if (token) {
      fetchUserPermissions();
      fetchManagedUsers();
      fetchClasses();
      fetchPrompts();
    }
  }, [token]);

  // Reset to first page on search term change
  useEffect(() => {
    setUserPage(1);
  }, [searchTerm]);

  const fetchUserPermissions = async () => {
    try {
      const response = await fetch('/users/permissions', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setPermissions(data);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  const fetchManagedUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/users/managed', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await fetch('/users/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setClasses(data);
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch('/chat/prompts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPrompts((data?.prompts || []).map((p: any) => ({ prompt_id: p.prompt_id, name: p.name })));
      }
    } catch (e) {
      console.error('Failed to fetch prompts', e);
    }
  };

  const assignStudentToClass = async (studentId: string, classId: string) => {
    try {
      const response = await fetch(`/users/classes/${classId}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ student_id: studentId })
      });

      if (response.ok) {
        alert('Student assigned to class successfully!');
        fetchClasses(); // Refresh classes to show updated student list
      } else {
        const error = await response.json();
        alert(`Failed to assign student: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error assigning student to class:', error);
      alert('Error assigning student to class');
    }
  };

  const unassignStudentFromClass = async (studentId: string, classId: string) => {
    if (!window.confirm('Are you sure you want to unassign this student from the class?')) {
      return;
    }

    try {
      const response = await fetch(`/users/classes/${classId}/students`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ student_id: studentId })
      });

      if (response.ok) {
        alert('Student unassigned from class successfully!');
        fetchClasses(); // Refresh classes to show updated student list
      } else {
        const error = await response.json();
        alert(`Failed to unassign student: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error unassigning student from class:', error);
      alert('Error unassigning student from class');
    }
  };

  const deleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Are you sure you want to delete the class "${className}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/users/classes/${classId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        alert('Class deleted successfully!');
        fetchClasses(); // Refresh classes list
      } else {
        const error = await response.json();
        alert(`Failed to delete class: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error deleting class:', error);
      alert('Error deleting class');
    }
  };

  const assignPromptToClass = async (classId: string, promptId: string) => {
    try {
      const response = await fetch(`/users/classes/${classId}/prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ prompt_id: promptId })
      });
      if (response.ok) {
        alert('Prompt assigned to class');
        await fetchClasses();
      } else {
        const error = await response.json();
        alert(`Failed to assign prompt: ${error.detail}`);
      }
    } catch (e) {
      console.error('Error assigning prompt', e);
    }
  };

  const clearPromptFromClass = async (classId: string) => {
    try {
      const response = await fetch(`/users/classes/${classId}/prompt`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        alert('Prompt cleared from class');
        await fetchClasses();
      } else {
        const error = await response.json();
        alert(`Failed to clear prompt: ${error.detail}`);
      }
    } catch (e) {
      console.error('Error clearing prompt', e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/users/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(createUserData)
      });

      if (response.ok) {
        setShowCreateForm(false);
        setCreateUserData({
          username: '',
          email: '',
          name: '',
          role: 'student',
          password: ''
        });
        fetchManagedUsers();
        alert('User created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create user: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: 'active' | 'inactive' | 'suspended') => {
    try {
      const response = await fetch(`/users/status/${userId}?status=${status}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        fetchManagedUsers();
        alert('User status updated successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to update status: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName || !selectedTeacher) return;

    try {
      const response = await fetch('/users/classes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          class_name: newClassName,
          teacher_id: selectedTeacher
        })
      });

      if (response.ok) {
        setNewClassName('');
        setSelectedTeacher('');
        fetchClasses(); // Refresh classes list
        alert('Class created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create class: ${error.detail}`);
      }
    } catch (error) {
      console.error('Error creating class:', error);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="w-4 h-4 text-red-500" />;
      case 'supervisor': return <Settings className="w-4 h-4 text-blue-500" />;
      case 'teacher': return <GraduationCap className="w-4 h-4 text-green-500" />;
      case 'student': return <Users className="w-4 h-4 text-gray-500" />;
      default: return <Users className="w-4 h-4" />;
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

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUserPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const userStart = (safeUserPage - 1) * USERS_PAGE_SIZE;
  const pagedUsers = filteredUsers.slice(userStart, userStart + USERS_PAGE_SIZE);

  const teachers = users.filter(user => user.role === 'teacher');

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading users...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600 mt-1">
            Manage users and class assignments in your organization
          </p>
        </div>
        
        {permissions && permissions.can_create_roles.length > 0 && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            <span>Create User</span>
          </button>
        )}
      </div>

      {/* Role and Permissions Info */}
      {permissions && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            {getRoleIcon(permissions.role)}
            <span className="font-medium text-blue-800">
              Your Role: {permissions.role.charAt(0).toUpperCase() + permissions.role.slice(1)}
            </span>
          </div>
          <p className="text-sm text-blue-600">
            You can create: {permissions.can_create_roles.join(', ') || 'None'}
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'users', label: 'Users', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
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

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>

          {/* Users List */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">Managed Users ({filteredUsers.length})</h3>
              <span className="text-xs text-gray-500">Page {safeUserPage} of {totalUserPages}</span>
            </div>
            
            <div className="divide-y divide-gray-200">
              {pagedUsers.map((user) => (
                <div key={user.user_id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {getRoleIcon(user.role)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(user.status)}`}>
                      {user.status}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      {user.status === 'active' && (
                        <button
                          onClick={() => handleUpdateUserStatus(user.user_id, 'suspended')}
                          className="text-red-600 hover:text-red-800"
                          title="Suspend user"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      
                      {user.status !== 'active' && (
                        <button
                          onClick={() => handleUpdateUserStatus(user.user_id, 'active')}
                          className="text-green-600 hover:text-green-800"
                          title="Activate user"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                      )}
                      
                      <button className="text-blue-600 hover:text-blue-800" title="View details">
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredUsers.length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500">
                  {searchTerm ? 'No users match your search.' : 'No users found.'}
                </div>
              )}
              {filteredUsers.length > 0 && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <button
                    disabled={safeUserPage <= 1}
                    onClick={() => setUserPage(Math.max(1, safeUserPage - 1))}
                    className={`px-3 py-1 text-sm rounded border ${safeUserPage <= 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Prev
                  </button>
                  <div className="text-xs text-gray-500">Showing {userStart + 1}-{Math.min(userStart + USERS_PAGE_SIZE, filteredUsers.length)} of {filteredUsers.length}</div>
                  <button
                    disabled={safeUserPage >= totalUserPages}
                    onClick={() => setUserPage(Math.min(totalUserPages, safeUserPage + 1))}
                    className={`px-3 py-1 text-sm rounded border ${safeUserPage >= totalUserPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Classes Tab */}
      {activeTab === 'classes' && permissions && ['admin', 'supervisor'].includes(permissions.role) && (
        <div className="space-y-6">
          {/* Create Class Form */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Class</h3>
            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Class Name
                  </label>
                  <input
                    type="text"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Math Grade 10A"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign Teacher
                  </label>
                  <select
                    value={selectedTeacher}
                    onChange={(e) => setSelectedTeacher(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.user_id} value={teacher.user_id}>
                        {teacher.name} ({teacher.email})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>

          {/* Classes List */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Existing Classes</h3>
            {classes.length === 0 ? (
              <p className="text-gray-500">No classes created yet.</p>
            ) : (
              <div className="space-y-4">
                {classes.map((classItem) => (
                  <div key={classItem.class_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-medium text-gray-900">{classItem.class_name}</h4>
                        <p className="text-sm text-gray-600">
                          Teacher: {classItem.teacher_name || 'Unknown'}
                        </p>
                        <p className="text-sm text-gray-600">
                          Students: {classItem.students?.length || 0}
                        </p>
                        <p className="text-sm text-gray-600">
                          Prompt: {classItem.prompt?.name || 'None'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteClass(classItem.class_id, classItem.class_name)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete class"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Assign Students to Class (collapsible + paginated) */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-gray-700">
                          Assign Students to this Class
                        </label>
                        <button
                          onClick={() => setExpandedClass({ ...expandedClass, [classItem.class_id]: !expandedClass[classItem.class_id] })}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {expandedClass[classItem.class_id] ? 'Hide' : 'Manage'} students ({classItem.students?.length || 0} assigned)
                        </button>
                      </div>

                      {/* Show assigned chips when collapsed */}
                      {!expandedClass[classItem.class_id] && (classItem.students?.length || 0) > 0 && (
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {classItem.students.slice(0, 10).map((sid) => {
                            const s = users.find(u => u.user_id === sid);
                            return (
                              <span key={sid} className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 border border-green-300">
                                {s?.name || sid}
                              </span>
                            );
                          })}
                          {classItem.students.length > 10 && (
                            <span className="text-xs text-gray-500">+{classItem.students.length - 10} more</span>
                          )}
                        </div>
                      )}

                      {expandedClass[classItem.class_id] && (
                        <div className="mt-3 space-y-3">
                          {/* Search input */}
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                              type="text"
                              value={studentSearchByClass[classItem.class_id] || ''}
                              onChange={(e) => {
                                setStudentSearchByClass({ ...studentSearchByClass, [classItem.class_id]: e.target.value });
                                setStudentPageByClass({ ...studentPageByClass, [classItem.class_id]: 1 });
                              }}
                              placeholder="Search students by name, email, or username"
                              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
                            />
                          </div>

                          {/* Paginated list */}
                          {(() => {
                            const search = (studentSearchByClass[classItem.class_id] || '').toLowerCase();
                            const allStudents = users.filter(u => u.role === 'student');
                            const filtered = search
                              ? allStudents.filter(s =>
                                  s.name.toLowerCase().includes(search) ||
                                  s.email.toLowerCase().includes(search) ||
                                  s.username.toLowerCase().includes(search)
                                )
                              : allStudents;
                            const page = studentPageByClass[classItem.class_id] || 1;
                            const totalPages = Math.max(1, Math.ceil(filtered.length / STUDENT_PAGE_SIZE));
                            const safePage = Math.min(page, totalPages);
                            const start = (safePage - 1) * STUDENT_PAGE_SIZE;
                            const pageItems = filtered.slice(start, start + STUDENT_PAGE_SIZE);
                            return (
                              <>
                                <div className="flex gap-2 flex-wrap">
                                  {pageItems.map((student) => {
                                    const isAssigned = classItem.students?.includes(student.user_id);
                                    return (
                                      <button
                                        key={student.user_id}
                                        onClick={() => isAssigned
                                          ? unassignStudentFromClass(student.user_id, classItem.class_id)
                                          : assignStudentToClass(student.user_id, classItem.class_id)
                                        }
                                        className={`px-3 py-1 text-sm rounded-full border ${
                                          isAssigned
                                            ? 'bg-green-100 border-green-300 text-green-800 hover:bg-red-100 hover:border-red-300 hover:text-red-800'
                                            : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-blue-100 hover:border-blue-300'
                                        }`}
                                        title={isAssigned ? 'Click to unassign' : 'Click to assign'}
                                      >
                                        {student.name}
                                        {isAssigned ? ' ✓' : ' +'}
                                      </button>
                                    );
                                  })}
                                  {pageItems.length === 0 && (
                                    <span className="text-sm text-gray-500">No students match your search.</span>
                                  )}
                                </div>
                                {/* Pagination controls */}
                                <div className="flex items-center justify-between mt-2">
                                  <span className="text-xs text-gray-500">Page {safePage} of {totalPages}</span>
                                  <div className="space-x-2">
                                    <button
                                      disabled={safePage <= 1}
                                      onClick={() => setStudentPageByClass({ ...studentPageByClass, [classItem.class_id]: Math.max(1, safePage - 1) })}
                                      className={`px-2 py-1 text-sm rounded border ${safePage <= 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                    >
                                      Prev
                                    </button>
                                    <button
                                      disabled={safePage >= totalPages}
                                      onClick={() => setStudentPageByClass({ ...studentPageByClass, [classItem.class_id]: Math.min(totalPages, safePage + 1) })}
                                      className={`px-2 py-1 text-sm rounded border ${safePage >= totalPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Assign Prompt to Class */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Assign RAG Prompt to this Class
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedPromptByClass[classItem.class_id] || ''}
                          onChange={(e) => setSelectedPromptByClass({ ...selectedPromptByClass, [classItem.class_id]: e.target.value })}
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select a prompt</option>
                          {prompts.map((p) => (
                            <option key={p.prompt_id} value={p.prompt_id}>{p.name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => {
                            const pid = selectedPromptByClass[classItem.class_id];
                            if (pid) assignPromptToClass(classItem.class_id, pid);
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                          Assign Prompt
                        </button>
                        {classItem.prompt && (
                          <button
                            onClick={() => clearPromptFromClass(classItem.class_id)}
                            className="px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New User</h3>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={createUserData.name}
                  onChange={(e) => setCreateUserData({...createUserData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={createUserData.username}
                  onChange={(e) => setCreateUserData({...createUserData, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={createUserData.email}
                  onChange={(e) => setCreateUserData({...createUserData, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={createUserData.role}
                  onChange={(e) => setCreateUserData({...createUserData, role: e.target.value as any})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {permissions?.can_create_roles.map((role) => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Password</label>
                <input
                  type="password"
                  value={createUserData.password}
                  onChange={(e) => setCreateUserData({...createUserData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
