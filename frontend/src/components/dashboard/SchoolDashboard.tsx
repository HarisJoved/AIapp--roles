import React, { useState, useEffect } from 'react';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  MessageSquare, 
  FileText, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  Calendar,
  Activity
} from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';

interface DashboardStats {
  totalUsers: number;
  totalClasses: number;
  totalDocuments: number;
  totalChats: number;
  recentActivity: Array<{
    id: string;
    type: 'user_created' | 'class_created' | 'document_uploaded' | 'chat_started';
    message: string;
    timestamp: string;
    user?: string;
  }>;
  roleDistribution: {
    admin: number;
    supervisor: number;
    teacher: number;
    student: number;
  };
  classStats: {
    totalClasses: number;
    activeClasses: number;
    totalStudents: number;
    averageStudentsPerClass: number;
  };
}

interface User {
  user_id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'teacher' | 'student';
  status: 'active' | 'inactive' | 'suspended';
  created_at?: string;
  last_login?: string;
}

interface ClassAssignment {
  class_id: string;
  class_name: string;
  teacher_id: string;
  teacher_name?: string;
  students: string[];
  created_at?: string;
}

const SchoolDashboard: React.FC = () => {
  const { token, userInfo } = useAuthContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'classes' | 'activity'>('overview');

  useEffect(() => {
    if (token) {
      fetchDashboardData();
    }
  }, [token]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [usersRes, classesRes, documentsRes] = await Promise.all([
        fetch('/users/managed', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/users/classes', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/upload/list', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      const usersData = usersRes.ok ? await usersRes.json() : [];
      const classesData = classesRes.ok ? await classesRes.json() : [];
      const documentsData = documentsRes.ok ? await documentsRes.json() : [];

      setUsers(usersData);
      setClasses(classesData);

      // Calculate statistics
      const roleDistribution = usersData.reduce((acc: any, user: User) => {
        acc[user.role] = (acc[user.role] || 0) + 1;
        return acc;
      }, { admin: 0, supervisor: 0, teacher: 0, student: 0 });

      const totalStudents = classesData.reduce((sum: number, cls: ClassAssignment) => 
        sum + (cls.students?.length || 0), 0);

      const recentActivity = [
        ...usersData.slice(0, 3).map((user: User) => ({
          id: `user-${user.user_id}`,
          type: 'user_created' as const,
          message: `New ${user.role} ${user.name} joined`,
          timestamp: user.created_at || new Date().toISOString(),
          user: user.name
        })),
        ...classesData.slice(0, 2).map((cls: ClassAssignment) => ({
          id: `class-${cls.class_id}`,
          type: 'class_created' as const,
          message: `Class "${cls.class_name}" created`,
          timestamp: cls.created_at || new Date().toISOString(),
          user: cls.teacher_name
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

      setStats({
        totalUsers: usersData.length,
        totalClasses: classesData.length,
        totalDocuments: documentsData.documents?.length || 0,
        totalChats: 0, // This would need to be fetched from chat service
        recentActivity,
        roleDistribution,
        classStats: {
          totalClasses: classesData.length,
          activeClasses: classesData.length, // Assuming all classes are active
          totalStudents,
          averageStudentsPerClass: classesData.length > 0 ? Math.round(totalStudents / classesData.length) : 0
        }
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Users className="w-4 h-4 text-red-500" />;
      case 'supervisor': return <Activity className="w-4 h-4 text-blue-500" />;
      case 'teacher': return <GraduationCap className="w-4 h-4 text-green-500" />;
      case 'student': return <BookOpen className="w-4 h-4 text-gray-500" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_created': return <Users className="w-4 h-4 text-green-500" />;
      case 'class_created': return <GraduationCap className="w-4 h-4 text-blue-500" />;
      case 'document_uploaded': return <FileText className="w-4 h-4 text-purple-500" />;
      case 'chat_started': return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">School Management Dashboard</h1>
            <p className="text-blue-100 mt-2">
              Welcome back, {userInfo?.name || userInfo?.preferred_username || 'User'}!
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <div className="text-blue-100">Total Users</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
            <div className="flex items-center">
              <GraduationCap className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Classes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.classStats.activeClasses}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-purple-500">
            <div className="flex items-center">
              <FileText className="w-8 h-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Documents</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDocuments}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-orange-500">
            <div className="flex items-center">
              <BookOpen className="w-8 h-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Students</p>
                <p className="text-2xl font-bold text-gray-900">{stats.classStats.totalStudents}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-md">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'classes', label: 'Classes', icon: GraduationCap },
              { id: 'activity', label: 'Recent Activity', icon: Activity }
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
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Role Distribution */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Distribution</h3>
                  <div className="space-y-3">
                    {Object.entries(stats.roleDistribution).map(([role, count]) => (
                      <div key={role} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {getRoleIcon(role)}
                          <span className="text-sm font-medium text-gray-700 capitalize">{role}s</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${(count / stats.totalUsers) * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Class Statistics */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Class Statistics</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Average Students per Class</span>
                      <span className="text-sm font-medium text-gray-900">{stats.classStats.averageStudentsPerClass}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Classes</span>
                      <span className="text-sm font-medium text-gray-900">{stats.classStats.totalClasses}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total Students</span>
                      <span className="text-sm font-medium text-gray-900">{stats.classStats.totalStudents}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Users</h3>
              <div className="space-y-3">
                {users.slice(0, 10).map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getRoleIcon(user.role)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Classes Tab */}
          {activeTab === 'classes' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Active Classes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {classes.map((cls) => (
                  <div key={cls.class_id} className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{cls.class_name}</h4>
                      <span className="text-sm text-gray-500">{cls.students?.length || 0} students</span>
                    </div>
                    <p className="text-sm text-gray-600">Teacher: {cls.teacher_name || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && stats && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <div className="space-y-3">
                {stats.recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      {activity.user && (
                        <p className="text-xs text-gray-500">by {activity.user}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(activity.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchoolDashboard;
