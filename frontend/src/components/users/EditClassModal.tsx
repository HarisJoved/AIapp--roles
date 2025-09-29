import React, { useState, useEffect } from 'react';
import { X, GraduationCap, Users, Settings } from 'lucide-react';

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

interface EditClassModalProps {
  classItem: ClassAssignment | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedClass: Partial<ClassAssignment>) => Promise<void>;
  teachers: User[];
  prompts: { prompt_id: string; name: string }[];
}

const EditClassModal: React.FC<EditClassModalProps> = ({
  classItem,
  isOpen,
  onClose,
  onSave,
  teachers,
  prompts
}) => {
  const [formData, setFormData] = useState({
    class_name: '',
    teacher_id: '',
    prompt_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (classItem && isOpen) {
      setFormData({
        class_name: classItem.class_name || '',
        teacher_id: classItem.teacher_id || '',
        prompt_id: classItem.prompt?.prompt_id || ''
      });
      setErrors({});
    }
  }, [classItem, isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.class_name.trim()) {
      newErrors.class_name = 'Class name is required';
    }

    if (!formData.teacher_id) {
      newErrors.teacher_id = 'Teacher is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save class:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen || !classItem) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <GraduationCap className="w-6 h-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Edit Class</h2>
              <p className="text-sm text-gray-500">Update class information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Class Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  value={formData.class_name}
                  onChange={(e) => handleInputChange('class_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.class_name ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter class name"
                />
                {errors.class_name && <p className="text-red-500 text-xs mt-1">{errors.class_name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Teacher *
                </label>
                <select
                  value={formData.teacher_id}
                  onChange={(e) => handleInputChange('teacher_id', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.teacher_id ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a teacher</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.user_id} value={teacher.user_id}>
                      {teacher.name} ({teacher.email})
                    </option>
                  ))}
                </select>
                {errors.teacher_id && <p className="text-red-500 text-xs mt-1">{errors.teacher_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  RAG Prompt
                </label>
                <select
                  value={formData.prompt_id}
                  onChange={(e) => handleInputChange('prompt_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No prompt assigned</option>
                  {prompts.map((prompt) => (
                    <option key={prompt.prompt_id} value={prompt.prompt_id}>
                      {prompt.name}
                    </option>
                  ))}
                </select>
                <p className="text-gray-500 text-xs mt-1">
                  Select a RAG prompt to assign to this class (optional)
                </p>
              </div>
            </div>
          </div>

          {/* Class Statistics */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Class Statistics</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Users className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Current Students</p>
                    <p className="text-lg font-bold text-gray-900">{classItem.students?.length || 0}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Current Prompt</p>
                    <p className="text-sm text-gray-900">{classItem.prompt?.name || 'None'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Teacher Info */}
          {classItem.teacher_name && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Current Teacher</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <GraduationCap className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">{classItem.teacher_name}</p>
                    <p className="text-sm text-blue-700">{classItem.teacher_email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>{loading ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditClassModal;
