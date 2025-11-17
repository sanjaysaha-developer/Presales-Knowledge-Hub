import React, { useEffect, useState } from 'react';
import { templatesAPI } from '../services/api';

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    contract_type: '',
    version: '',
    content: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await templatesAPI.getAll({ active_only: true });
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result || '';
      setForm((prev) => ({
        ...prev,
        name: prev.name || file.name.replace(/\.[^/.]+$/, ''),
        content: typeof text === 'string' ? text : '',
      }));
    };
    reader.readAsText(file);
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      contract_type: '',
      version: '',
      content: '',
    });
    setShowUploader(false);
  };

  const submitTemplate = async () => {
    if (!form.name || !form.contract_type || !form.version || !form.content) {
      alert('Please fill in name, contract type, version, and select a template file or paste content.');
      return;
    }
    setIsSubmitting(true);
    try {
      await templatesAPI.create({
        name: form.name,
        description: form.description || undefined,
        contract_type: form.contract_type,
        version: form.version,
        content: form.content,
      });
      resetForm();
      await fetchTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
      alert(error?.response?.data?.message || 'Failed to create template');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Contract Templates</h1>
        <button
          type="button"
          onClick={() => setShowUploader((v) => !v)}
          className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 focus:outline-none"
        >
          {showUploader ? 'Close' : 'Upload Template'}
        </button>
      </div>

      {showUploader && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Master Services Agreement"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Contract Type</label>
                <input
                  type="text"
                  value={form.contract_type}
                  onChange={(e) => updateField('contract_type', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="MSA, NDA, SOW..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Version</label>
                <input
                  type="text"
                  value={form.version}
                  onChange={(e) => updateField('version', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="1.0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Short description"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Template File (.txt, .hbs, .md, .docx as text)</label>
              <input
                type="file"
                accept=".txt,.hbs,.md,.handlebars,.html,.docx,.rtf,.json"
                onChange={onFileChange}
                className="mt-1 block w-full text-sm text-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Or paste content</label>
              <textarea
                rows={6}
                value={form.content}
                onChange={(e) => updateField('content', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Paste template content here with {{placeholders}}"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={submitTemplate}
                disabled={isSubmitting}
                className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? 'Uploading...' : 'Save Template'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No templates found.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      Type: {template.contract_type} • v{template.version}
                    </span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
