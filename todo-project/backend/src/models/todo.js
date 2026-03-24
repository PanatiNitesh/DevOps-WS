class TodoModel {
  constructor() {
    this.todos = [
      { id: 1, title: 'Learn Next.js', completed: false, createdAt: new Date().toISOString() },
      { id: 2, title: 'Build a Todo API', completed: true, createdAt: new Date().toISOString() }
    ];
    this.nextId = 3;
  }

  getAll() {
    return this.todos;
  }

  getById(id) {
    return this.todos.find(todo => todo.id === parseInt(id));
  }

  create(title) {
    const todo = {
      id: this.nextId++,
      title,
      completed: false,
      createdAt: new Date().toISOString()
    };
    this.todos.unshift(todo);
    return todo;
  }

  update(id, updates) {
    const todo = this.getById(id);
    if (!todo) return null;
    
    Object.assign(todo, updates);
    return todo;
  }

  delete(id) {
    const index = this.todos.findIndex(todo => todo.id === parseInt(id));
    if (index === -1) return false;
    
    this.todos.splice(index, 1);
    return true;
  }
}

// Singleton instance
const todoModel = new TodoModel();

module.exports = todoModel;
