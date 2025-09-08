// src/components/VolunteerCSVImporter.js
import React, { useState } from 'react';
import Papa from 'papaparse';
import { processVolunteerCSV } from '../utils/dataProcessing';

const VolunteerCSVImporter = ({ projectId, onImportComplete }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsImporting(true);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Process CSV data
          const processedVolunteers = processVolunteerCSV(results.data);
          
          // Send to backend
          const response = await fetch('/api/volunteers/import-csv', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              volunteers: processedVolunteers,
              projectId: projectId
            })
          });

          const result = await response.json();
          setImportResult(result);
          
          if (result.success && onImportComplete) {
            onImportComplete(result);
          }
        } catch (error) {
          setImportResult({ 
            success: false, 
            error: error.message 
          });
        }
        setIsImporting(false);
      },
      error: (error) => {
        setImportResult({ 
          success: false, 
          error: `CSV parsing error: ${error.message}` 
        });
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="csv-importer">
      <div className="import-section">
        <h3>Import Volunteer Interest Form Responses</h3>
        <p>Upload your CSV file with volunteer responses to import them into the system.</p>
        
        <input
          type="file"
          accept=".csv"
          onChange={handleFileUpload}
          disabled={isImporting}
        />
        
        {isImporting && (
          <div className="importing">
            <div className="spinner"></div>
            <span>Importing volunteers...</span>
          </div>
        )}
        
        {importResult && (
          <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
            <h4>{importResult.success ? 'Import Successful!' : 'Import Failed'}</h4>
            <p>{importResult.message}</p>
            
            {importResult.success && (
              <div className="import-summary">
                <p>✅ Imported: {importResult.imported} volunteers</p>
                {importResult.errors > 0 && (
                  <p>⚠️ Errors: {importResult.errors} volunteers could not be imported</p>
                )}
              </div>
            )}
            
            {importResult.errorDetails && (
              <details>
                <summary>View Error Details</summary>
                {importResult.errorDetails.map((error, idx) => (
                  <div key={idx} className="error-detail">
                    <strong>{error.volunteer}</strong>: {error.error}
                  </div>
                ))}
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerCSVImporter;
