'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/app/lib/firebase';
import Header from '@/app/components/header';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  read: boolean;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentName?: string;
};

type Participant = {
  id: string;
  name: string;
  title: string;
  avatarUrl: string;
  email: string;
  phone: string;
  location: string;
};

type Job = {
  id: string;
  title: string;
  company: string;
};

type Conversation = {
  participants: string[];
  jobId?: string;
  lastMessage?: string;
  lastMessageTime?: Timestamp;
};

type MessageTemplate = {
  id: string;
  name: string;
  content: string;
};

export default function MessageDetailPage({ 
  params 
}: { 
  params: { id: string } 
}) {
  const router = useRouter();
  const conversationId = params.id;
  
  const [currentUser, setCurrentUser] = useState<{ uid: string; displayName?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [job, setJob] = useState<Job | null>(null);
  const [showAttachmentModal, setShowAttachmentModal] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [messageTemplates, setMessageTemplates] = useState<MessageTemplate[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch messages function
  const fetchMessages = async (conversationId: string) => {
    try {
      const messagesQuery = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId),
        orderBy("timestamp", "asc")
      );
      
      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messagesList: Message[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          messagesList.push({
            id: doc.id,
            senderId: data.senderId || '',
            receiverId: data.receiverId || '',
            content: data.content || '',
            timestamp: data.timestamp ? new Date(data.timestamp.seconds * 1000) : new Date(),
            read: data.read || false,
            attachmentUrl: data.attachmentUrl || '',
            attachmentType: data.attachmentType || '',
            attachmentName: data.attachmentName || ''
          });
        });
        
        setMessages(messagesList);
        
        // Mark messages as read
        markMessagesAsRead(conversationId);
        
        // Scroll to bottom of messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      });
      
      return () => unsubscribe();
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };
  
  // Check authentication and fetch conversation data
  useEffect(() => {
    const checkAuth = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push('/signin');
        return;
      }
      
      setCurrentUser({
        uid: user.uid,
        displayName: user.displayName ?? undefined
      });
      
      try {
        // Fetch conversation data
        const conversationDoc = await getDoc(doc(db, "conversations", conversationId));
        
        if (!conversationDoc.exists()) {
          router.push('/recruiter/messages');
          return;
        }
        
        const conversationData = conversationDoc.data() as Conversation;
        setConversation(conversationData);
        
        // Determine the other participant (not the current user)
        const otherParticipantId = conversationData.participants.find((id: string) => id !== user.uid);
        
        if (otherParticipantId) {
          try {
            // Fetch candidate profile
            const candidateDoc = await getDoc(doc(db, "candidateProfiles", otherParticipantId));
            
            if (candidateDoc.exists()) {
              const candidateData = candidateDoc.data();
              setParticipant({
                id: candidateDoc.id,
                name: candidateData.name || 'Candidate',
                title: candidateData.title || '',
                avatarUrl: candidateData.avatarUrl || '',
                email: candidateData.email || '',
                phone: candidateData.phone || '',
                location: candidateData.location || ''
              });
            }
          } catch (error) {
            console.error("Error fetching participant data:", error);
          }
        }
        
        // Fetch job data if jobId exists
        if (conversationData.jobId) {
          try {
            const jobDoc = await getDoc(doc(db, "jobs", conversationData.jobId));
            
            if (jobDoc.exists()) {
              setJob({
                id: jobDoc.id,
                title: jobDoc.data().title || '',
                company: jobDoc.data().company || ''
              });
            }
          } catch (error) {
            console.error("Error fetching job data:", error);
          }
        }
        
        // Fetch messages
        fetchMessages(conversationId);
        
        // Fetch message templates
        fetchMessageTemplates();
        
      } catch (error) {
        console.error("Error fetching conversation:", error);
        router.push('/recruiter/messages');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router, conversationId, fetchMessages]);
  
  // Fetch message templates
  const fetchMessageTemplates = async () => {
    try {
      const templatesQuery = query(
        collection(db, "messageTemplates"),
        where("userId", "==", auth.currentUser?.uid || "")
      );
      
      const templatesSnapshot = await getDocs(templatesQuery);
      const templatesList: MessageTemplate[] = [];
      
      templatesSnapshot.forEach((doc) => {
        templatesList.push({
          id: doc.id,
          name: doc.data().name || '',
          content: doc.data().content || ''
        });
      });
      
      // Add some default templates if none exist
      if (templatesList.length === 0) {
        templatesList.push(
          {
            id: 'default-1',
            name: 'Introduction',
            content: `Hi [Name],\n\nI'm [Your Name] from [Company]. I came across your profile and I'm impressed with your background. I'd love to discuss potential opportunities with you.\n\nLet me know if you're interested in chatting further.\n\nBest,\n[Your Name]`
          },
          {
            id: 'default-2',
            name: 'Interview Invitation',
            content: `Hi [Name],\n\nThank you for your interest in the [Position] role at [Company]. I'd like to invite you for an interview to discuss the opportunity further.\n\nPlease let me know your availability for the next week, and I'll schedule a time that works for both of us.\n\nLooking forward to speaking with you!\n\nBest regards,\n[Your Name]`
          },
          {
            id: 'default-3',
            name: 'Follow Up',
            content: `Hi [Name],\n\nI wanted to follow up on our previous conversation about the [Position] role at [Company]. Have you had a chance to think about the opportunity?\n\nI'm available to answer any questions you might have.\n\nBest,\n[Your Name]`
          }
        );
      }
      
      setMessageTemplates(templatesList);
    } catch (error) {
      console.error("Error fetching message templates:", error);
    }
  };
  
  // Mark messages as read
  const markMessagesAsRead = async (conversationId: string) => {
    if (!currentUser) return;
    
    try {
      const unreadMessagesQuery = query(
        collection(db, "messages"),
        where("conversationId", "==", conversationId),
        where("receiverId", "==", currentUser.uid),
        where("read", "==", false)
      );
      
      const unreadMessagesSnapshot = await getDocs(unreadMessagesQuery);
      
      unreadMessagesSnapshot.forEach(async (doc) => {
        await updateDoc(doc.ref, {
          read: true
        });
      });
    } catch (error) {
      console.error("Error marking messages as read:", error);
    }
  };
  
  // Send a new message
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUser || !conversation || !participant) return;
    
    try {
      const messageData = {
        conversationId,
        senderId: currentUser.uid,
        receiverId: participant.id,
        content: newMessage,
        timestamp: serverTimestamp(),
        read: false
      };
      
      // Add message to Firestore
      await addDoc(collection(db, "messages"), messageData);
      
      // Update conversation's last message
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: newMessage,
        lastMessageTime: serverTimestamp()
      });
      
      // Clear input
      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  
  // Handle attachment change
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };
  
  // Upload attachment and send message
  const uploadAttachmentAndSendMessage = async () => {
    if (!attachment || !currentUser || !conversation || !participant) return;
    
    setIsUploading(true);
    
    try {
      // Upload file to Firebase Storage
      const storageRef = ref(storage, `messages/${conversationId}/${Date.now()}_${attachment.name}`);
      const uploadTask = await uploadBytes(storageRef, attachment);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      
      // Determine attachment type
      const fileType = attachment.type.split('/')[0]; // 'image', 'application', etc.
      
      // Add message with attachment to Firestore
      const messageData = {
        conversationId,
        senderId: currentUser.uid,
        receiverId: participant.id,
        content: newMessage || `Sent an attachment: ${attachment.name}`,
        timestamp: serverTimestamp(),
        read: false,
        attachmentUrl: downloadURL,
        attachmentType: fileType,
        attachmentName: attachment.name
      };
      
      await addDoc(collection(db, "messages"), messageData);
      
      // Update conversation's last message
      await updateDoc(doc(db, "conversations", conversationId), {
        lastMessage: newMessage || `Sent an attachment: ${attachment.name}`,
        lastMessageTime: serverTimestamp()
      });
      
      // Clear inputs
      setNewMessage('');
      setAttachment(null);
      setShowAttachmentModal(false);
    } catch (error) {
      console.error("Error uploading attachment:", error);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Apply message template - moved out to a top-level function to avoid React Hooks rule violation
  const applyTemplate = (template: MessageTemplate) => {
    // Replace placeholders with actual data
    let content = template.content;
    
    if (participant) {
      content = content.replace(/\[Name\]/g, participant.name.split(' ')[0] || 'Candidate');
    }
    
    content = content.replace(/\[Your Name\]/g, currentUser?.displayName || 'Recruiter');
    content = content.replace(/\[Company\]/g, job?.company || 'Our company');
    content = content.replace(/\[Position\]/g, job?.title || 'the position');
    
    setNewMessage(content);
    setShowTemplateModal(false);
  };
  
  // Format timestamp
  const formatMessageTime = (timestamp: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (timestamp >= today) {
      return format(timestamp, 'h:mm a');
    } else if (timestamp >= yesterday) {
      return 'Yesterday at ' + format(timestamp, 'h:mm a');
    } else {
      return format(timestamp, 'MMM d, yyyy h:mm a');
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center">
        <Header userRole="recruiter" />
        <div className="py-24">
          <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }
  
  if (!conversation || !participant) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header userRole="recruiter" />
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Conversation not found</h1>
          <p className="text-gray-500 mb-8">The conversation you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
          <Link
            href="/recruiter/messages"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Back to Messages
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header userRole="recruiter" />
      
      <div className="flex-1 flex flex-col">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 h-32 pt-14">
          <div className="container mx-auto max-w-4xl px-4">
            <div className="flex items-center">
              <Link href="/recruiter/messages" className="text-white hover:text-indigo-100 mr-2">
                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </Link>
              <h1 className="text-2xl font-bold text-white">
                Conversation with {participant.name}
              </h1>
            </div>
          </div>
        </div>
        
        <div className="container mx-auto max-w-4xl px-4 -mt-8 pb-8 flex-1 flex flex-col">
          <motion.div 
            className="bg-white rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex h-full">
              {/* Messages area */}
              <div className="w-2/3 flex flex-col">
                {/* Conversation header */}
                <div className="p-4 border-b border-gray-200 flex items-center">
                  <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {participant.avatarUrl ? (
                      <Image src={participant.avatarUrl} alt={participant.name} width={40} height={40} className="h-full w-full object-cover" />
                    ) : (
                      participant.name.charAt(0)
                    )}
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900">{participant.name}</h3>
                      {participant.id && (
                        <Link
                          href={`/recruiter/candidates/${participant.id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-800"
                        >
                          View Profile
                        </Link>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {participant.title || 'Candidate'}
                      {job && (
                        <span className="ml-2 bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-full text-xs">
                          {job.title}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full">
                      <svg className="h-12 w-12 text-gray-300 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-gray-500">No messages yet</p>
                      <p className="text-sm text-gray-400 mt-1">Send a message to start the conversation</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`max-w-md p-3 rounded-lg ${
                            message.senderId === currentUser?.uid 
                              ? 'bg-indigo-600 text-white ml-auto' 
                              : 'bg-white border border-gray-200 mr-auto'
                          }`}
                        >
                          <div>
                            <p className={`text-sm ${message.senderId === currentUser?.uid ? 'text-white' : 'text-gray-800'}`}>
                              {message.content}
                            </p>
                            
                            {message.attachmentUrl && (
                              <div className="mt-2">
                                <a 
                                  href={message.attachmentUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={`flex items-center text-xs ${
                                    message.senderId === currentUser?.uid ? 'text-indigo-100' : 'text-indigo-600'
                                  }`}
                                >
                                  <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                                  </svg>
                                  {message.attachmentName || 'Attachment'}
                                </a>
                              </div>
                            )}
                            
                            <div className={`text-xs mt-1 ${message.senderId === currentUser?.uid ? 'text-indigo-200' : 'text-gray-500'}`}>
                              {message.timestamp ? formatMessageTime(message.timestamp) : ''}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                
                {/* Message input */}
                <div className="p-4 border-t border-gray-200">
                  <div className="flex items-end">
                    <div className="flex-1">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 resize-none"
                        rows={3}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <div className="flex justify-between mt-2">
                        <p className="text-xs text-gray-500">
                          Press Enter to send, Shift+Enter for new line
                        </p>
                        <div className="flex space-x-2">
                          <button
                            type="button"
                            onClick={() => setShowTemplateModal(true)}
                            className="text-xs text-indigo-600 hover:text-indigo-800"
                          >
                            Use template
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="ml-3 flex items-center">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center p-2 rounded-full text-gray-400 hover:text-gray-500"
                      >
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={(e) => {
                          handleAttachmentChange(e);
                          if (e.target.files && e.target.files[0]) {
                            setShowAttachmentModal(true);
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={sendMessage}
                        className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-600 p-2 text-white hover:bg-indigo-700"
                      >
                        <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Candidate info sidebar */}
              <div className="w-1/3 border-l border-gray-200 bg-gray-50 p-4 overflow-y-auto">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="h-24 w-24 rounded-full overflow-hidden bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-bold mb-4">
                    {participant.avatarUrl ? (
                      <Image src={participant.avatarUrl} alt={participant.name} width={96} height={96} className="h-full w-full object-cover" />
                    ) : (
                      participant.name.charAt(0)
                    )}
                  </div>
                  
                  <h2 className="text-xl font-bold text-gray-900">{participant.name}</h2>
                  <p className="text-gray-500">{participant.title || 'Candidate'}</p>
                </div>
                
                <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Contact Information</h3>
                  
                  {participant.email && (
                    <div className="flex items-center py-2">
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                        <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                      </svg>
                      <a href={`mailto:${participant.email}`} className="text-sm text-indigo-600 hover:text-indigo-800">
                        {participant.email}
                      </a>
                    </div>
                  )}
                  
                  {participant.phone && (
                    <div className="flex items-center py-2">
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      <a href={`tel:${participant.phone}`} className="text-sm text-indigo-600 hover:text-indigo-800">
                        {participant.phone}
                      </a>
                    </div>
                  )}
                  
                  {participant.location && (
                    <div className="flex items-center py-2">
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-600">
                        {participant.location}
                      </span>
                    </div>
                  )}
                </div>
                
                {job && (
                  <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">Applied Job</h3>
                    <div className="flex items-center py-2">
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                        <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                      </svg>
                      <Link href={`/recruiter/jobs/${job.id}`} className="text-sm text-indigo-600 hover:text-indigo-800">
                        {job.title}
                      </Link>
                    </div>
                    {job.company && (
                      <div className="flex items-center py-2">
                        <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-600">
                          {job.company}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
                  
                  <div className="space-y-2">
                    <Link
                      href={participant.id ? `/recruiter/candidates/${participant.id}` : '#'}
                      className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      View Full Profile
                    </Link>
                    
                    {job && (
                      <Link
                        href={`/recruiter/jobs/${job.id}`}
                        className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                        </svg>
                        View Job Posting
                      </Link>
                    )}
                    
                    <button
                      type="button"
                      className="flex items-center w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="h-5 w-5 text-gray-400 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                      Schedule Interview
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
      
      {/* Attachment modal */}
      {showAttachmentModal && attachment && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Send Attachment</h3>
                <button 
                  onClick={() => {
                    setShowAttachmentModal(false);
                    setAttachment(null);
                  }}
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
                <div className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <svg className="h-8 w-8 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">{attachment.name}</p>
                    <p className="text-xs text-gray-500">
                      {(attachment.size / 1024).toFixed(2)} KB · {attachment.type}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message (optional)
                </label>
                <textarea
                  id="message"
                  placeholder="Add a message with your attachment..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                ></textarea>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAttachmentModal(false);
                  setAttachment(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 mr-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={uploadAttachmentAndSendMessage}
                disabled={isUploading}
                className={`px-4 py-2 rounded-md text-sm font-medium text-white ${
                  isUploading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : 'Send Attachment'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Template modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Message Templates</h3>
                <button 
                  onClick={() => setShowTemplateModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4 overflow-y-auto flex-1">
              <p className="text-sm text-gray-500 mb-4">
                Select a template to quickly insert a message. The placeholders [Name], [Your Name], [Company], and [Position] will be automatically replaced.
              </p>
              
              <div className="space-y-4">
                {messageTemplates.map((template) => (
                  <div 
                    key={template.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                    onClick={() => applyTemplate(template)}
                  >
                    <h4 className="text-sm font-medium text-gray-900 mb-1">{template.name}</h4>
                    <p className="text-sm text-gray-500 line-clamp-2">{template.content}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}