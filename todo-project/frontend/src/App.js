import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Trash2, 
  PlusCircle, 
  ClipboardList,
  AlertCircle
} from 'lucide-react';
import './App.css';

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/todos');
      const data = await response.json();
      setTodos(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching todos:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      if (response.ok) {
        setTitle('');
        setDescription('');
        fetchTodos();
      }
    } catch (err) {
      console.error('Error adding todo:', err);
      setError('Could not add task. Please check your connection.');
    }
  };

  const toggleTodo = async (todo) => {
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...todo, completed: !todo.completed }),
      });
      fetchTodos();
    } catch (err) {
      console.error('Error updating todo:', err);
    }
  };

  const deleteTodo = async (id) => {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      fetchTodos();
    } catch (err) {
      console.error('Error deleting todo:', err);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <ClipboardList size={32} strokeWidth={2.5} />
        <h1>Task Manager</h1>
      </header>

      {error ? (
        <div style={{ 
          background: '#fee2e2', color: '#b91c1c', 
          padding: '12px', borderRadius: '8px', marginBottom: '20px',
          display: 'flex', alignItems: 'center', gap: '8px'
        }}>
          <AlertCircle size={20} />
          {error}
        </div>
      ) : null}
      
      <form onSubmit={addTodo} className="todo-form">
        <div className="input-group">
          <label htmlFor="title">Task Title</label>
          <input
            id="title"
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>
        <div className="input-group">
          <label htmlFor="desc">Notes (optional)</label>
          <input
            id="desc"
            type="text"
            placeholder="Add some details..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button type="submit" className="add-button">
          <PlusCircle size={20} />
          Create Task
        </button>
      </form>

      {loading && <p style={{ textAlign: 'center', color: '#64748b' }}>Updating tasks...</p>}

      {!loading && todos.length === 0 && (
        <div style={{ textAlign: 'center', margin: '40px 0', color: '#94a3b8' }}>
          <p>No tasks yet. Create one to get started!</p>
        </div>
      )}

      <div className="todos-container">
        {todos.map((todo) => (
          <div key={todo.id} className={`todo-card ${todo.completed ? 'completed' : ''}`}>
            <button 
              className="action-btn btn-complete" 
              onClick={() => toggleTodo(todo)}
            >
              {todo.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
            </button>
            <div className="todo-content">
              <h3 className="todo-title" onClick={() => toggleTodo(todo)}>
                {todo.title}
              </h3>
              <p className="todo-desc">{todo.description}</p>
            </div>
            <div className="todo-actions">
              <button 
                className="action-btn btn-delete" 
                onClick={() => deleteTodo(todo.id)}
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
