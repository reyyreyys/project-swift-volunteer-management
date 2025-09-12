import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import axios from 'axios';
import { Upload, FileText, CheckCircle, AlertCircle, Download, X } from 'lucide-react';

const VolunteerCSVImporter = ({ projectId, onImportComplete, onClose }) => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef(null);

  // Helper functions (keep these as they are)
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
  // *** SEPARATE FUNCTIONS - NO INTERFERENCE ***
  
  // Simple exact matching for group names and most fields
  const getFirstSimple = (row, names) => {
    for (const n of names) {
      const k = Object.keys(row).find(h => h.toLowerCase() === n.toLowerCase());
      if (k && row[k] != null && String(row[k]).trim() !== '') return row[k];
    }
    return '';
  };

  // Complex normalization ONLY for shirt sizes
  const normalizeKey = (key) => {
    return String(key || '')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, '"')
      .replace(/â€/g, '"')
      .replace(/'/g, "'")
      .replace(/"/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const getFirstShirtSize = (row, names) => {
    const normalizedNames = names.map(n => normalizeKey(n));
    
    // Try normalized matching first
    for (const key of Object.keys(row)) {
      const normalizedKey = normalizeKey(key);
      const matchIndex = normalizedNames.indexOf(normalizedKey);
      
      if (matchIndex >= 0) {
        const val = row[key];
        if (val != null && String(val).trim() !== '') {
          console.log(`SHIRT SIZE MATCH! Key: "${key}", Value: "${val}"`);
          return String(val).trim();
        }
      }
    }
    
    // Try partial matching for shirt size
    for (const key of Object.keys(row)) {
      const normalizedKey = normalizeKey(key);
      if (normalizedKey.includes('shirt') || (normalizedKey.includes('size') && normalizedKey.includes('indicate'))) {
        const val = row[key];
        if (val != null && String(val).trim() !== '') {
          console.log(`SHIRT SIZE PARTIAL MATCH! Key: "${key}", Value: "${val}"`);
          return String(val).trim();
        }
      }
    }
    
    return '';
  };

  const toBool = (v) => {
    if (v == null) return false;
    const s = String(v).replace(/\u00A0/g, ' ').trim().toLowerCase();
    return ['yes','y','true','1'].includes(s);
  };

  return rawData.map((row, index) => {
    console.log(`\n=== PROCESSING ROW ${index + 1} ===`);

    // Timestamp processing
    let timestamp = new Date();
    const tsStr = getFirstSimple(row, ['Timestamp']);
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

    // Strings -> arrays
    const splitList = (v) => String(v || '')
      .split(',')
      .map(x => x.replace(/\u00A0/g, ' ').trim())
      .filter(Boolean);

    // Core fields - using SIMPLE matching
    const firstName = getFirstSimple(row, ['First Name']);
    const lastName  = getFirstSimple(row, ['Last Name']);
    const email     = getFirstSimple(row, ['Email']);
    const contact   = getFirstSimple(row, ['Contact Number']);
    const ageStr    = getFirstSimple(row, ['Age']);
    const age       = ageStr ? parseInt(ageStr, 10) : null;

    // Availability / prefs - using SIMPLE matching
    const canCommit = toBool(getFirstSimple(row, ['Are you able to commit time for house visits at elderly HoME+ clients between 14–29 June 2025?']));
    const training  = getFirstSimple(row, ['Please indicate your availability for an in-person training & briefing on 1 Jun (Sun) 12pm - 4pm.']);
    const languages = splitList(getFirstSimple(row, ['Please list the languages that you are fluent in']));
    const regions   = splitList(getFirstSimple(row, ['Which region of Singapore do you live/frequent?']));
    const canTravel = toBool(getFirstSimple(row, ['Are you comfortable to travel outside of your preferred region for house visits?']));
    const availableDays = splitList(getFirstSimple(row, ['Days of the Week']));
    const availableTime = splitList(getFirstSimple(row, ['Time of the Day']));

    // Replace your group tracking section with this fixed version:

// *** GROUP TRACKING - FIXED VERSION ***
console.log('\n--- GROUP DEBUGGING ---');

const joiningAns = getFirst(row, [
  'Are you joining as a group?',
  'Are you joining as a group',
  'Joining as a group?',
  'Are you joining a group?'
]);
console.log(`Group joining answer: "${joiningAns}"`);

const isJoiningAsGroup = toBool(joiningAns);
console.log(`Is joining as group: ${isJoiningAsGroup}`);

// Enhanced group name matching - try multiple approaches
let groupNameRaw = '';

// First try exact matching with various apostrophe types
const groupNameVariations = [
  "What is your group's name?",     // straight apostrophe
  "What is your group's name?",     // curly apostrophe
  "What is your group's name?",     // another curly apostrophe variant
  'Group Name',
  'Group name'
];

// Try the standard getFirst approach first
groupNameRaw = getFirst(row, groupNameVariations);

// If that didn't work, try a more flexible search
if (!groupNameRaw) {
  console.log('Standard matching failed, trying flexible search...');
  
  for (const key of Object.keys(row)) {
    const lowerKey = key.toLowerCase();
    
    // Look for columns that contain both "group" and "name" but not "member"
    if (lowerKey.includes('group') && lowerKey.includes('name') && !lowerKey.includes('member')) {
      const value = row[key];
      console.log(`Testing flexible match: "${key}" = "${value}"`);
      
      if (value && String(value).trim() && String(value).trim() !== '') {
        groupNameRaw = String(value).trim();
        console.log(`Found group name via flexible matching: "${groupNameRaw}"`);
        break;
      }
    }
  }
}

console.log(`Group name raw: "${groupNameRaw}"`);

const groupName = isJoiningAsGroup && groupNameRaw && groupNameRaw.trim() 
  ? groupNameRaw.trim() 
  : null;
console.log(`Final group name: "${groupName}"`);

const groupMembers = [];
const memberName = getFirst(row, [
  "Group Member's Name (max 1 person only)",
  "Group Member's Name (max 1 person only)",
  'Group Member Name',
  'Group member name'
]);
if (memberName) groupMembers.push(memberName.trim());

    // *** SHIRT SIZE - COMPLEX MATCHING ONLY ***
    console.log('\n--- SHIRT SIZE DEBUGGING ---');
    const shirtSizeVariations = [
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?\nIf you don't have, please indicate your size.`,
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt? If you don't have, please indicate your size.`,
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt?\nIf you donâ€™t have, please indicate your size.`,
      `Do you already have either a SRC (Target board) or RCY (HIOH) volunteer shirt? If you donâ€™t have, please indicate your size.`,
      `If you don't have, please indicate your size.`,
      `If you donâ€™t have, please indicate your size.`,
      `Please indicate your size.`,
      'Shirt Size',
      'T-Shirt Size',
      'Size'
    ];

    let shirtSizeRaw = '';
    for (const variation of shirtSizeVariations) {
      const testValue = getFirstShirtSize(row, [variation]);
      if (testValue) {
        shirtSizeRaw = testValue;
        console.log(`Found shirt size: "${shirtSizeRaw}"`);
        break;
      }
    }

    // Manual check if still no match
    if (!shirtSizeRaw) {
      console.log('Manual shirt size check...');
      Object.entries(row).forEach(([key, value]) => {
        if (key.toLowerCase().includes('shirt') || 
            key.toLowerCase().includes('size') ||
            (key.toLowerCase().includes('src') && key.toLowerCase().includes('rcy'))) {
          console.log(`Potential shirt field: "${key}" = "${value}"`);
          if (!shirtSizeRaw && value && String(value).trim()) {
            shirtSizeRaw = String(value).trim();
          }
        }
      });
    }

    let finalShirtSize = null;
    if (shirtSizeRaw) {
      const cleaned = String(shirtSizeRaw)
        .replace(/\u00A0/g, ' ')
        .replace(/â€™/g, "'")
        .trim();
      if (cleaned && cleaned.toLowerCase() !== 'null') {
        finalShirtSize = cleaned;
      }
    }

    // Experience - using SIMPLE matching
    const expAns = getFirstSimple(row, ['Do you have experience in house visits, door-to-door survey, DRR, befriending?']);
    const hasExperience = toBool(expAns);
    const experienceSummary = getFirstSimple(row, [
      'Short summary of your experience (if "Yes" on above question)', 
      'Short summary of your experience (if "Yes" on above question)'
    ]) || null;

    // Dietary and comments - using SIMPLE matching
    const dietary = getFirstSimple(row, [
      `Do you have dietary requirements/food allergies (Please indicate in 'Other')?`, 
      `Do you have dietary requirements/food allergies (Please indicate in 'Other')?`
    ]) || null;
    const comments = getFirstSimple(row, ['Any other comments/questions?']) || null;

    // Final result
    const result = {
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
      shirtSize: finalShirtSize,

      isJoiningAsGroup,
      groupName,
      groupMembers,

      comments,

      timestamp,
      submissionDate: timestamp,
      isPublic: true
    };

    console.log(`🎯 FINAL RESULTS for ${firstName}:`);
    console.log(`   - Group Name: "${result.groupName}"`);
    console.log(`   - Is Group: ${result.isJoiningAsGroup}`);
    console.log(`   - Shirt Size: "${result.shirtSize}"`);

    return result;
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
          console.log('First processed:', processedVolunteers[0]);
          
          // Make the API call
          const response = await axios.post('/volunteers/import-csv', { 
            volunteers: processedVolunteers, 
            projectId 
          });
          
          // Set success result
          setImportResult({
            success: true,
            message: response.data.message || 'Volunteers imported successfully',
            created: response.data.created || 0,
            updated: response.data.updated || 0,
            linkedToProject: response.data.linkedToProject || 0,
            errors: response.data.errors || 0,
            errorDetails: response.data.errorDetails || []
          });
          
          // Call the completion callback to refresh other tabs
          if (onImportComplete) {
            onImportComplete();
          }
          
        } catch (error) {
          console.error('Import error:', error);
          
          // Set error result
          setImportResult({
            success: false,
            message: error.response?.data?.message || error.message || 'Failed to import volunteers',
            errorDetails: error.response?.data?.errorDetails || []
          });
        } finally {
          // Always stop loading animation
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
10/05/2025 10:28:34,John,Doe,91234567,[john@example.com](mailto:john@example.com),25,Yes,I will attend,English, Mandarin,Central,Yes,Yes,Volunteered with elderly before,None,No,S,No,Saturday, Sunday,Morning, Evening,,,`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'volunteer-template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Import Volunteer Responses</h2>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Import Info */}
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800 mb-3 font-medium">
              Import volunteer interest form responses from CSV. The system will:
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li className="flex items-center">
                <CheckCircle size={14} className="mr-2 text-green-600 flex-shrink-0" />
                Check for existing volunteers by email/phone
              </li>
              <li className="flex items-center">
                <CheckCircle size={14} className="mr-2 text-green-600 flex-shrink-0" />
                Link existing volunteers to this project
              </li>
              <li className="flex items-center">
                <CheckCircle size={14} className="mr-2 text-green-600 flex-shrink-0" />
                Calculate experience based on participation in other projects
              </li>
              <li className="flex items-center">
                <CheckCircle size={14} className="mr-2 text-green-600 flex-shrink-0" />
                Use original form submission timestamp
              </li>
              <li className="flex items-center">
                <CheckCircle size={14} className="mr-2 text-green-600 flex-shrink-0" />
                Provide detailed import summary
              </li>
            </ul>
          </div>

          {/* Template Download */}
          <div className="mb-6 flex justify-center">
            <button 
              onClick={downloadTemplate} 
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Download size={16} />
              Download Template
            </button>
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              disabled={isImporting}
              className="hidden"
            />
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
              <Upload size={48} className="mx-auto mb-4 text-gray-400" />
              <button 
                onClick={triggerFileInput}
                disabled={isImporting}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                <Upload size={20} />
                Choose CSV File
              </button>
              <p className="mt-2 text-sm text-gray-500">
                Select a CSV file containing volunteer response data
              </p>
            </div>
          </div>

          {/* File Info */}
          {fileName && (
            <div className="flex items-center gap-3 mb-6 p-3 bg-gray-50 rounded-lg">
              <FileText size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700">{fileName}</span>
            </div>
          )}

          {/* Processing Indicator */}
          {isImporting && (
            <div className="flex items-center gap-3 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span className="text-sm font-medium text-blue-800">
                Processing volunteers and preserving submission timestamps...
              </span>
            </div>
          )}

          {/* Import Results */}
          {importResult && (
            <div className={`p-4 rounded-lg border ${
              importResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {importResult.success ? (
                  <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
                )}
                
                <div className="flex-1">
                  <h4 className={`font-semibold ${
                    importResult.success ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {importResult.success ? 'Import Successful!' : 'Import Failed'}
                  </h4>
                  
                  <p className={`text-sm mt-1 ${
                    importResult.success ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {importResult.message}
                  </p>
                  
                  {importResult.success && (
                    <div className="mt-4 space-y-3">
                      {/* Summary Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                          <div className="text-2xl font-bold text-green-600">
                            {importResult.created || 0}
                          </div>
                          <div className="text-xs text-green-700 font-medium">New Volunteers</div>
                        </div>
                        
                        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                          <div className="text-2xl font-bold text-blue-600">
                            {importResult.updated || 0}
                          </div>
                          <div className="text-xs text-blue-700 font-medium">Updated Existing</div>
                        </div>
                        
                        <div className="text-center p-3 bg-white rounded-lg border border-green-200">
                          <div className="text-2xl font-bold text-purple-600">
                            {importResult.linkedToProject || 0}
                          </div>
                          <div className="text-xs text-purple-700 font-medium">Linked to Project</div>
                        </div>
                        
                        {importResult.errors > 0 && (
                          <div className="text-center p-3 bg-white rounded-lg border border-red-200">
                            <div className="text-2xl font-bold text-red-600">
                              {importResult.errors}
                            </div>
                            <div className="text-xs text-red-700 font-medium">Errors</div>
                          </div>
                        )}
                      </div>
                      
                      {/* Status Notes */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 p-2 bg-blue-100 rounded text-blue-800">
                          <span>📊</span>
                          <span>Experience status calculated based on previous project participation</span>
                        </div>
                        
                        <div className="flex items-center gap-2 p-2 bg-purple-100 rounded text-purple-800">
                          <span>⏰</span>
                          <span>Original form submission timestamps preserved</span>
                        </div>
                        
                        {importResult.updated > 0 && (
                          <div className="flex items-center gap-2 p-2 bg-green-100 rounded text-green-800">
                            <span>✅</span>
                            <span>Existing volunteers were successfully linked to this project</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Error Details */}
                  {importResult.errorDetails && importResult.errorDetails.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer font-medium text-red-800 hover:text-red-900">
                        View Error Details ({importResult.errorDetails.length})
                      </summary>
                      <div className="mt-2 p-3 bg-red-100 rounded-lg max-h-48 overflow-y-auto">
                        {importResult.errorDetails.map((error, idx) => (
                          <div key={idx} className="py-1 border-b border-red-200 last:border-b-0">
                            <span className="font-medium text-red-900">{error.volunteer}:</span>
                            <span className="text-red-700 ml-1">{error.error}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VolunteerCSVImporter;
