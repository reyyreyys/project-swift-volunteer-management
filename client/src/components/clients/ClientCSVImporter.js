import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import Papa from 'papaparse';
import axios from 'axios';

const ClientCSVImporter = ({ projectId, onImportComplete, onClose }) => {
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileInputRef = useRef();

  const downloadTemplate = () => {
    const csvContent = [
      ['SRC #', 'Name', 'Gender', 'Race', 'Language Spoken', 'Full Address', 'Location'],
      ['SRC001', 'John Doe', 'Male', 'Chinese', 'English, Mandarin', '123 Main St #01-01', 'Central'],
      ['SRC002', 'Jane Smith', 'Female', 'Indian', 'English, Tamil', '456 Oak Ave #05-20', 'East']
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'clients-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        try {
          const response = await axios.post('/api/clients/import-csv', {
            clients: results.data,
            projectId: projectId
          });

          setResult(response.data);
          if (onImportComplete) {
            onImportComplete(response.data);
          }
        } catch (error) {
          setResult({
            success: false,
            error: error.response?.data?.error || 'Import failed'
          });
        } finally {
          setImporting(false);
        }
      },
      error: (error) => {
        setResult({
          success: false,
          error: 'Failed to parse CSV file'
        });
        setImporting(false);
      }
    });
  };

  return (
    <div className="csv-importer">
      <div className="importer-header">
        <h3>Import Clients from CSV</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button onClick={downloadTemplate} className="template-btn">
            <Download size={16} />
            Download Template
          </button>
          <button onClick={onClose} className="close-btn">
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="file-input-container">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileSelect}
          className="file-input"
          id="client-csv-input"
        />
        <label htmlFor="client-csv-input" className="file-input-label">
          <Upload size={16} />
          Choose CSV File
        </label>
      </div>

      {file && (
        <div className="file-info">
          <FileText size={16} />
          <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
          <button
            onClick={handleImport}
            disabled={importing}
            className="submit-btn"
            style={{ marginLeft: '1rem' }}
          >
            {importing ? (
              <>
                <div className="spinner-small" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={16} />
                Import Clients
              </>
            )}
          </button>
        </div>
      )}

      {importing && (
        <div className="processing-indicator">
          <div className="spinner-small" />
          <span>Processing CSV file...</span>
        </div>
      )}

      {result && (
        <div className={`import-status ${result.success ? 'success' : 'error'}`}>
          {result.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          <div className="import-details">
            <strong>{result.success ? 'Import Successful!' : 'Import Failed'}</strong>
            {result.success ? (
              <div className="import-summary">
                <p>Successfully imported {result.imported} clients</p>
                {result.errors > 0 && <p>{result.errors} errors occurred</p>}
              </div>
            ) : (
              <p>{result.error}</p>
            )}
            
            {result.errorDetails && result.errorDetails.length > 0 && (
              <details className="error-details">
                <summary>View Error Details ({result.errorDetails.length})</summary>
                <div className="error-list">
                  {result.errorDetails.map((error, index) => (
                    <div key={index} className="error-detail">
                      <strong>{error.client}:</strong> {error.error}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCSVImporter;
