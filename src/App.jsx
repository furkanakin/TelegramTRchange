import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [rootDir, setRootDir] = useState('');
  const [refImage, setRefImage] = useState('');
  const [waitTimeout, setWaitTimeout] = useState(7);
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    window.electron.onLog((msg) => {
      setLogs(prev => [...prev, { msg, time: new Date().toLocaleTimeString(), id: Date.now() }]);
    });
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSelectFolder = async () => {
    const path = await window.electron.selectFolder();
    if (path) setRootDir(path);
  };

  const handleSelectImage = async () => {
    const path = await window.electron.selectImage();
    if (path) setRefImage(path);
  };

  const startMacro = async () => {
    if (!rootDir || !refImage) {
      setLogs(prev => [...prev, { msg: 'Hata: Lütfen klasör ve görsel seçin.', type: 'error', id: Date.now() }]);
      return;
    }
    setIsRunning(true);
    setLogs(prev => [...prev, { msg: 'Makro başlatılıyor...', type: 'success', id: Date.now() }]);

    const result = await window.electron.startMacro({
      rootDir,
      referenceImage: refImage,
      waitTimeout: parseInt(waitTimeout) || 7
    });

    setIsRunning(false);
    if (result.success) {
      setLogs(prev => [...prev, { msg: result.message, type: 'success', id: Date.now() }]);
    } else {
      setLogs(prev => [...prev, { msg: result.message, type: 'error', id: Date.now() }]);
    }
  };

  const stopMacro = () => {
    window.electron.stopMacro();
    setIsRunning(false);
    setLogs(prev => [...prev, { msg: 'Makro durduruldu.', type: 'error', id: Date.now() }]);
  };

  return (
    <div className="app-container">
      <div className="title-bar">
        <div className="title">TELEGRAM TR CHANGE v1.0</div>
        <div className="window-controls">
          <div className="control-btn minimize" onClick={() => window.electron.minimizeApp()}></div>
          <div className="control-btn close" onClick={() => window.electron.closeApp()}></div>
        </div>
      </div>

      <div className="main-content">
        <div className="settings-panel">
          <div className="card">
            <h3>Hesap Klasörü</h3>
            <button className="btn secondary" onClick={handleSelectFolder}>Klasör Seç</button>
            <div className="path-display">{rootDir || 'Seçilmedi'}</div>
          </div>

          <div className="card">
            <h3>Referans Görsel</h3>
            <button className="btn secondary" onClick={handleSelectImage}>Görsel Yükle</button>
            <div className="image-preview">
              {refImage ? <img src={`file://${refImage}`} alt="preview" /> : <span>Görsel Yok</span>}
            </div>
            <div className="path-display">{refImage || 'Seçilmedi'}</div>
          </div>

          <div className="card">
            <h3>Bekleme Süresi (sn)</h3>
            <input
              type="number"
              className="btn secondary"
              style={{ textAlign: 'center', cursor: 'text', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={waitTimeout}
              onChange={(e) => setWaitTimeout(e.target.value)}
              min="1"
            />
            <div className="path-display">Görsel aranacak maksimum süre.</div>
          </div>

          {!isRunning ? (
            <button className="btn start" onClick={startMacro}>BAŞLAT</button>
          ) : (
            <button className="btn stop" onClick={stopMacro}>DURDUR</button>
          )}
        </div>

        <div className="log-panel">
          <h3>İşlem Kayıtları</h3>
          <div className="log-container">
            {logs.map(log => (
              <div key={log.id} className={`log-entry ${log.type || ''}`}>
                <span style={{ fontSize: '10px', opacity: 0.5, marginRight: '5px' }}>[{log.time}]</span>
                {log.msg}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
