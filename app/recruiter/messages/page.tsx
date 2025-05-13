'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  Timestamp,
  or
} from 'firebase/firestore';
import { db } from '@/app/lib/firebase';
import { useAuth } from '@/app/lib/authContext';
import Header from '@/app/components/header';
import Image from 'next/image';
import Link from 'next/link';
import { 
  createRecruiterMessageNotification,
  createCandidateMessageNotification
} from '@/app/lib/notification-service';

type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Timestamp;
  read: boolean;
};

type Conversation = {
  id: string;
  participants: string[];
  participantDetails: { [key: string]: any };
  lastMessage: string;
  lastMessageTimestamp: Timestamp;
  unreadCount: { [key: string]: number };
  jobTitle?: string;
};

type CandidateProfile = {
  id: string;
  name: string;
  email: string;
  title: string;
  avatarUrl: string;
  location?: string;
};

export default function RecruiterMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialContactId = searchParams.get('to');
  
  const initializationRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredConversations, setFilteredConversations] = useState<Conversation[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [searchCandidateTerm, setSearchCandidateTerm] = useState('');

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get current user details
  useEffect(() => {
    if (user && !authLoading) {
      fetchUserDetails();
    }
  }, [user, authLoading]);

  const fetchUserDetails = async () => {
    if (!user) return;
    
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        setCurrentUser({ id: user.uid, ...userDoc.data() });
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
    }
  };

  // Fetch all candidate profiles for new conversation modal
  const fetchCandidates = async () => {
    try {
      const candidatesQuery = query(collection(db, 'candidateProfiles'));
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      const candidatesList: CandidateProfile[] = [];
      candidatesSnapshot.forEach((doc) => {
        const data = doc.data();
        candidatesList.push({
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          title: data.title || 'Candidate',
          avatarUrl: data.avatarUrl || '',
          location: data.location || ''
        });
      });
      
      setCandidates(candidatesList);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  // Fetch conversations with proper participant details
  useEffect(() => {
    if (!user) return;

    setIsLoading(true);
    
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageTimestamp', 'desc')
    );

    const unsubscribe = onSnapshot(conversationsQuery, 
      async (snapshot) => {
        const conversationsList: Conversation[] = [];
        
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          const conversation: Conversation = {
            id: docSnapshot.id,
            participants: data.participants || [],
            participantDetails: data.participantDetails || {},
            lastMessage: data.lastMessage || '',
            lastMessageTimestamp: data.lastMessageTimestamp || serverTimestamp(),
            unreadCount: data.unreadCount || {}
          };
          
          // If participantDetails are missing, fetch them
          if (Object.keys(conversation.participantDetails).length === 0) {
            for (const participantId of conversation.participants) {
              try {
                // Try to get candidate profile first
                const candidateDoc = await getDoc(doc(db, 'candidateProfiles', participantId));
                if (candidateDoc.exists()) {
                  const candidateData = candidateDoc.data();
                  conversation.participantDetails[participantId] = {
                    name: candidateData.name || 'Unknown',
                    role: 'candidate',
                    avatarUrl: candidateData.avatarUrl || '',
                    email: candidateData.email || '',
                    title: candidateData.title || 'Candidate'
                  };
                } else {
                  // If not a candidate, try to get user profile
                  const userDoc = await getDoc(doc(db, 'users', participantId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    conversation.participantDetails[participantId] = {
                      name: userData.name || userData.email || 'Unknown',
                      role: userData.role || 'user',
                      avatarUrl: userData.avatarUrl || '',
                      email: userData.email || ''
                    };
                  }
                }
              } catch (error) {
                console.error(`Error fetching participant ${participantId}:`, error);
              }
            }
            
            // Update conversation with participant details
            try {
              await updateDoc(doc(db, 'conversations', conversation.id), {
                participantDetails: conversation.participantDetails
              });
            } catch (error) {
              console.error('Error updating participant details:', error);
            }
          }
          
          conversationsList.push(conversation);
        }
        
        setConversations(conversationsList);
        setFilteredConversations(conversationsList);
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching conversations:', error);
        setError('Failed to load conversations');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Handle initial contact from URL
  useEffect(() => {
    if (
      !initializationRef.current &&
      initialContactId && 
      conversations.length >= 0 && 
      currentUser && 
      !authLoading && 
      !isLoading
    ) {
      initializationRef.current = true;
      handleInitialConversationSetup();
    }
  }, [initialContactId, conversations, currentUser, authLoading, isLoading]);

  const handleInitialConversationSetup = async () => {
    if (!initialContactId || !currentUser) return;

    try {
      // Find existing conversation
      const existingConversation = conversations.find(conv => 
        conv.participants.includes(initialContactId) && 
        conv.participants.includes(currentUser.id)
      );

      if (existingConversation) {
        setSelectedConversation(existingConversation);
      } else {
        await createNewConversation(initialContactId);
      }
      
      // Clear URL parameter
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } catch (error) {
      console.error('Error setting up initial conversation:', error);
      setError('Failed to set up conversation');
    }
  };

  const createNewConversation = async (contactId: string) => {
    if (!currentUser) return;

    try {
      // Fetch candidate details
      const candidateDoc = await getDoc(doc(db, 'candidateProfiles', contactId));
      
      if (!candidateDoc.exists()) {
        setError('Candidate not found');
        return;
      }

      const candidateData = candidateDoc.data();
      
      // Check if conversation already exists
      const existingConv = conversations.find(conv => 
        conv.participants.includes(contactId) && 
        conv.participants.includes(currentUser.id)
      );
      
      if (existingConv) {
        setSelectedConversation(existingConv);
        setShowNewMessageModal(false);
        return;
      }
      
      // Create new conversation
      const conversationData = {
        participants: [currentUser.id, contactId],
        participantDetails: {
          [currentUser.id]: {
            name: currentUser.name || currentUser.email,
            role: 'recruiter',
            avatarUrl: currentUser.avatarUrl || '',
            email: currentUser.email
          },
          [contactId]: {
            name: candidateData.name || 'Anonymous',
            role: 'candidate',
            avatarUrl: candidateData.avatarUrl || '',
            email: candidateData.email || '',
            title: candidateData.title || 'Candidate'
          }
        },
        lastMessage: '',
        lastMessageTimestamp: serverTimestamp(),
        unreadCount: {
          [currentUser.id]: 0,
          [contactId]: 0
        }
      };

      const newConversationRef = await addDoc(collection(db, 'conversations'), conversationData);
      
      // Create the new conversation object
      const newConversation: Conversation = {
        id: newConversationRef.id,
        ...conversationData,
        lastMessageTimestamp: Timestamp.now()
      };
      
      // Add to conversations list
      setConversations(prev => [newConversation, ...prev]);
      setFilteredConversations(prev => [newConversation, ...prev]);
      
      // Select the new conversation
      setSelectedConversation(newConversation);
      setShowNewMessageModal(false);
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('Failed to create conversation');
    }
  };

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversation.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(messagesQuery, 
      (snapshot) => {
        const messagesList: Message[] = [];
        snapshot.forEach((msgDoc) => {
          const data = msgDoc.data();
          messagesList.push({
            id: msgDoc.id,
            conversationId: data.conversationId,
            senderId: data.senderId,
            receiverId: data.receiverId,
            content: data.content,
            timestamp: data.timestamp,
            read: data.read || false
          });
        });
        setMessages(messagesList);

        // Mark messages as read
        markMessagesAsRead(messagesList);
      },
      (error) => {
        console.error('Error fetching messages:', error);
        setError('Failed to load messages');
      }
    );

    return () => unsubscribe();
  }, [selectedConversation, currentUser]);

  const markMessagesAsRead = async (messagesList: Message[]) => {
    if (!currentUser || !selectedConversation) return;

    const unreadMessages = messagesList.filter(
      msg => msg.receiverId === currentUser.id && !msg.read
    );

    for (const msg of unreadMessages) {
      try {
        await updateDoc(doc(db, 'messages', msg.id), { read: true });
      } catch (error) {
        console.error('Error marking message as read:', error);
      }
    }

    // Update conversation unread count
    if (unreadMessages.length > 0) {
      try {
        await updateDoc(doc(db, 'conversations', selectedConversation.id), {
          [`unreadCount.${currentUser.id}`]: 0
        });
      } catch (error) {
        console.error('Error updating unread count:', error);
      }
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation || !currentUser) return;

    const otherParticipantId = selectedConversation.participants.find(p => p !== currentUser.id);
    if (!otherParticipantId) return;

    try {
      const messageData = {
        conversationId: selectedConversation.id,
        senderId: currentUser.id,
        receiverId: otherParticipantId,
        content: messageInput.trim(),
        timestamp: serverTimestamp(),
        read: false
      };

      // Create the message
      await addDoc(collection(db, 'messages'), messageData);

      // Update conversation
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        lastMessage: messageInput.trim(),
        lastMessageTimestamp: serverTimestamp(),
        [`unreadCount.${otherParticipantId}`]: (selectedConversation.unreadCount[otherParticipantId] || 0) + 1
      });

      // Get participant details
      const otherParticipant = selectedConversation.participantDetails[otherParticipantId];
      
      if (otherParticipant) {
        // Determine sender and recipient roles
        const currentUserRole = currentUser.role || 'recruiter'; // Assuming this page is for recruiters
        
        // Create notification for the recipient
        if (currentUserRole === 'recruiter' && otherParticipant.role === 'candidate') {
          // Recruiter sending to candidate
          await createRecruiterMessageNotification({
            userId: otherParticipantId,
            applicationId: selectedConversation.id,
            jobTitle: selectedConversation.jobTitle || 'Position',
            companyName: currentUser.company || currentUser.name || 'Company',
            recruiterName: currentUser.name || currentUser.email || 'Recruiter',
          });
        } else if (currentUserRole === 'candidate' && otherParticipant.role === 'recruiter') {
          // Candidate sending to recruiter
          await createCandidateMessageNotification({
            userId: otherParticipantId,
            applicationId: selectedConversation.id,
            jobTitle: selectedConversation.jobTitle || 'Position',
            candidateName: currentUser.name || currentUser.email || 'Candidate',
          });
        }
      }

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return '';
    
    try {
      let date;
      if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else if (timestamp.toDate) {
        date = timestamp.toDate();
      } else {
        date = new Date(timestamp);
      }

      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const hours = diff / (1000 * 60 * 60);
      const days = diff / (1000 * 60 * 60 * 24);

      if (hours < 1) {
        return 'Just now';
      } else if (hours < 24) {
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      } else if (days < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'short' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      }
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '';
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value.toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => {
        const otherParticipantId = conv.participants.find(p => p !== currentUser?.id);
        const otherParticipant = otherParticipantId ? conv.participantDetails[otherParticipantId] : null;
        
        return (
          otherParticipant?.name?.toLowerCase().includes(term) ||
          otherParticipant?.email?.toLowerCase().includes(term) ||
          conv.lastMessage?.toLowerCase().includes(term)
        );
      });
      setFilteredConversations(filtered);
    }
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    }
  }, [authLoading, user, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header userRole="recruiter" isLoggedIn={!!user} />
      
      <div className="pt-16 flex h-[calc(100vh-4rem)]">
        {/* Conversations List */}
        <div className="w-1/3 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Messages</h2>
              <div className="flex items-center space-x-2">
                <Link
                  href="/recruiter/messages/message-template"
                  className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                  title="Message Templates"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </Link>
                <button
                  onClick={() => {
                    setShowNewMessageModal(true);
                    fetchCandidates();
                  }}
                  className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
                  title="New Message"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Search messages..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md"
              />
              <svg className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          <div className="overflow-y-auto h-[calc(100vh-12rem)]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <p className="font-medium text-gray-900 mb-1">
                  {searchTerm ? 'No conversations match your search' : 'No conversations yet'}
                </p>
                <p className="text-sm text-gray-500">
                  Click the + button to start a new conversation
                </p>
              </div>
            ) : (
              filteredConversations.map(conversation => {
                const otherParticipantId = conversation.participants.find(p => p !== currentUser?.id);
                const otherParticipant = otherParticipantId ? conversation.participantDetails[otherParticipantId] : null;
                const unreadCount = conversation.unreadCount[currentUser?.id || ''] || 0;
                
                return (
                  <div
                    key={conversation.id}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                      selectedConversation?.id === conversation.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="flex items-center">
                      <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3 flex-shrink-0">
                        {otherParticipant?.avatarUrl ? (
                          <Image 
                            src={otherParticipant.avatarUrl} 
                            alt={otherParticipant.name} 
                            width={48} 
                            height={48} 
                            className="rounded-full"
                          />
                        ) : (
                          <span className="text-lg font-medium">
                            {otherParticipant?.name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <h3 className="font-semibold truncate">{otherParticipant?.name || 'Unknown'}</h3>
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTimestamp(conversation.lastMessageTimestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {conversation.lastMessage || 'No messages yet'}
                        </p>
                      </div>
                      {unreadCount > 0 && (
                        <div className="ml-2 bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        {/* Message Thread */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {(() => {
                      const otherParticipantId = selectedConversation.participants.find(p => p !== currentUser?.id);
                      const otherParticipant = otherParticipantId ? selectedConversation.participantDetails[otherParticipantId] : null;
                      
                      return (
                        <>
                          <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3">
                            {otherParticipant?.avatarUrl ? (
                              <Image 
                                src={otherParticipant.avatarUrl} 
                                alt={otherParticipant.name} 
                                width={40} 
                                height={40} 
                                className="rounded-full"
                              />
                            ) : (
                              otherParticipant?.name?.charAt(0).toUpperCase() || '?'
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold">{otherParticipant?.name || 'Unknown'}</h3>
                            <p className="text-sm text-gray-500">{otherParticipant?.title || otherParticipant?.role || 'Candidate'}</p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <Link 
                    href={`/recruiter/messages/${selectedConversation.id}`}
                    className="text-sm text-indigo-600 hover:text-indigo-800"
                  >
                    View full conversation
                  </Link>
                </div>
              </div>
              
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p>Start a conversation by sending a message</p>
                  </div>
                ) : (
                  <>
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={`mb-4 flex ${
                          message.senderId === currentUser?.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div
                          className={`max-w-[70%] rounded-lg px-4 py-2 ${
                            message.senderId === currentUser?.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-gray-800 border border-gray-200'
                          }`}
                        >
                          <p>{message.content}</p>
                          <p className="text-xs mt-1 opacity-70" suppressHydrationWarning>
                            {formatTimestamp(message.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
              
              {/* Message Input */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg mr-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!messageInput.trim()}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Send
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
              <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg font-medium text-gray-900 mb-1">Select a conversation</p>
              <p className="text-sm text-gray-500">Choose a conversation from the list or start a new one</p>
            </div>
          )}
        </div>
      </div>
      
      {/* New Message Modal */}
      {showNewMessageModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <motion.div 
            className="bg-white rounded-lg shadow-xl w-full max-w-lg"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">New Message</h3>
                <button 
                  onClick={() => {
                    setShowNewMessageModal(false);
                    setSearchCandidateTerm('');
                  }}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="px-6 py-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a candidate to message
                </label>
                <input
                  type="text"
                  placeholder="Search candidates..."
                  value={searchCandidateTerm}
                  onChange={(e) => setSearchCandidateTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
                />
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {candidates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p>No candidates found</p>
                  </div>
                ) : (
                  candidates
                    .filter(candidate => 
                      candidate.name.toLowerCase().includes(searchCandidateTerm.toLowerCase()) ||
                      candidate.email.toLowerCase().includes(searchCandidateTerm.toLowerCase()) ||
                      candidate.title.toLowerCase().includes(searchCandidateTerm.toLowerCase())
                    )
                    .map(candidate => (
                      <div
                        key={candidate.id}
                        onClick={() => createNewConversation(candidate.id)}
                        className="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer mb-2"
                      >
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-3">
                          {candidate.avatarUrl ? (
                            <Image 
                              src={candidate.avatarUrl} 
                              alt={candidate.name} 
                              width={40} 
                              height={40} 
                              className="rounded-full"
                            />
                          ) : (
                            candidate.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{candidate.name}</h4>
                          <p className="text-sm text-gray-500">{candidate.title}</p>
                          {candidate.location && (
                            <p className="text-xs text-gray-400">{candidate.location}</p>
                          )}
                        </div>
                        <div>
                          <button
                            type="button"
                            className="text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            Message
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 rounded-b-lg flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowNewMessageModal(false);
                  setSearchCandidateTerm('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Error notification */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-4 right-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg shadow-lg z-50"
        >
          <div className="flex items-center">
            <svg className="h-5 w-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-4 text-red-500 hover:text-red-700"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}