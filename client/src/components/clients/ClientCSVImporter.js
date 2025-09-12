import React, { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle, X, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import axios from 'axios';

const ClientCSVImporter = ({ projectId, onComplete, onCancel }) => {
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
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const token = localStorage.getItem('token');
          
          const response = await axios.post(`/projects/${projectId}/clients/import`, {
            clients: results.data
          }, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });

          setResult(response.data);
          if (onComplete) {
            onComplete(response.data);
          }
        } catch (error) {
          console.error('Import error:', error);
          setResult({
            success: false,
            error: error.response?.data?.error || error.message || 'Import failed'
          });
        } finally {
          setImporting(false);
        }
      },
      error: (error) => {
        console.error('CSV parse error:', error);
        setResult({
          success: false,
          error: 'Failed to parse CSV file. Please check the file format.'
        });
        setImporting(false);
      }
    });
  };

  const handleClose = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Import Clients from CSV</h2>
          <button 
            onClick={handleClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={importing}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          {/* Template Download Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">CSV Template</h4>
              <button 
                onClick={downloadTemplate} 
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:border-blue-300 transition-colors"
                disabled={importing}
              >
                <Download className="h-4 w-4" />
                Download Template
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Download the template to see the required format for importing clients.
            </p>
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
              id="client-csv-input"
              disabled={importing}
            />
            <label 
              htmlFor="client-csv-input" 
              className={`inline-flex items-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-all ${
                importing 
                  ? 'border-gray-200 bg-gray-50 cursor-not-allowed' 
                  : 'border-blue-300 bg-blue-50 hover:bg-blue-100 hover:border-blue-400'
              }`}
            >
              <Upload className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-600">
                {file ? 'Change CSV File' : 'Choose CSV File'}
              </span>
            </label>
          </div>

          {/* File Info */}
          {file && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <FileText className="h-4 w-4" />
                <span className="font-medium">{file.name}</span>
                <span className="text-sm">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            </div>
          )}

          {/* Import Button */}
          {file && (
            <div className="mb-6">
              <button
                onClick={handleImport}
                disabled={importing}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing CSV file...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Import Clients
                  </>
                )}
              </button>
            </div>
          )}

          {/* Processing Indicator */}
          {importing && (
            <div className="mb-6 flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <span className="text-sm text-blue-800 font-medium">Processing CSV file...</span>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex gap-3">
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h4 className={`font-semibold mb-2 ${
                    result.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {result.success ? 'Import Successful!' : 'Import Failed'}
                  </h4>
                  
                  {result.success ? (
                    <div className="space-y-1 text-sm text-green-700">
                      <p>Successfully imported <span className="font-medium">{result.imported || result.clientsImported || 0}</span> clients</p>
                      {result.errors > 0 && (
                        <p><span className="font-medium">{result.errors}</span> errors occurred</p>
                      )}
                      {result.duplicates > 0 && (
                        <p><span className="font-medium">{result.duplicates}</span> duplicates skipped</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-red-700">{result.error}</p>
                  )}
                  
                  {result.errorDetails && result.errorDetails.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-medium text-red-800 hover:text-red-900 text-sm">
                        View Error Details ({result.errorDetails.length})
                      </summary>
                      <div className="mt-2 p-3 bg-white bg-opacity-50 rounded border max-h-48 overflow-y-auto">
                        <div className="space-y-2">
                          {result.errorDetails.map((error, index) => (
                            <div key={index} className="text-xs text-red-600 border-b border-red-200 pb-1 last:border-b-0">
                              <span className="font-medium">Row {error.row || index + 1}:</span>{' '}
                              {error.error || error.message}
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleClose}
            disabled={importing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {result?.success ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientCSVImporter;
