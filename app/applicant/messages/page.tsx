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
  relatedId?: string;
  jobTitle?: string;
};


export default function CandidateMessagesPage() {
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
      // Try to get candidate profile first
      const candidateDoc = await getDoc(doc(db, 'candidateProfiles', user.uid));
      if (candidateDoc.exists()) {
        setCurrentUser({ 
          id: user.uid, 
          ...candidateDoc.data(),
          role: 'candidate' 
        });
      } else {
        // Fallback to user document
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setCurrentUser({ 
            id: user.uid, 
            ...userDoc.data(),
            role: 'candidate'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
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
        const seenIds = new Set<string>();
        
        for (const docSnapshot of snapshot.docs) {
          // Skip if we've already seen this conversation ID (to fix duplicate key error)
          if (seenIds.has(docSnapshot.id)) {
            continue;
          }
          seenIds.add(docSnapshot.id);
          
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
                // For the current user (candidate)
                if (participantId === user.uid) {
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
                  }
                } else {
                  // For other participants (likely recruiters)
                  const userDoc = await getDoc(doc(db, 'users', participantId));
                  if (userDoc.exists()) {
                    const userData = userDoc.data();
                    conversation.participantDetails[participantId] = {
                      name: userData.name || userData.email || 'Unknown',
                      role: userData.role || 'recruiter',
                      avatarUrl: userData.avatarUrl || '',
                      email: userData.email || '',
                      company: userData.company || ''
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
        const seenMessageIds = new Set<string>();
        
        snapshot.forEach((msgDoc) => {
          // Skip duplicates (fix for duplicate key error)
          if (seenMessageIds.has(msgDoc.id)) {
            return;
          }
          seenMessageIds.add(msgDoc.id);
          
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
        // Candidate sending to recruiter
        if (otherParticipant.role === 'recruiter') {
          await createCandidateMessageNotification({
            userId: otherParticipantId,
            applicationId: selectedConversation.relatedId || selectedConversation.id,
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
          otherParticipant?.company?.toLowerCase().includes(term) ||
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
      <Header userRole="applicant" isLoggedIn={!!user} />
      
      <div className="pt-16 flex h-[calc(100vh-4rem)]">
        {/* Conversations List */}
        <div className="w-1/3 bg-white border-r border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Messages</h2>
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
                  Your messages from recruiters will appear here
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
                          {otherParticipant?.company && (
                            <span className="text-indigo-600">{otherParticipant.company} · </span>
                          )}
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
                            <p className="text-sm text-gray-500">
                              {otherParticipant?.company ? 
                                `${otherParticipant.role === 'recruiter' ? 'Recruiter' : 'Hiring Manager'} at ${otherParticipant.company}` : 
                                otherParticipant?.role || 'Recruiter'
                              }
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <Link 
                    href={`/applicant/messages/${selectedConversation.id}`}
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
              <p className="text-sm text-gray-500">Choose a conversation from the list to view messages</p>
            </div>
          )}
        </div>
      </div>
      
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