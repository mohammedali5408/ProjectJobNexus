'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';

type Template = {
  id: string;
  name: string;
  content: string;
  createdAt: any;
  updatedAt: any;
};

export default function MessageTemplatesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateContent, setTemplateContent] = useState('');
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  // Check authentication and fetch templates
  useEffect(() => {
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push('/signin');
        return;
      }
      
      await fetchTemplates(user.uid);
    };
    
    checkAuth();
  }, [router]);
  
  // Fetch message templates
  const fetchTemplates = async (userId: string) => {
    setIsLoading(true);
    try {
      const templatesQuery = query(
        collection(db, "messageTemplates"),
        where("userId", "==", userId)
      );
      
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesList: Template[] = [];
      
      templatesSnapshot.forEach((doc) => {
        const data = doc.data();
        templatesList.push({
          id: doc.id,
          name: data.name || '',
          content: data.content || '',
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null
        });
      });
      
      // Sort templates by name
      templatesList.sort((a, b) => a.name.localeCompare(b.name));
      
      setTemplates(templatesList);
    } catch (error) {
      console.error("Error fetching templates:", error);
      showNotification('error', 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Create a new template
  const createTemplate = async () => {
    if (!templateName.trim() || !templateContent.trim()) {
      showNotification('error', 'Please provide both a name and content for the template');
      return;
    }
    
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        router.push('/signin');
        return;
      }
      
      // Check if template name already exists
      const existingTemplate = templates.find(
        (template) => template.name.toLowerCase() === templateName.toLowerCase()
      );
      
      if (existingTemplate) {
        showNotification('error', 'A template with this name already exists');
        setIsLoading(false);
        return;
      }
      
      // Add template to Firestore
      await addDoc(collection(db, "messageTemplates"), {
        userId: user.uid,
        name: templateName,
        content: templateContent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Reset form and close modal
      setTemplateName('');
      setTemplateContent('');
      setShowCreateModal(false);
      
      // Refresh templates
      await fetchTemplates(user.uid);
      
      showNotification('success', 'Template created successfully');
    } catch (error) {
      console.error("Error creating template:", error);
      showNotification('error', 'Failed to create template');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update an existing template
  const updateTemplate = async () => {
    if (!currentTemplate || !templateName.trim() || !templateContent.trim()) {
      showNotification('error', 'Please provide both a name and content for the template');
      return;
    }
    
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        router.push('/signin');
        return;
      }
      
      // Check if template name already exists (excluding the current template)
      const existingTemplate = templates.find(
        (template) => 
          template.name.toLowerCase() === templateName.toLowerCase() && 
          template.id !== currentTemplate.id
      );
      
      if (existingTemplate) {
        showNotification('error', 'A template with this name already exists');
        setIsLoading(false);
        return;
      }
      
      // Update template in Firestore
      await updateDoc(doc(db, "messageTemplates", currentTemplate.id), {
        name: templateName,
        content: templateContent,
        updatedAt: serverTimestamp()
      });
      
      // Reset form and close modal
      setTemplateName('');
      setTemplateContent('');
      setCurrentTemplate(null);
      setShowEditModal(false);
      
      // Refresh templates
      await fetchTemplates(user.uid);
      
      showNotification('success', 'Template updated successfully');
    } catch (error) {
      console.error("Error updating template:", error);
      showNotification('error', 'Failed to update template');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Delete a template
  const deleteTemplate = async () => {
    if (!currentTemplate) return;
    
    setIsLoading(true);
    try {
      const user = auth.currentUser;
      if (!user) {
        router.push('/signin');
        return;
      }
      
      // Delete template from Firestore
      await deleteDoc(doc(db, "messageTemplates", currentTemplate.id));
      
      // Reset and close modal
      setCurrentTemplate(null);
      setShowDeleteModal(false);
      
      // Refresh templates
      await fetchTemplates(user.uid);
      
      showNotification('success', 'Template deleted successfully');
    } catch (error) {
      console.error("Error deleting template:", error);
      showNotification('error', 'Failed to delete template');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Show edit modal with template data
  const openEditModal = (template: Template) => {
    setCurrentTemplate(template);
    setTemplateName(template.name);
    setTemplateContent(template.content);
    setShowEditModal(true);
  };
  
  // Show delete confirmation modal
  const openDeleteModal = (template: Template) => {
    setCurrentTemplate(template);
    setShowDeleteModal(true);
  };
  
  // Show notification
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification({ type: '', message: '' });
    }, 5000);
  };
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <Header userRole="recruiter" />
      
      {/* Notification */}
      {notification.message && (
        <div className={`fixed top-20 right-4 z-50 p-4 rounded-md shadow-lg max-w-md ${
          notification.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
        }`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-32 pt-16 mb-6">
        <div className="container mx-auto max-w-6xl px-4">
          <h1 className="text-2xl font-bold text-white">Message Templates</h1>
        </div>
      </div>
      
      <div className="container mx-auto max-w-6xl px-4 pb-12">
        <div className="flex justify-between items-center mb-6">
          <p className="text-gray-500">
            Create and manage templates for common messages you send to candidates.
          </p>
          <button
            onClick={() => {
              setTemplateName('');
              setTemplateContent('');
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Create New Template
          </button>
        </div>
        
        {isLoading && templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 flex justify-center">
            <svg className="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">No templates yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating your first message template.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Create New Template
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <motion.div
                key={template.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => openEditModal(template)}
                        className="text-gray-400 hover:text-indigo-600"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => openDeleteModal(template)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="h-24 overflow-hidden">
                    <p className="text-sm text-gray-500 whitespace-pre-line line-clamp-4">
                      {template.content}
                    </p>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(template.content);
                        showNotification('success', 'Template copied to clipboard');
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                        <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                      </svg>
                      Copy
                    </button>
                    
                    <Link
                      href={`/recruiter/messages?template=${template.id}`}
                      className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center"
                    >
                      <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                      </svg>
                      Use Template
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      
      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Create Template</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="mb-4">
                <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Introduction, Interview Invitation, Follow Up"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="templateContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Content <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  You can use the following placeholders: [Name], [Your Name], [Company], [Position]
                </p>
                <textarea
                  id="templateContent"
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  placeholder="Type your message template here..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                ></textarea>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createTemplate}
                disabled={!templateName.trim() || !templateContent.trim() || isLoading}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                  !templateName.trim() || !templateContent.trim() || isLoading
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : 'Create Template'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Edit Template Modal */}
      {showEditModal && currentTemplate && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Edit Template</h3>
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="mb-4">
                <label htmlFor="editTemplateName" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="editTemplateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Introduction, Interview Invitation, Follow Up"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="editTemplateContent" className="block text-sm font-medium text-gray-700 mb-1">
                  Template Content <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  You can use the following placeholders: [Name], [Your Name], [Company], [Position]
                </p>
                <textarea
                  id="editTemplateContent"
                  value={templateContent}
                  onChange={(e) => setTemplateContent(e.target.value)}
                  placeholder="Type your message template here..."
                  rows={10}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  required
                ></textarea>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={updateTemplate}
                disabled={!templateName.trim() || !templateContent.trim() || isLoading}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                  !templateName.trim() || !templateContent.trim() || isLoading
                    ? 'bg-indigo-400 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </>
                ) : 'Update Template'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Delete Template Modal */}
      {showDeleteModal && currentTemplate && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Delete Template</h3>
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to delete the template "{currentTemplate.name}"? This action cannot be undone.
              </p>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteTemplate}
                disabled={isLoading}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                  isLoading ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : 'Delete Template'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}