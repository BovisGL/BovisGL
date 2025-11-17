/**
 * ServerDetails Component - Matching old frontend
 * 
 * Server console modal with:
 * - Tabs for console/plugins-mods
 * - Command input with history navigation (Arrow Up/Down)
 * - Keyboard shortcuts: Enter=send, Shift+Enter=newline
 * - Logs display with copy button
 * - Start/Stop buttons based on server status
 * - Portal rendering to document.body
 * - 5-second polling for logs and server state
 */

import { memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ServerInfo } from './ServerCard';
import { api } from '../../../services/apiService';
import './ServerDetails.css';

interface ServerDetailsProps {
  server: ServerInfo;
  csrfToken: string;
  onClose: () => void;
}

const ServerDetailsComponent = ({ server, csrfToken, onClose }: ServerDetailsProps) => {
  const [activeTab, setActiveTab] = useState<'console' | 'plugins' | 'mods'>('console');
  const [logs, setLogs] = useState('');
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<number>();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Determine jar management label based on server type
  const jarManagementLabel = server.id === 'anarchy' ? 'Mods' : 'Plugins';

  // Auto-scroll logs to bottom when new logs arrive
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Fetch logs from server
  const fetchLogs = async () => {
    try {
      const response = await api.get(`/api/locked/servers/${server.id}/logs`, {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || '');
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  // Set up 5-second polling for logs
  useEffect(() => {
    fetchLogs();
    pollIntervalRef.current = window.setInterval(fetchLogs, 5000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [server.id, csrfToken]);

  // Keyboard navigation: Enter to send, Arrow keys for history, Shift+Enter for newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommandSubmit();
    } else if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCommand(e.target.value);
    setHistoryIndex(-1); // Reset history navigation when typing
  };

  // Send command to server
  const handleCommandSubmit = async () => {
    if (!command.trim() || isLoading) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await api.post(`/api/locked/servers/${server.id}/command`, 
        { command: command.trim() },
        {
          headers: {
            'X-CSRF-Token': csrfToken,
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        setError(`Failed to send command: ${errorData.error || response.statusText}`);
        return;
      }
      
      // Add to history
      if (command.trim() !== '') {
        setCommandHistory(prev => {
          const newHistory = [command.trim(), ...prev.filter(cmd => cmd !== command.trim())];
          return newHistory.slice(0, 50);
        });
      }
      
      setCommand('');
      setHistoryIndex(-1);
      
      // Refresh logs to show command result
      setTimeout(() => fetchLogs(), 500);
    } catch (err: any) {
      console.error('Error sending command:', err);
      setError(`Failed to send command: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Copy all logs to clipboard
  const copyLogs = () => {
    navigator.clipboard.writeText(logs);
  };

  // Start server
  const handleStartServer = async () => {
    try {
      const response = await api.post(`/api/locked/servers/${server.id}/start`, {}, {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      if (response.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error('Failed to start server:', err);
    }
  };

  // Stop server
  const handleStopServer = async () => {
    try {
      const response = await api.post(`/api/locked/servers/${server.id}/stop`, {}, {
        headers: {
          'X-CSRF-Token': csrfToken,
        },
      });
      if (response.ok) {
        fetchLogs();
      }
    } catch (err) {
      console.error('Failed to stop server:', err);
    }
  };

  // Close on ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-container" style={{ borderTop: `4px solid ${server.color || '#e74c3c'}` }}>
        {/* Header with server name and close button */}
        <div className="modal-header">
          <h2 style={{
            margin: 0,
            color: server.color || '#e74c3c',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {server.name} Server Console
            <span style={{
              padding: '4px 8px',
              borderRadius: '4px',
              background: server.status === 'online' ? '#4CAF50' : '#ff9800',
              color: 'white',
              fontSize: '13px',
              fontWeight: 'bold'
            }}>
              {server.status === 'online' ? 'ONLINE (2 players)' : (server.status || 'UNKNOWN').toUpperCase()}
            </span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {server.status === 'offline' && (
              <button 
                onClick={handleStartServer}
                disabled={isLoading}
                style={{ 
                  background: isLoading ? '#666' : '#4CAF50', 
                  border: 'none', 
                  color: 'white', 
                  padding: '8px 16px', 
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ▶ Start
              </button>
            )}
            {server.status === 'online' && (
              <button 
                onClick={handleStopServer}
                disabled={isLoading}
                style={{ 
                  background: isLoading ? '#666' : '#f44336', 
                  border: 'none', 
                  color: 'white', 
                  padding: '8px 16px', 
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ⏹ Stop
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '24px',
                cursor: 'pointer',
                padding: '5px 10px',
                borderRadius: '4px'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div style={{
            background: '#5d3131',
            color: '#ffc107',
            padding: '10px',
            borderRadius: '4px',
            margin: '0 15px 15px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '2px solid #444', 
          margin: '0 15px 15px',
          flexShrink: 0 
        }}>
          <button
            style={{
              flex: 1, 
              padding: '12px 15px', 
              background: activeTab === 'console' ? '#383838' : 'transparent', 
              border: 'none', 
              color: activeTab === 'console' ? '#fff' : '#aaa', 
              cursor: 'pointer', 
              fontWeight: activeTab === 'console' ? 'bold' : 'normal',
              borderBottom: activeTab === 'console' ? `3px solid ${server.color || '#e74c3c'}` : 'none',
              marginRight: '5px',
              transition: 'background 0.2s, color 0.2s'
            }}
            onClick={() => setActiveTab('console')}
          >
            Console
          </button>
          <button
            style={{
              flex: 1, 
              padding: '12px 15px', 
              background: activeTab === jarManagementLabel.toLowerCase() ? '#383838' : 'transparent', 
              border: 'none', 
              color: activeTab === jarManagementLabel.toLowerCase() ? '#fff' : '#aaa', 
              cursor: 'pointer', 
              fontWeight: activeTab === jarManagementLabel.toLowerCase() ? 'bold' : 'normal',
              borderBottom: activeTab === jarManagementLabel.toLowerCase() ? `3px solid ${server.color || '#e74c3c'}` : 'none',
              transition: 'background 0.2s, color 0.2s'
            }}
            onClick={() => setActiveTab(server.id === 'anarchy' ? 'mods' : 'plugins')}
          >
            {jarManagementLabel}
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flexGrow: 1, overflowY: 'auto', padding: '0 15px 15px' }}>
          {activeTab === 'console' && (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column' 
            }}>
              {/* Command Input Section */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{ 
                  fontSize: '0.8em', 
                  color: '#aaa', 
                  marginBottom: '8px',
                  background: '#2a2a2a',
                  padding: '10px',
                  borderRadius: '4px'
                }}>
                  <p style={{ margin: '2px 0' }}>• Press Enter to send command</p>
                  <p style={{ margin: '2px 0' }}>• Press Shift+Enter for new line</p>
                  <p style={{ margin: '2px 0' }}>• Use arrow keys to navigate through command history</p>
                </div>
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleCommandSubmit(); }} 
                  style={{ display: 'flex', gap: '10px' }}
                >
                  <textarea
                    ref={textareaRef}
                    value={command}
                    onChange={handleTextAreaChange}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter command..."
                    rows={2}
                    style={{
                      flexGrow: 1, 
                      padding: '10px', 
                      borderRadius: '4px', 
                      border: '1px solid #555', 
                      background: '#1e1e1e', 
                      color: '#e0e0e0', 
                      resize: 'none', 
                      fontSize: '0.95em',
                      fontFamily: 'monospace'
                    }}
                  />
                  <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '5px' 
                  }}>
                    <button 
                      type="button" 
                      onClick={() => setCommand(prev => prev + '\n')} 
                      style={{ 
                        padding: '8px 12px', 
                        background: '#555', 
                        color: 'white', 
                        border:'none', 
                        borderRadius:'4px',
                        cursor: 'pointer'
                      }}
                    >
                      Newline
                    </button>
                    <button 
                      type="submit" 
                      style={{ 
                        padding: '8px 12px', 
                        background: '#4CAF50', 
                        color: 'white', 
                        border:'none', 
                        borderRadius:'4px',
                        cursor: 'pointer'
                      }}
                    >
                      Send
                    </button>
                  </div>
                </form>
              </div>

              {/* Server Logs Section */}
              <div style={{ 
                flexGrow: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden' 
              }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '10px' 
                }}>
                  <h4 style={{ margin: 0, color: '#ddd' }}>Server Logs</h4>
                  <button 
                    onClick={copyLogs} 
                    style={{ 
                      padding: '8px 12px', 
                      background: '#f0ad4e', 
                      color: 'black', 
                      border:'none', 
                      borderRadius:'4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    Copy All Logs
                  </button>
                </div>
                <div style={{
                  whiteSpace: 'pre-wrap', 
                  fontFamily: 'monospace', 
                  flexGrow: 1, 
                  overflowY: 'auto', 
                  background: '#1a1a1a', 
                  padding: '10px', 
                  borderRadius: '4px', 
                  color: '#c5c5c5', 
                  fontSize: '0.85em', 
                  border: '1px solid #444'
                }}>
                  {logs || 'No live logs to display. Server might be offline, starting, or logs are empty.'}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}

          {(activeTab === 'plugins' || activeTab === 'mods') && (
            <div style={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center', 
              textAlign: 'center', 
              padding: '40px' 
            }}>
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '20px',
                padding: '40px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <div style={{ fontSize: '4rem', marginBottom: '20px' }}>
                  🚧
                </div>
                <h2 style={{
                  color: '#fff',
                  marginBottom: '15px',
                  fontSize: '1.8rem',
                  fontWeight: 'bold'
                }}>
                  {jarManagementLabel} Management
                </h2>
                <p style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '1.1rem',
                  lineHeight: '1.6',
                  marginBottom: '20px'
                }}>
                  This feature is currently being rebuilt with enhanced functionality.
                </p>
                <div style={{
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '15px',
                  marginTop: '20px'
                }}>
                  <p style={{
                    color: '#fff',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    margin: '0'
                  }}>
                    🎯 Coming Soon!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export const ServerDetails = memo(ServerDetailsComponent);
