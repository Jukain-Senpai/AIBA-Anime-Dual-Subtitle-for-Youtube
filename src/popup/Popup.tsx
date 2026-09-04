import React, { useState, useEffect, ChangeEvent, useRef } from 'react';
import { SubtitleState, SubtitleItem, SubtitleSettings, SubtitlePosition } from '../types/subtitle';
import { getSubtitleState, saveSubtitleState, clearSubtitles } from '../storage/subtitleStorage';
import { parseSRT, formatTime } from '../utils/srtParser';
import './popup.css';

const DEFAULT_SETTINGS: SubtitleSettings = {
  position: 'bottom',
  fontSize: 26,
  fontFamily: '"Hiragino Sans", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", sans-serif',
  textColor: '#ffffff',
  backgroundColor: '#000000',
  backgroundOpacity: 0.8,
  textOutline: true,
  outlineSize: 2,
  lineSpacing: 1.4,
  offset: 0,
  showFurigana: true,
};

export const Popup: React.FC = () => {
  const [state, setState] = useState<SubtitleState>({
    filename: '',
    subtitles: [],
    enabled: true,
    settings: DEFAULT_SETTINGS,
  });

  const [isHoveringDropzone, setIsHoveringDropzone] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSubtitleState().then(setState);
  }, []);

  const notifyActiveTab = (newState: SubtitleState) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SUBTITLE_STATE_UPDATE',
            payload: newState,
          }).catch(() => {
            // Ignore error if content script is initializing
          });
        }
      });
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file || !file.name.endsWith('.srt')) {
      alert('Please select a valid .srt subtitle file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const parsed = parseSRT(content);
        if (parsed.length === 0) {
          alert('Could not parse any valid subtitles from this file.');
          return;
        }

        saveSubtitleState({
          filename: file.name,
          subtitles: parsed,
          enabled: true,
        }).then((newState) => {
          setState(newState);
          notifyActiveTab(newState);
        });
      }
    };

    reader.readAsText(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleSettingChange = <K extends keyof SubtitleSettings>(key: K, value: SubtitleSettings[K]) => {
    const newSettings = { ...state.settings, [key]: value };
    saveSubtitleState({ settings: newSettings }).then((newState) => {
      setState(newState);
      notifyActiveTab(newState);
    });
  };

  const handleOffsetChange = (delta: number) => {
    const newOffset = parseFloat((state.settings.offset + delta).toFixed(2));
    handleSettingChange('offset', newOffset);
  };

  const handleOffsetReset = () => {
    handleSettingChange('offset', 0);
  };

  const handleToggleEnabled = () => {
    saveSubtitleState({ enabled: !state.enabled }).then((newState) => {
      setState(newState);
      notifyActiveTab(newState);
    });
  };

  const handleClear = () => {
    clearSubtitles().then((newState) => {
      setState(newState);
      notifyActiveTab(newState);
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatOffsetDisplay = (offset: number) => {
    if (offset === 0) return '0.0s';
    return offset > 0 ? `+${offset.toFixed(1)}s` : `${offset.toFixed(1)}s`;
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="header">
        <div className="title-group">
          <span className="title-icon">🇯🇵</span>
          <h1>Japanese Subtitles</h1>
        </div>
        <label className="toggle-switch" title="Toggle Japanese Subtitles">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={handleToggleEnabled}
          />
          <span className="slider"></span>
        </label>
      </div>

      {/* SRT File Upload Area */}
      {state.subtitles.length === 0 ? (
        <div
          className="upload-zone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsHoveringDropzone(true);
          }}
          onDragLeave={() => setIsHoveringDropzone(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsHoveringDropzone(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          style={{
            borderColor: isHoveringDropzone ? 'var(--accent-color)' : undefined,
          }}
        >
          <div className="upload-icon">📁</div>
          <div className="upload-text">Upload .SRT File</div>
          <div className="upload-hint">Click or drop your Japanese .srt file</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt"
            className="file-input"
            onChange={onFileChange}
          />
        </div>
      ) : (
        <div className="subtitle-info">
          <div className="file-details">
            <div className="filename" title={state.filename}>
              {state.filename}
            </div>
            <div className="count-badge">
              {state.subtitles.length} Subtitles Loaded
            </div>
          </div>
          <button
            className="btn-icon"
            onClick={handleClear}
            title="Clear subtitles"
          >
            🗑️
          </button>
        </div>
      )}

      {/* Settings Section (Only if subtitles are loaded) */}
      {state.subtitles.length > 0 && (
        <div className="settings-scroll-area">
          {/* Sync Offset Controls */}
          <div className="card">
            <div className="card-title">Subtitle Sync Offset</div>
            <div className="offset-controls">
              <div className="offset-display">
                <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Current Sync:</span>
                <span className="offset-value">{formatOffsetDisplay(state.settings.offset)}</span>
              </div>

              <div className="button-grid">
                <button className="btn-step" onClick={() => handleOffsetChange(-1.0)}>-1.0s</button>
                <button className="btn-step" onClick={() => handleOffsetChange(-0.1)}>-0.1s</button>
                <button className="btn-step btn-reset" onClick={handleOffsetReset}>Reset</button>
                <button className="btn-step" onClick={() => handleOffsetChange(0.1)}>+0.1s</button>
                <button className="btn-step" onClick={() => handleOffsetChange(1.0)}>+1.0s</button>
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="card settings-card">
            <div className="card-title">Appearance Settings</div>
            
            <div className="setting-row">
              <label>Position</label>
              <select 
                value={state.settings.position}
                onChange={(e) => handleSettingChange('position', e.target.value as SubtitlePosition)}
              >
                <option value="top">Top</option>
                <option value="center">Center</option>
                <option value="bottom">Bottom</option>
                <option value="above_yt">Above YouTube Subtitles</option>
                <option value="below_yt">Below YouTube Subtitles</option>
              </select>
            </div>

            <div className="setting-row">
              <label>Font Size: {state.settings.fontSize}px</label>
              <input 
                type="range" min="12" max="72" 
                value={state.settings.fontSize}
                onChange={(e) => handleSettingChange('fontSize', parseInt(e.target.value))}
              />
            </div>

            <div className="setting-row">
              <label>Font Family</label>
              <select 
                value={state.settings.fontFamily}
                onChange={(e) => handleSettingChange('fontFamily', e.target.value)}
              >
                <option value='"Hiragino Sans", "Meiryo", "Noto Sans CJK JP", "Noto Sans JP", sans-serif'>Sans-Serif (Default)</option>
                <option value='"Hiragino Mincho ProN", "Noto Serif CJK JP", serif'>Serif</option>
                <option value='"Yu Gothic", "MS Gothic", monospace'>Monospace</option>
              </select>
            </div>

            <div className="setting-row">
              <label>Text Color</label>
              <input 
                type="color" 
                value={state.settings.textColor}
                onChange={(e) => handleSettingChange('textColor', e.target.value)}
              />
            </div>

            <div className="setting-row">
              <label>Background Color</label>
              <input 
                type="color" 
                value={state.settings.backgroundColor}
                onChange={(e) => handleSettingChange('backgroundColor', e.target.value)}
              />
            </div>

            <div className="setting-row">
              <label>Background Opacity: {Math.round(state.settings.backgroundOpacity * 100)}%</label>
              <input 
                type="range" min="0" max="1" step="0.1"
                value={state.settings.backgroundOpacity}
                onChange={(e) => handleSettingChange('backgroundOpacity', parseFloat(e.target.value))}
              />
            </div>

            <div className="setting-row">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={state.settings.textOutline}
                  onChange={(e) => handleSettingChange('textOutline', e.target.checked)}
                />
                Text Outline
              </label>
            </div>

            {state.settings.textOutline && (
              <div className="setting-row">
                <label>Outline Size: {state.settings.outlineSize}px</label>
                <input 
                  type="range" min="1" max="5" step="0.5"
                  value={state.settings.outlineSize}
                  onChange={(e) => handleSettingChange('outlineSize', parseFloat(e.target.value))}
                />
              </div>
            )}

            <div className="setting-row">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={state.settings.showFurigana}
                  onChange={(e) => handleSettingChange('showFurigana', e.target.checked)}
                />
                Show Furigana (Reading)
              </label>
            </div>
          </div>
        </div>
      )}

      <div className="footer-text">
        Works seamlessly on all YouTube videos
      </div>
    </div>
  );
};
