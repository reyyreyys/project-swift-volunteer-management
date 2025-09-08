import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';

const VolunteerCSVImporter = ({ projectId, onImportComplete, onClose }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Enhanced processVolunteerCSV function with fixes
  const processVolunteerCSV = (rawData) => {
    console.log('Processing CSV data:', rawData.length, 'rows');
    console.log('First row headers:', Object.keys(rawData[0] || {}));
    
    const getFirst = (row, names) => {
      for (const n of names) {
        const k = Object.keys(row).find(h => h.toLowerCase().trim() === n.toLowerCase().trim());
        if (k && row[k] != null && String(row[k]).trim() !== '') return row[k];
      }
      return '';
    };

    const toBool = (v) => {
      if (v == null) return false;
      const s = String(v).replace(/\u00A0/g, ' ').trim().toLowerCase();
      return ['yes','y','true','1'].includes(s);
    };

    // FIXED: Better splitList function that handles various formats
    const splitList = (v) => {
      if (!v) return [];
      
      let str = String(v).replace(/\u00A0/g, ' ').trim();
      
      // Handle different separators and clean up
      const items = str.split(/[,;|]/)
        .map(x => x.replace(/\u00A0/g, ' ').trim())
        .filter(Boolean)
        .filter(x => x !== 'N/A' && x !== 'n/a' && x !== 'NA');
      
      console.log('splitList input:', v, 'output:', items);
      return items;
    };

    return rawData.map((row, index) => {
      console.log(`Processing volunteer ${index + 1}:`, {
        firstName: getFirst(row, ['First Name']),
        lastName: getFirst(row, ['Last Name']),
        rawDaysColumn: row['Days of the Week'] // Log the raw value
      });

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
      
      // FIXED: Better handling of availableDays
      const availableDaysRaw = getFirst(row, ['Days of the Week', 'Days of the week', 'Available Days', 'Availability - Days']);
      const availableDays = splitList(availableDaysRaw);
      console.log('Available Days - Raw:', availableDaysRaw, 'Processed:', availableDays);
      
      const availableTimeRaw = getFirst(row, ['Time of the Day', 'Time of day', 'Available Time', 'Availability - Time']);
      const availableTime = splitList(availableTimeRaw);

      // Grouping (EXACT column plus tolerant fallbacks)
      const joiningAns = getFirst(row, [
        'Are you joining as a group?',
        'Are you joining as a group',   // no question mark
        'Joining as a group?',
        'Are you joining a group?'
      ]);
      const isJoiningAsGroup = toBool(joiningAns);
      const groupName = isJoiningAsGroup
        ? getFirst(row, [
            "What is your group's name?",
            "What is your group's name?", // curly apostrophe variant
            "What is your group name?",
            'Group Name',
            'Group name'
          ]).trim() || null
        : null;
      
      const groupMembers = [];
      const memberName = getFirst(row, [
        "Group Member's Name (max 1 person only)",
        "Group Member's Name (max 1 person only)", // curly apostrophe
        'Group Member Name',
        'Group member name',
        'Additional Group Member'
      ]);
      if (memberName && memberName.trim()) groupMembers.push(memberName.trim());

      // FIXED: Better shirt parsing
      const shirtAnsRaw = getFirst(row, [
        'Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?',
        'Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt',
        'Do you already have either a SRC or RCY volunteer shirt?',
        'Do you have a volunteer shirt?',
        'Have volunteer shirt?'
      ]);
      
      // FIXED: Use exact match instead of contains
      const hasShirt = /^yes$/i.test(String(shirtAnsRaw).replace(/\u00A0/g, ' ').trim());
      console.log('Shirt - Raw answer:', shirtAnsRaw, 'Has shirt:', hasShirt);
      
      let shirtSize = null;
      if (!hasShirt) {
        const size = getFirst(row, [
          "If you don't have, please indicate your size.",
          "If you don't have, please indicate your size.", // curly apostrophe
          "If you don't have please indicate your size.",
          "Shirt size if you don't have one",
          "Required shirt size",
          "Shirt Size"
        ]);
        const norm = String(size).replace(/\u00A0/g, ' ').trim();
        if (norm && !/^(no|nil|n\/a|na)$/i.test(norm)) {
          shirtSize = norm;
        }
      }
      console.log('Shirt size - Raw:', getFirst(row, ["If you don't have, please indicate your size."]), 'Final:', shirtSize);

      // Experience
      const expAns = getFirst(row, [
        'Do you have experience in house visits, door-to-door survey, DRR, befriending?',
        'Do you have experience in house visits door-to-door survey DRR befriending?',
        'Do you have volunteer experience?',
        'Have experience?'
      ]);
      const hasExperience = toBool(expAns);
      const experienceSummary = getFirst(row, [
        'Short summary of your experience (if "Yes" on above question)',
        'Short summary of your experience (if "Yes" on above question)', // curly quotes
        'Experience summary',
        'Summary of experience'
      ]) || null;

      // Dietary and comments
      const dietary = getFirst(row, [
        'Do you have dietary requirements/food allergies (Please indicate in Other)?',
        'Do you have dietary requirements/food allergies (Please indicate in Other)?',
        'Do you have dietary requirements/food allergies?',
        'Dietary requirements',
        'Food allergies'
      ]) || null;
      
      const comments = getFirst(row, [
        'Any other comments/questions?',
        'Comments/questions?',
        'Additional comments',
        'Other comments'
      ]) || null;

      // Create the volunteer object with logging
      const volunteer = {
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
        availableDays, // This should now be properly parsed
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

      console.log(`Volunteer ${index + 1} processed:`, {
        name: `${firstName} ${lastName}`,
        availableDays: volunteer.availableDays,
        hasShirt: volunteer.hasShirt,
        shirtSize: volunteer.shirtSize,
        isJoiningAsGroup: volunteer.isJoiningAsGroup
      });

      return volunteer;
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
      dynamicTyping: false, // Keep as false to avoid unwanted conversions
      // FIXED: Better header and value transformation
      transformHeader: (h) => h.replace(/\u00A0/g, ' ').trim(),
      transform: (v, field) => {
        if (typeof v === 'string') {
          return v.replace(/\u00A0/g, ' ').trim();
        }
        return v;
      },
      complete: async ({ data, errors, meta }) => {
        console.log('Papa meta:', meta);
        console.log('Papa errors:', errors);
        console.log('Raw CSV data (first 2 rows):', data.slice(0, 2));
        
        try {
          const processedVolunteers = processVolunteerCSV(data);
          console.log('Processed volunteers (first 2):', processedVolunteers.slice(0, 2));
          
          const response = await axios.post('/volunteers/import-csv', { 
            volunteers: processedVolunteers, 
            projectId 
          });
          
          setImportResult({
            success: true,
            message: response.data.message,
            created: response.data.created,
            updated: response.data.updated,
            linkedToProject: response.data.linkedToProject,
            errors: response.data.errors,
            errorDetails: response.data.errorDetails
          });
          
          if (onImportComplete) {
            onImportComplete();
          }
        } catch (error) {
          console.error('Import error:', error);
          setImportResult({
            success: false,
            message: error.response?.data?.message || error.message || 'Import failed',
            errorDetails: error.response?.data?.errorDetails
          });
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        console.error('Papa parse error:', error);
        setImportResult({
          success: false,
          message: 'Failed to parse CSV file: ' + error.message
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
    const template = `Timestamp,First Name,Last Name,Contact Number,Email,Age,Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?,Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.,Please list the languages that you are fluent in,Which region of Singapore do you live/frequent?,Are you comfortable to travel outside of your preferred region for house visits?,Do you have experience in house visits, door-to-door survey, DRR, befriending?,Short summary of your experience (if "Yes" on above question),Do you have dietary requirements/food allergies (Please indicate in 'Other')?,Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?,If you don't have, please indicate your size.,Are you joining as a group?,Days of the Week,Time of the Day,What is your group's name?,Group Member's Name (max 1 person only),Any other comments/questions?
10/05/2025 10:28:34,John,Doe,91234567,john@example.com,25,Yes,I will attend,English, Mandarin,Central,Yes,Yes,Volunteered with elderly before,None,No,S,No,Saturday, Sunday,Morning, Evening,,,`;
    
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