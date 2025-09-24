import React, { useMemo, useState } from 'react';
import Papa, { ParseResult } from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuthContext } from '../../contexts/AuthContext';

type Role = 'admin' | 'supervisor' | 'teacher' | 'student';

interface Mapping {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  role?: Role;
}

interface Props {
  onClose: () => void;
  onComplete: () => void;
}

const BatchUserUpload: React.FC<Props> = ({ onClose, onComplete }) => {
  const { token } = useAuthContext();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [roleDefault, setRoleDefault] = useState<Role>('student');
  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState<{ total: number; success: number; failed: number }>({ total: 0, success: 0, failed: 0 });
  const [errors, setErrors] = useState<string[]>([]);

  const requiredFields = useMemo(() => ['name', 'username', 'email'], []);

  const handleFile = async (file: File) => {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res: ParseResult<Record<string, any>>) => {
          const data = res.data as Record<string, any>[];
          const hdrs = (res.meta.fields as string[] | undefined) || Object.keys(data[0] || {});
          setHeaders(hdrs);
          setRows(data);
        }
      });
      return;
    }
    if (ext && ['xlsx', 'xls'].includes(ext)) {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const json: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const hdrs = Object.keys(json[0] || {});
      setHeaders(hdrs);
      setRows(json);
      return;
    }
    alert('Unsupported file type. Please upload CSV or Excel.');
  };

  const setMap = (field: keyof Mapping, value: string) => setMapping(prev => ({ ...prev, [field]: value }));

  const isMappingValid = useMemo(() => requiredFields.every(f => (mapping as any)[f]), [mapping, requiredFields]);

  const startCreate = async () => {
    if (!isMappingValid) {
      alert('Please map all required fields.');
      return;
    }
    setCreating(true);
    setProgress({ total: rows.length, success: 0, failed: 0 });
    setErrors([]);
    let success = 0, failed = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const body = {
        name: r[mapping.name as string] || '',
        username: r[mapping.username as string] || '',
        email: r[mapping.email as string] || '',
        password: (mapping.password ? (r[mapping.password as string] || '12345678') : '12345678'),
        role: (mapping.role ? (r[mapping.role as string] || roleDefault) : roleDefault) as Role
      };
      try {
        const res = await fetch('/users/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        if (res.ok) success++; else { failed++; const err = await res.text(); setErrors(prev => [...prev, `Row ${i+1}: ${err}`]); }
      } catch (e: any) {
        failed++; setErrors(prev => [...prev, `Row ${i+1}: ${e?.message || 'Unknown error'}`]);
      }
      setProgress({ total: rows.length, success, failed });
    }
    setCreating(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Batch Create Users</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-800">✕</button>
        </div>

        {/* File input */}
        <div className="space-y-2">
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <p className="text-xs text-gray-500">Upload CSV or Excel with columns you want to map to user fields.</p>
        </div>

        {/* Mapping */}
        {headers.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(['name','username','email','password','role'] as (keyof Mapping)[]).map((f) => (
                <div key={f}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Map “{f}”{f === 'password' || f === 'role' ? ' (optional)' : ''}
                  </label>
                  <select value={(mapping as any)[f] || ''} onChange={(e) => setMap(f, e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select a column</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500">If no password column is mapped, a default password of 12345678 will be used.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default role (if no role column)</label>
                <select value={roleDefault} onChange={(e) => setRoleDefault(e.target.value as Role)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rows detected</label>
                <div className="px-3 py-2 border border-gray-200 rounded-md text-sm text-gray-700">{rows.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button disabled={!isMappingValid || creating || rows.length === 0} onClick={startCreate} className={`px-4 py-2 rounded-md text-white ${(!isMappingValid || rows.length === 0 || creating) ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {creating ? 'Creating…' : 'Create Users'}
          </button>
        </div>

        {/* Progress */}
        {(creating || progress.total > 0) && (
          <div className="mt-4 text-sm text-gray-700">
            Progress: {progress.success} succeeded, {progress.failed} failed, of {progress.total}
            {errors.length > 0 && (
              <div className="mt-2 max-h-32 overflow-auto text-red-600 space-y-1">
                {errors.map((e, idx) => (<div key={idx}>• {e}</div>))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BatchUserUpload;


