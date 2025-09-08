import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';

const VolunteerCSVImporter = ({ projectId, onImportComplete, onClose }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  const processVolunteerCSV = (rawData) => {
    return rawData.map((row) => {
      // Parse timestamp
      let timestamp = null;
      if (row['Timestamp']) {
        timestamp = new Date(row['Timestamp']);
      }

      // Parse languages
      const languages = (row['Please list the languages that you are fluent in'] || '')
        .split(',')
        .map(lang => lang.trim())
        .filter(lang => lang);

      // Parse regions
      const regions = (row['Which region of Singapore do you live/frequent?'] || '')
        .split(',')
        .map(region => region.trim())
        .filter(region => region);

      // Parse available days
      const availableDays = (row['Days of the Week'] || '')
        .split(',')
        .map(day => day.trim())
        .filter(day => day);

      // Parse available times
      const availableTime = (row['Time of the Day'] || '')
        .split(',')
        .map(time => time.trim())
        .filter(time => time);

      // Parse group members
      const groupMembers = [];
      if (row["Group Member's Name (max 1 person only)"]) {
        groupMembers.push(row["Group Member's Name (max 1 person only)"].trim());
      }

      // Parse shirt information
      const shirtResponse = row['If you don\'t have, please indicate your size.'] || '';
      let hasShirt = null;
      let shirtSize = null;
      
      if (row['Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?']) {
        const shirtAnswer = row['Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?'];
        hasShirt = shirtAnswer.toLowerCase().includes('yes');
        
        if (!hasShirt && shirtResponse && !shirtResponse.toLowerCase().includes('no')) {
          shirtSize = shirtResponse.trim();
        }
      }

      return {
        firstName: row['First Name'] || '',
        lastName: row['Last Name'] || '',
        email: row['Email'] || null,
        contactNumber: row['Contact Number'] || null,
        age: row['Age'] ? parseInt(row['Age']) : null,
        
        // Commitment & Availability
        canCommit: (row['Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?'] || '').toLowerCase() === 'yes',
        trainingAttendance: row['Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.'] || null,
        languages: languages,
        regions: regions,
        canTravel: (row['Are you comfortable to travel outside of your preferred region for house visits?'] || '').toLowerCase() === 'yes',
        availableDays: availableDays,
        availableTime: availableTime,
        
        // Experience - will be calculated based on other projects, not survey response
        hasExperience: false, // Will be set by backend based on project participation
        experienceSummary: row['Short summary of your experience (if "Yes" on above question)'] || null,
        
        // Personal Requirements
        dietary: row['Do you have dietary requirements/food allergies (Please indicate in \'Other\')?'] || null,
        hasShirt: hasShirt,
        shirtSize: shirtSize,
        
        // Group Information
        isJoiningAsGroup: (row['Are you joining as a group?'] || '').toLowerCase() === 'yes',
        groupName: row["What is your group's name?"] || null,
        groupMembers: groupMembers,
        
        // Additional
        comments: row['Any other comments/questions?'] || null,
        timestamp: timestamp,
        
        // System fields
        isPublic: true
      };
    });
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setIsImporting(true);
    setImportResult(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          // Process CSV data
          const processedVolunteers = processVolunteerCSV(results.data);
          
          // Send to backend with enhanced import endpoint
          const response = await axios.post('/volunteers/import-csv', {
            volunteers: processedVolunteers,
            projectId: projectId
          });

          setImportResult(response.data);
          
          if (response.data.success && onImportComplete) {
            onImportComplete(response.data);
          }
        } catch (error) {
          setImportResult({ 
            success: false, 
            error: error.response?.data?.error || error.message 
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

    // Reset file input to allow same file to be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const downloadTemplate = () => {
    const template = `Timestamp,First Name,Last Name,Contact Number,Email,Age,Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?,Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.,Please list the languages that you are fluent in,Which region of Singapore do you live/frequent?,Are you comfortable to travel outside of your preferred region for house visits?,Do you have experience in house visits door-to-door survey DRR befriending?,Short summary of your experience (if "Yes" on above question),Do you have dietary requirements/food allergies (Please indicate in 'Other')?,Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?,If you don't have please indicate your size.,Are you joining as a group?,Days of the Week,Time of the Day,What is your group's name?,Group Member's Name (max 1 person only),Any other comments/questions?
10/05/2025 10:28:34,John,Doe,91234567,john@example.com,25,Yes,I will attend,English Mandarin,Central,Yes,Yes,Volunteered with elderly before,None,No - M,No,Saturday Sunday,Morning Evening,,,`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'volunteer-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-overlay">
      <div className="modal csv-import-modal">
        <div className="modal-header">
          <h2>Import Volunteer Responses</h2>
          <button onClick={onClose} className="close-btn">
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="import-info">
            <p>Import volunteer interest form responses from CSV. The system will:</p>
            <ul>
              <li>✅ Check for existing volunteers by email/phone</li>
              <li>✅ Link existing volunteers to this project</li>
              <li>✅ Calculate experience based on participation in other projects</li>
              <li>✅ Provide detailed import summary</li>
            </ul>
          </div>

          <div className="importer-actions">
            <button onClick={downloadTemplate} className="template-btn">
              <Download size={16} />
              Download Template
            </button>
          </div>

          <div className="file-upload-section">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              disabled={isImporting}
              style={{ display: 'none' }}
            />
            
            <button 
              onClick={triggerFileInput}
              disabled={isImporting}
              className="file-upload-btn"
            >
              <Upload size={20} />
              Choose CSV File
            </button>
          </div>

          {fileName && (
            <div className="file-info">
              <FileText size={16} />
              <span>{fileName}</span>
            </div>
          )}

          {isImporting && (
            <div className="processing-indicator">
              <div className="spinner"></div>
              <span>Processing volunteers and calculating experience...</span>
            </div>
          )}

          {importResult && (
            <div className={`import-status ${importResult.success ? 'success' : 'error'}`}>
              {importResult.success ? (
                <CheckCircle size={16} />
              ) : (
                <AlertCircle size={16} />
              )}
              <div className="import-details">
                <strong>{importResult.success ? 'Import Successful!' : 'Import Failed'}</strong>
                <p>{importResult.message}</p>
                
                {importResult.success && (
                  <div className="import-summary">
                    <div className="summary-grid">
                      <div className="summary-item">
                        <span className="summary-label">New Volunteers:</span>
                        <span className="summary-value">{importResult.created || 0}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Updated Existing:</span>
                        <span className="summary-value">{importResult.updated || 0}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">Linked to Project:</span>
                        <span className="summary-value">{importResult.linkedToProject || 0}</span>
                      </div>
                      {importResult.errors > 0 && (
                        <div className="summary-item error">
                          <span className="summary-label">Errors:</span>
                          <span className="summary-value">{importResult.errors}</span>
                        </div>
                      )}
                    </div>
                    <div className="experience-note">
                      📊 Experience status calculated based on previous project participation
                    </div>
                    {importResult.updated > 0 && (
                      <div className="existing-note">
                        ✅ Existing volunteers were successfully linked to this project
                      </div>
                    )}
                  </div>
                )}
                
                {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                  <details className="error-details">
                    <summary>View Error Details ({importResult.errorDetails.length})</summary>
                    <div className="error-list">
                      {importResult.errorDetails.map((error, idx) => (
                        <div key={idx} className="error-detail">
                          <strong>{error.volunteer}</strong>: {error.error}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="cancel-btn">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VolunteerCSVImporter;
