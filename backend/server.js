const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static('uploads'));

// Create uploads directory
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Database setup
const db = new sqlite3.Database('volunteer_system.db');

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      data TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users (id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS project_collaborators (
      project_id TEXT,
      user_id INTEGER,
      permission TEXT DEFAULT 'view',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.sendStatus(401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Username or email already exists' });
        }
        
        const token = jwt.sign({ userId: this.lastID, username }, JWT_SECRET);
        res.json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  db.get(
    'SELECT * FROM users WHERE username = ? OR email = ?',
    [username, username],
    async (err, user) => {
      if (err || !user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username }, 
        JWT_SECRET,
        { expiresIn: '24h' }
      );
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email 
        } 
      });
    }
  );
});

// Project routes
app.post('/api/projects', authenticateToken, (req, res) => {
  const { id, name, data } = req.body;
  
  db.run(
    'INSERT OR REPLACE INTO projects (id, name, data, created_by, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
    [id, name, JSON.stringify(data), req.user.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, message: 'Project saved successfully' });
    }
  );
});

app.get('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(`
    SELECT p.*, u.username as created_by_name 
    FROM projects p 
    LEFT JOIN users u ON p.created_by = u.id 
    WHERE p.id = ? AND (
      p.created_by = ? OR 
      EXISTS (
        SELECT 1 FROM project_collaborators pc 
        WHERE pc.project_id = p.id AND pc.user_id = ?
      )
    )
  `, [id, req.user.userId, req.user.userId], (err, project) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({
      ...project,
      data: JSON.parse(project.data)
    });
  });
});

app.get('/api/projects', authenticateToken, (req, res) => {
  db.all(`
    SELECT DISTINCT p.id, p.name, p.created_at, p.updated_at, 
           u.username as created_by_name,
           CASE WHEN p.created_by = ? THEN 'owner' ELSE pc.permission END as permission
    FROM projects p 
    LEFT JOIN users u ON p.created_by = u.id
    LEFT JOIN project_collaborators pc ON p.id = pc.project_id
    WHERE p.created_by = ? OR pc.user_id = ?
    ORDER BY p.updated_at DESC
  `, [req.user.userId, req.user.userId, req.user.userId], (err, projects) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(projects);
  });
});

// Share project with another user
app.post('/api/projects/:id/share', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { username, permission = 'view' } = req.body;

  // First check if user owns the project
  db.get(
    'SELECT * FROM projects WHERE id = ? AND created_by = ?',
    [id, req.user.userId],
    (err, project) => {
      if (err || !project) {
        return res.status(403).json({ error: 'Project not found or access denied' });
      }

      // Find the user to share with
      db.get(
        'SELECT id FROM users WHERE username = ?',
        [username],
        (err, user) => {
          if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
          }

          // Add collaborator
          db.run(
            'INSERT OR REPLACE INTO project_collaborators (project_id, user_id, permission) VALUES (?, ?, ?)',
            [id, user.id, permission],
            (err) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              res.json({ success: true, message: 'Project shared successfully' });
            }
          );
        }
      );
    }
  );
});

// Get project collaborators
app.get('/api/projects/:id/collaborators', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.all(`
    SELECT u.username, pc.permission, pc.added_at
    FROM project_collaborators pc
    JOIN users u ON pc.user_id = u.id
    WHERE pc.project_id = ?
  `, [id], (err, collaborators) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(collaborators);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
