import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';

const VolunteerCSVImporter = ({ projectId, onImportComplete, onClose }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Helper functions
  const getFirst = (row, names) => {
    for (const n of names) {
      const k = Object.keys(row).find(h => h.toLowerCase() === n.toLowerCase());
      if (k && row[k] != null && String(row[k]).trim() !== '') return row[k];
    }
    return '';
  };

  const toBool = (v) => {
    if (v == null) return false;
    const s = String(v).replace(/\u00A0/g, ' ').trim().toLowerCase();
    return ['yes','y','true','1'].includes(s);
  };

  const splitList = (v) => String(v || '')
    .split(',')
    .map(x => x.replace(/\u00A0/g, ' ').trim())
    .filter(Boolean);

  const processVolunteerCSV = (rawData) => {
    return rawData.map((row, index) => {
      // Timestamp (DD/MM/YYYY HH:mm:ss first)
      let timestamp = new Date();
      const tsStr = getFirst(row, ['Timestamp']);
      if (tsStr) {
        const m = String(tsStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
        if (m) {
          const [, d, mo, y, h, mi, s] = m;
          timestamp = new Date(parseInt(y), parseInt(mo) - 1, parseInt(d), parseInt(h), parseInt(mi), parseInt(s));
        } else {
          const d = new Date(tsStr);
          if (!isNaN(d.getTime())) timestamp = d;
        }
      }

      // Core fields
      const firstName = getFirst(row, ['First Name']);
      const lastName  = getFirst(row, ['Last Name']);
      const email     = getFirst(row, ['Email']);
      const contact   = getFirst(row, ['Contact Number']);
      const ageStr    = getFirst(row, ['Age']);
      const age       = ageStr ? parseInt(ageStr, 10) : null;

      // Availability / prefs
      const canCommit = toBool(getFirst(row, ['Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?']));
      const training  = getFirst(row, ['Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.']);
      const languages = splitList(getFirst(row, ['Please list the languages that you are fluent in']));
      const regions   = splitList(getFirst(row, ['Which region of Singapore do you live/frequent?']));
      const canTravel = toBool(getFirst(row, ['Are you comfortable to travel outside of your preferred region for house visits?']));
      const availableDays = splitList(getFirst(row, ['Days of the Week']));
      const availableTime = splitList(getFirst(row, ['Time of the Day']));

      // Grouping
      const joiningAns = getFirst(row, [
        'Are you joining as a group?',
        'Are you joining as a group',
        'Joining as a group?',
        'Are you joining a group?'
      ]);
      const isJoiningAsGroup = toBool(joiningAns);
      const groupName = isJoiningAsGroup
        ? getFirst(row, [
            "What is your group's name?",
            'Group Name',
            'Group name'
          ]).trim() || null
        : null;
      const groupMembers = [];
      const memberName = getFirst(row, [
        "Group Member's Name (max 1 person only)",
        'Group Member Name',
        'Group member name'
      ]);
      if (memberName) groupMembers.push(memberName.trim());

      // Enhanced shirt parsing - handle all formats from your CSV
      const shirtField = getFirst(row, [
        'Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?',
        "Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?\nIf you don't have, please indicate your size.",
        'Do you already have either a SRC or RCY volunteer shirt?'
      ]);
      
      let hasShirt = false;
      let shirtSize = null;
      
      if (shirtField) {
        const shirtStr = String(shirtField).replace(/\u00A0/g, ' ').trim();
        
        // Handle "Yes, no need shirt" format (they already have a shirt)
        if (/yes.*no need shirt/i.test(shirtStr)) {
          hasShirt = true;
          shirtSize = null;
        }
        // Handle "No - SIZE" format (they need a shirt in specified size)
        else if (/^no\s*-\s*([a-z0-9]+)$/i.test(shirtStr)) {
          hasShirt = false;
          const match = shirtStr.match(/^no\s*-\s*([a-z0-9]+)$/i);
          if (match && match[1]) {
            shirtSize = match[1].toUpperCase();
          }
        }
        // Handle just "Yes" (they have a shirt)
        else if (/^yes$/i.test(shirtStr)) {
          hasShirt = true;
          shirtSize = null;
        }
        // Handle just "No" (they don't have a shirt, no size specified)
        else if (/^no$/i.test(shirtStr)) {
          hasShirt = false;
          shirtSize = null;
        }
        // Handle specific sizes without "No -" prefix (e.g., just "M", "L", "XL")
        else if (/^(xxs|xs|s|m|l|xl|xxl|xxxl)$/i.test(shirtStr)) {
          hasShirt = false;
          shirtSize = shirtStr.toUpperCase();
        }
        // Handle variations like "Need M", "Size L", etc.
        else if (/(?:need|size|require)?\s*(xxs|xs|s|m|l|xl|xxl|xxxl)/i.test(shirtStr)) {
          hasShirt = false;
          const match = shirtStr.match(/(?:need|size|require)?\s*(xxs|xs|s|m|l|xl|xxl|xxxl)/i);
          if (match && match[1]) {
            shirtSize = match[1].toUpperCase();
          }
        }
      }

      // Experience
      const expAns = getFirst(row, ['Do you have experience in house visits, door-to-door survey, DRR, befriending?']);
      const hasExperience = toBool(expAns);
      const experienceSummary = getFirst(row, [
        'Short summary of your experience (if "Yes" on above question)', 
        'Short summary of your experience (if "Yes" on above question)',
        'Experience summary',
        'Summary of experience'
      ]) || null;

      // Dietary and comments
      const dietary = getFirst(row, [
        'Do you have dietary requirements/food allergies (Please indicate in \'Other\')?', 
        "Do you have dietary requirements/food allergies (Please indicate in 'Other')?",
        'Dietary requirements',
        'Food allergies'
      ]) || null;
      
      const comments = getFirst(row, [
        'Any other comments/questions?',
        'Comments',
        'Questions',
        'Additional comments'
      ]) || null;

      // Return normalized volunteer
      return {
        firstName,
        lastName,
        email: email || null,
        contactNumber: contact || null,
        age,

        canCommit,
        trainingAttendance: training || null,
        languages,
        regions,
        canTravel,
        availableDays,
        availableTime,

        hasExperience,
        experienceSummary,

        dietary,
        hasShirt,
        shirtSize,

        isJoiningAsGroup,
        groupName,
        groupMembers,

        comments,

        timestamp,
        submissionDate: timestamp,
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
      skipEmptyLines: 'greedy',
      dynamicTyping: false,
      transformHeader: (h) => h.replace(/\u00A0/g, ' ').trim(),
      transform: (v) => (typeof v === 'string' ? v.replace(/\u00A0/g, ' ').trim() : v),
      complete: async ({ data, errors, meta }) => {
        try {
          console.log('Papa meta:', meta);
          console.log('Papa errors:', errors);
          console.log('First 2 rows after parse:', data.slice(0, 2));
          
          const processedVolunteers = processVolunteerCSV(data);
          console.log('First processed volunteer:', processedVolunteers[0]);
          console.log('Shirt processing examples:', processedVolunteers.slice(0, 5).map(v => ({
            name: `${v.firstName} ${v.lastName}`,
            hasShirt: v.hasShirt,
            shirtSize: v.shirtSize
          })));
          
          // Make API call to import volunteers
          const response = await axios.post('/volunteers/import-csv', { 
            volunteers: processedVolunteers, 
            projectId 
          });
          
          setImportResult(response.data);
          
          // Call completion callback if provided
          if (onImportComplete) {
            onImportComplete(response.data);
          }
          
        } catch (error) {
          console.error('Import error:', error);
          setImportResult({
            success: false,
            message: error.response?.data?.error || 'Failed to import volunteers',
            error: error.message
          });
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        console.error('CSV parsing error:', error);
        setImportResult({
          success: false,
          message: 'Failed to parse CSV file',
          error: error.message
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
    const template = `Timestamp,First Name,Last Name,Contact Number,Email,Age,Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?,Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.,Please list the languages that you are fluent in,Which region of Singapore do you live/frequent?,Are you comfortable to travel outside of your preferred region for house visits?,Do you have experience in house visits, door-to-door survey, DRR, befriending?,Short summary of your experience (if "Yes" on above question),Do you have dietary requirements/food allergies (Please indicate in 'Other')?,Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?,Are you joining as a group?,Days of the Week,Time of the Day,What is your group's name?,Group Member's Name (max 1 person only),Any other comments/questions?
10/05/2025 10:28:34,John,Doe,91234567,john@example.com,25,Yes,I will attend,"English, Mandarin",Central,Yes,Yes,Volunteered with elderly before,None,"No - S",No,"Saturday, Sunday","Morning, Evening",,,
10/05/2025 10:35:00,Jane,Smith,98765432,jane@example.com,30,Yes,I will attend,"English, Tamil",West,Yes,No,,Vegetarian,"Yes, no need shirt",Yes,"Weekends","Morning, Afternoon",Team Alpha,Alice Brown,Looking forward to helping!`;
    
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
              <li>✅ Parse shirt requirements and sizes correctly</li>
              <li>✅ Use original form submission timestamp</li>
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
              <span>Processing volunteers and preserving submission timestamps...</span>
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
                    <div className="timestamp-note">
                      ⏰ Original form submission timestamps preserved
                    </div>
                    <div className="shirt-note">
                      👕 Shirt requirements and sizes processed correctly
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
