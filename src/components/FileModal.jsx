import React, { useState } from 'react';
import { Upload, X, File, Paperclip, Send } from 'lucide-react';

const FileModal = ({ isOpen, onClose, onSend }) => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [caption, setCaption] = useState('');

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      simulateUpload(droppedFile);
    }
  };

  const simulateUpload = (selectedFile) => {
    setFile(selectedFile);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleSend = () => {
    onSend({ file, caption });
    onClose();
    setFile(null);
    setProgress(0);
    setCaption('');
  };

  return (
    <div style={{ 
        position: 'fixed', 
        inset: 0, 
        backgroundColor: 'rgba(30, 41, 59, 0.4)', 
        backdropFilter: 'blur(4px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 1000 
    }}>
      <div className="fade-in" style={{ 
          width: '100%', 
          maxWidth: '480px', 
          backgroundColor: 'var(--bg-chat)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: 'var(--shadow-md)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Share a file</h2>
          <button onClick={onClose} className="text-muted"><X size={20} /></button>
        </div>

        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{ 
            height: '180px', 
            border: '2px dashed var(--primary)', 
            borderRadius: '16px', 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'var(--primary-light)',
            gap: '0.75rem',
            marginBottom: '1.5rem',
            cursor: 'pointer'
          }}
        >
          <div style={{ width: '48px', height: '48px', backgroundColor: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Upload size={24} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Drag & drop files here</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontWeight: 600 }}>or <span style={{ textDecoration: 'underline' }}>Browse files</span></p>
          </div>
        </div>

        {file && (
            <div style={{ 
                padding: '1rem', 
                backgroundColor: 'var(--bg-main)', 
                borderRadius: '12px', 
                border: '1px solid var(--border)',
                marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ width: '40px', height: '40px', backgroundColor: '#fee2e2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                        <File size={20} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{file.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>{progress}%</span>
                        </div>
                        <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: 'var(--primary)', transition: 'width 0.2s ease' }}></div>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {(file.size / (1024 * 1024)).toFixed(1)} MB
                        </div>
                    </div>
                    <button onClick={() => setFile(null)} className="text-muted"><X size={16} /></button>
                </div>
            </div>
        )}

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
              display: 'block', 
              fontSize: '0.75rem', 
              fontWeight: 700, 
              color: 'var(--text-muted)', 
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              marginBottom: '0.5rem'
          }}>Caption</label>
          <textarea 
            placeholder="Add a message..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            style={{ 
                width: '100%', 
                padding: '0.75rem', 
                borderRadius: '12px', 
                border: '1px solid var(--border)', 
                backgroundColor: 'var(--bg-main)',
                fontSize: '0.9375rem',
                minHeight: '80px',
                resize: 'none'
            }}
          />
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1.5rem' }}>
            Max 10MB • PDF, PNG, JPG, DOCX supported
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '0.75rem 1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Cancel</button>
          <button 
            onClick={handleSend}
            disabled={!file}
            style={{ 
                padding: '0.75rem 1.5rem', 
                backgroundColor: 'var(--primary)', 
                color: 'white', 
                borderRadius: '10px', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
            }}
          >
            Send File <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileModal;
