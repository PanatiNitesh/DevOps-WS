CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample data
INSERT INTO todos (title, description) VALUES
  ('Learn Docker', 'Complete Day 4 workshop'),
  ('Build Docker containers', 'Create Dockerfiles for frontend and backend'),
  ('Deploy app with Compose', 'Use Docker Compose to orchestrate services');
