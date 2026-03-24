const todoModel = require('../models/todo');

const todoController = {
  getAllTodos: (req, res) => {
    const todos = todoModel.getAll();
    res.json({ success: true, data: todos });
  },

  getTodoById: (req, res) => {
    const todo = todoModel.getById(req.params.id);
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Todo not found' 
      });
    }
    res.json({ success: true, data: todo });
  },

  createTodo: (req, res) => {
    const { title } = req.body;
    
    if (!title || title.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      });
    }

    const todo = todoModel.create(title);
    res.status(201).json({ success: true, data: todo });
  },

  updateTodo: (req, res) => {
    const updates = req.body;
    const todo = todoModel.update(req.params.id, updates);
    
    if (!todo) {
      return res.status(404).json({ 
        success: false, 
        error: 'Todo not found' 
      });
    }

    res.json({ success: true, data: todo });
  },

  deleteTodo: (req, res) => {
    const deleted = todoModel.delete(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ 
        success: false, 
        error: 'Todo not found' 
      });
    }

    res.json({ success: true, message: 'Todo deleted' });
  }
};

module.exports = todoController;
