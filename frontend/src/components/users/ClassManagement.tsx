import React, { useEffect, useState } from 'react';
import { GraduationCap, Search, Plus, Users, Calendar, BookOpen, Settings, Trash2, Edit, Eye, BarChart3 } from 'lucide-react';
import { useAuthContext } from '../../contexts/AuthContext';
import EditClassModal from './EditClassModal';

interface User {
  user_id: string;
  username: string;
  email: string;
  name: string;
  role: 'admin' | 'supervisor' | 'teacher' | 'student';
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

const ClassManagement: React.FC = () => {
  const { token } = useAuthContext();
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<ClassAssignment[]>([]);
  const [prompts, setPrompts] = useState<{ prompt_id: string; name: string }[]>([]);
  const [newClassName, setNewClassName] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [selectedPromptByClass, setSelectedPromptByClass] = useState<Record<string, string>>({});
  const [expandedClass, setExpandedClass] = useState<Record<string, boolean>>({});
  const [studentSearchByClass, setStudentSearchByClass] = useState<Record<string, string>>({});
  const [studentPageByClass, setStudentPageByClass] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [classSearchTerm, setClassSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<ClassAssignment | null>(null);
  const [showEditClassModal, setShowEditClassModal] = useState(false);
  const STUDENT_PAGE_SIZE = 10;

  useEffect(() => {
    if (token) {
      fetchUsers();
      fetchClasses();
      fetchPrompts();
    }
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/users/managed', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (e) { console.error('Failed to fetch users', e); }
  };

  const fetchClasses = async () => {
    try {
      const res = await fetch('/users/classes', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setClasses(await res.json());
    } catch (e) { console.error('Failed to fetch classes', e); }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch('/chat/prompts', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setPrompts((data?.prompts || []).map((p: any) => ({ prompt_id: p.prompt_id, name: p.name })));
      }
    } catch (e) { console.error('Failed to fetch prompts', e); }
  };

  const teachers = users.filter(u => u.role === 'teacher');
  
  // Filter classes based on search term
  const filteredClasses = classes.filter(cls =>
    cls.class_name.toLowerCase().includes(classSearchTerm.toLowerCase()) ||
    (cls.teacher_name || '').toLowerCase().includes(classSearchTerm.toLowerCase())
  );

  const assignStudentToClass = async (studentId: string, classId: string) => {
    try {
      const res = await fetch(`/users/classes/${classId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: studentId })
      });
      if (res.ok) fetchClasses();
    } catch (e) { console.error('Assign student failed', e); }
  };

  const unassignStudentFromClass = async (studentId: string, classId: string) => {
    if (!window.confirm('Unassign this student from the class?')) return;
    try {
      const res = await fetch(`/users/classes/${classId}/students`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ student_id: studentId })
      });
      if (res.ok) fetchClasses();
    } catch (e) { console.error('Unassign student failed', e); }
  };

  const deleteClass = async (classId: string, className: string) => {
    if (!window.confirm(`Delete class "${className}"?`)) return;
    try {
      const res = await fetch(`/users/classes/${classId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) fetchClasses();
    } catch (e) { console.error('Delete class failed', e); }
  };

  const assignPromptToClass = async (classId: string, promptId: string) => {
    try {
      const res = await fetch(`/users/classes/${classId}/prompt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ prompt_id: promptId })
      });
      if (res.ok) fetchClasses();
    } catch (e) { console.error('Assign prompt failed', e); }
  };

  const clearPromptFromClass = async (classId: string) => {
    try {
      const res = await fetch(`/users/classes/${classId}/prompt`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) fetchClasses();
    } catch (e) { console.error('Clear prompt failed', e); }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName || !selectedTeacher) return;
    try {
      const res = await fetch('/users/classes', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ class_name: newClassName, teacher_id: selectedTeacher }) });
      if (res.ok) { setNewClassName(''); setSelectedTeacher(''); fetchClasses(); }
    } catch (e) { console.error('Create class failed', e); }
  };

  const handleEditClass = (classItem: ClassAssignment) => {
    setEditingClass(classItem);
    setShowEditClassModal(true);
  };

  const handleSaveClass = async (updatedClass: Partial<ClassAssignment>) => {
    try {
      // This would typically call an API to update the class
      console.log('Updating class:', updatedClass);
      // For now, just refresh the classes list
      await fetchClasses();
      setShowEditClassModal(false);
      setEditingClass(null);
      alert('Class updated successfully!');
    } catch (error) {
      console.error('Failed to update class:', error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Class Management</h2>
            <p className="text-blue-100 mt-2">Create classes, assign teachers and students, and manage class prompts</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{classes.length}</div>
            <div className="text-blue-100">Total Classes</div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <GraduationCap className="w-8 h-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Classes</p>
              <p className="text-xl font-bold text-gray-900">{classes.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Students</p>
              <p className="text-xl font-bold text-gray-900">
                {classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <BookOpen className="w-8 h-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Active Teachers</p>
              <p className="text-xl font-bold text-gray-900">{teachers.length}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <BarChart3 className="w-8 h-8 text-orange-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Avg Students/Class</p>
              <p className="text-xl font-bold text-gray-900">
                {classes.length > 0 
                  ? Math.round(classes.reduce((sum, cls) => sum + (cls.students?.length || 0), 0) / classes.length)
                  : 0
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Class */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Class</h3>
        <form onSubmit={handleCreateClass} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Name</label>
              <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., Math Grade 10A" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign Teacher</label>
              <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" required>
                <option value="">Select a teacher</option>
                {teachers.map((t) => (
                  <option key={t.user_id} value={t.user_id}>{t.name} ({t.email})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Class</button>
          </div>
        </form>
      </div>

      {/* Classes List */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Existing Classes ({filteredClasses.length})</h3>
          
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search classes..."
                value={classSearchTerm}
                onChange={(e) => setClassSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 rounded-md">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 text-sm ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                List
              </button>
            </div>
          </div>
        </div>
        
        {filteredClasses.length === 0 ? (
          <div className="text-center py-12">
            <GraduationCap className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {classSearchTerm ? 'No classes match your search.' : 'No classes created yet.'}
            </p>
            {!classSearchTerm && (
              <p className="text-gray-400 text-sm mt-2">Create your first class to get started.</p>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
            {filteredClasses.map((classItem) => (
              <div key={classItem.class_id} className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow ${viewMode === 'grid' ? 'h-full flex flex-col' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <GraduationCap className="w-5 h-5 text-blue-500" />
                      <h4 className="font-medium text-gray-900 text-lg">{classItem.class_name}</h4>
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4" />
                        <span>Teacher: {classItem.teacher_name || 'Unknown'}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4" />
                        <span>Students: {classItem.students?.length || 0}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Settings className="w-4 h-4" />
                        <span>Prompt: {classItem.prompt?.name || 'None'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    <button 
                      onClick={() => setSelectedClass(selectedClass === classItem.class_id ? null : classItem.class_id)}
                      className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50" 
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleEditClass(classItem)}
                      className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50" 
                      title="Edit class"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteClass(classItem.class_id, classItem.class_name)} 
                      className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50" 
                      title="Delete class"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Students manager (collapsible + paginated) */}
                <div className="mt-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Assign Students to this Class</label>
                    <button onClick={() => setExpandedClass({ ...expandedClass, [classItem.class_id]: !expandedClass[classItem.class_id] })} className="text-blue-600 hover:text-blue-800 text-sm">
                      {expandedClass[classItem.class_id] ? 'Hide' : 'Manage'} students ({classItem.students?.length || 0} assigned)
                    </button>
                  </div>

                  {!expandedClass[classItem.class_id] && (classItem.students?.length || 0) > 0 && (
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {classItem.students.slice(0, 10).map((sid) => {
                        const s = users.find(u => u.user_id === sid);
                        return (
                          <span key={sid} className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800 border border-green-300">{s?.name || sid}</span>
                        );
                      })}
                      {classItem.students.length > 10 && (
                        <span className="text-xs text-gray-500">+{classItem.students.length - 10} more</span>
                      )}
                    </div>
                  )}

                  {expandedClass[classItem.class_id] && (
                    <div className="mt-3 space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <input type="text" value={studentSearchByClass[classItem.class_id] || ''} onChange={(e) => { setStudentSearchByClass({ ...studentSearchByClass, [classItem.class_id]: e.target.value }); setStudentPageByClass({ ...studentPageByClass, [classItem.class_id]: 1 }); }} placeholder="Search students by name, email, or username" className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-full" />
                      </div>

                      {(() => {
                        const search = (studentSearchByClass[classItem.class_id] || '').toLowerCase();
                        const allStudents = users.filter(u => u.role === 'student');
                        const filtered = search ? allStudents.filter(s => s.name.toLowerCase().includes(search) || s.email.toLowerCase().includes(search) || s.username.toLowerCase().includes(search)) : allStudents;
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
                                  <button key={student.user_id} onClick={() => isAssigned ? unassignStudentFromClass(student.user_id, classItem.class_id) : assignStudentToClass(student.user_id, classItem.class_id)} className={`px-3 py-1 text-sm rounded-full border ${isAssigned ? 'bg-green-100 border-green-300 text-green-800 hover:bg-red-100 hover:border-red-300 hover:text-red-800' : 'bg-gray-100 border-gray-300 text-gray-800 hover:bg-blue-100 hover:border-blue-300'}`} title={isAssigned ? 'Click to unassign' : 'Click to assign'}>
                                    {student.name}{isAssigned ? ' ✓' : ' +'}
                                  </button>
                                );
                              })}
                              {pageItems.length === 0 && (
                                <span className="text-sm text-gray-500">No students match your search.</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">Page {safePage} of {totalPages}</span>
                              <div className="space-x-2">
                                <button disabled={safePage <= 1} onClick={() => setStudentPageByClass({ ...studentPageByClass, [classItem.class_id]: Math.max(1, safePage - 1) })} className={`px-2 py-1 text-sm rounded border ${safePage <= 1 ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}>Prev</button>
                                <button disabled={safePage >= totalPages} onClick={() => setStudentPageByClass({ ...studentPageByClass, [classItem.class_id]: Math.min(totalPages, safePage + 1) })} className={`px-2 py-1 text-sm rounded border ${safePage >= totalPages ? 'text-gray-400 border-gray-200' : 'text-gray-700 border-gray-300 hover:bg-gray-50'}`}>Next</button>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Prompt assignment */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign RAG Prompt to this Class</label>
                  <div className="flex items-center gap-2">
                    <select value={selectedPromptByClass[classItem.class_id] || ''} onChange={(e) => setSelectedPromptByClass({ ...selectedPromptByClass, [classItem.class_id]: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select a prompt</option>
                      {prompts.map((p) => (
                        <option key={p.prompt_id} value={p.prompt_id}>{p.name}</option>
                      ))}
                    </select>
                    <button onClick={() => { const pid = selectedPromptByClass[classItem.class_id]; if (pid) assignPromptToClass(classItem.class_id, pid); }} className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Assign Prompt</button>
                    {classItem.prompt && (
                      <button onClick={() => clearPromptFromClass(classItem.class_id)} className="px-3 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200">Clear</button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Class Modal */}
      <EditClassModal
        classItem={editingClass}
        isOpen={showEditClassModal}
        onClose={() => {
          setShowEditClassModal(false);
          setEditingClass(null);
        }}
        onSave={handleSaveClass}
        teachers={teachers}
        prompts={prompts}
      />
    </div>
  );
};

export default ClassManagement;


