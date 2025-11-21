import { Injectable } from '@angular/core';
import { Todo } from '../interfaces/todo.interface';
import { signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GodService {

  // --- To-Do List Responsibility ---
  private todos = signal<Todo[]>([
    { id: 1, text: 'Create a bad practices project', isCompleted: true, priority: 'high' },
    { id: 2, text: 'Add styling with Angular Material', isCompleted: true, priority: 'medium' },
    { id: 3, text: 'Build a real-world example', isCompleted: false, priority: 'high' },
    { id: 4, text: 'Clean up the code', isCompleted: false, priority: 'low' },
  ]);

  getTodos() {
    this.log('Fetched all todos');
    return this.todos;
  }

  addTodo(text: string, priority: 'high' | 'medium' | 'low') {
    const newTodo: Todo = {
      id: Date.now(),
      text,
      isCompleted: false,
      priority
    };
    this.todos.update(currentTodos => [...currentTodos, newTodo]);
    this.log(`Added new todo: ${text}`);
  }

  deleteTodo(id: number) {
    this.todos.update(currentTodos => currentTodos.filter(todo => todo.id !== id));
    this.log(`Deleted todo with id: ${id}`);
  }

  toggleTodo(id: number) {
    this.todos.update(currentTodos =>
      currentTodos.map(todo =>
        todo.id === id ? { ...todo, isCompleted: !todo.isCompleted } : todo
      )
    );
    this.log(`Toggled todo with id: ${id}`);
  }


  // --- User Management Responsibility ---
  getUsers(): string[] {
    this.log('Fetching all users...');
    return ['Alice', 'Bob', 'Charlie'];
  }

  addUser(name: string): void {
    this.log(`Adding user: ${name}`);
  }

  // --- Product Management Responsibility ---
  getProducts(): string[] {
    this.log('Fetching all products...');
    return ['Laptop', 'Mouse', 'Keyboard'];
  }

  addProduct(product: string): void {
    this.log(`Adding product: ${product}`);
  }

  // --- Logging Responsibility ---
  log(message: string): void {
    console.log(`[GodService Log]: ${message}`);
  }

  // --- Configuration Management Responsibility ---
  getConfig(key: string): string {
    this.log(`Getting config for key: ${key}`);
    return `Value for ${key}`;
  }

  updateConfig(key: string, value: string): void {
    this.log(`Updating config for key: ${key} with value: ${value}`);
  }

  constructor() { }
}
