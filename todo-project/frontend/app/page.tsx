"use client";

import { useEffect, useState } from "react";

interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string;
}

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/todos";

  // Fetch todos on mount
  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch(API_URL);
      const data = await res.json();
      if (data.success) {
        setTodos(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch todos", error);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await res.json();
      if (data.success) {
        setTodos([data.data, ...todos]);
        setNewTitle("");
      }
    } catch (error) {
      console.error("Failed to add todo", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, currentStatus: boolean) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !currentStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setTodos(todos.map(t => (t.id === id ? data.data : t)));
      }
    } catch (error) {
      console.error("Failed to toggle todo", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setTodos(todos.filter(t => t.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete todo", error);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf5e6] text-stone-700 flex py-20 justify-center font-sans">
      <div className="w-full max-w-xl mx-auto px-6">
        
        <header className="mb-14 text-center">
          <h1 className="text-4xl font-bold text-stone-700 mb-3 tracking-wide">
            Daily Tasks
          </h1>
          <p className="text-stone-400 text-xs tracking-[0.2em] uppercase font-medium">
            Stay organized & productive
          </p>
        </header>

        <form onSubmit={handleAddTodo} className="flex gap-4 mb-12 w-full relative">
          <input
            type="text"
            className="flex-1 bg-white border border-stone-100 focus:border-[#ff8c94] hover:border-[#ffb3ba] rounded-3xl px-6 py-4 focus:outline-none transition-all duration-300 placeholder:text-stone-300 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.03)] focus:shadow-[0_4px_20px_-3px_rgba(255,140,148,0.15)] text-stone-600 font-medium"
            placeholder="What needs to be done?"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !newTitle.trim()}
            className="bg-[#ff8c94] hover:bg-[#ff6b76] hover:shadow-[0_6px_20px_rgba(255,140,148,0.3)] hover:-translate-y-0.5 text-white font-semibold tracking-wide px-8 py-4 rounded-3xl transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:pointer-events-none disabled:transform-none disabled:shadow-none"
          >
            Add
          </button>
        </form>

        <ul className="space-y-4">
          {todos.length === 0 ? (
            <div className="text-center py-12 px-6 rounded-3xl bg-white/50 border border-stone-100 text-stone-400 italic text-sm">
              Your task list is beautifully empty.
            </div>
          ) : (
            todos.map((todo) => (
              <li 
                key={todo.id} 
                className={`group flex items-center justify-between p-5 rounded-3xl border transition-all duration-300 ${
                  todo.completed 
                    ? "bg-[#f5ead3] border-transparent opacity-60" 
                    : "bg-white border-stone-100 hover:border-[#ff8c94]/40 hover:shadow-[0_12px_35px_rgba(255,140,148,0.12)] hover:-translate-y-1 shadow-[0_8px_20px_rgb(0,0,0,0.02)]"
                }`}
              >
                <div className="flex items-center gap-5">
                  <button
                    onClick={() => handleToggle(todo.id, todo.completed)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 hover:scale-110 ${
                      todo.completed
                        ? "bg-[#ff8c94] border-[#ff8c94] shadow-[0_0_12px_rgba(255,140,148,0.4)]"
                        : "border-stone-200 hover:border-[#ff6b76]"
                    }`}
                  >
                    {todo.completed && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <span className={`text-[1.05rem] font-medium transition-all duration-300 ${todo.completed ? "line-through text-stone-400" : "text-stone-600 group-hover:text-stone-800"}`}>
                    {todo.title}
                  </span>
                </div>
                
                <button
                  onClick={() => handleDelete(todo.id)}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl text-stone-300 hover:text-[#ff4757] hover:bg-[#ffeae8] hover:scale-110 hover:shadow-sm transition-all duration-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Delete"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
