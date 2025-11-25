import { TestBed } from '@angular/core/testing';
import { GodService } from './god.service';
import { Todo } from '../interfaces/todo.interface';

describe('GodService', () => {
  let service: GodService;
  let consoleLogSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [GodService]
    });
    service = TestBed.inject(GodService);
    // Use the public reset method to ensure test isolation
    service.resetTodosForTesting();
    consoleLogSpy = spyOn(console, 'log').and.callThrough();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('To-Do List Responsibility', () => {
    it('getTodos should return the signal of todos and log the action', () => {
      const todosSignal = service.getTodos();
      expect(todosSignal).toBeDefined();
      expect(todosSignal().length).toBe(4);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Fetched all todos');
    });

    it('addTodo should add a new todo to the signal and log the action', () => {
      const initialCount = service.getTodos()().length;
      service.addTodo('New Test Todo', 'high');
      const todos = service.getTodos()();
      expect(todos.length).toBe(initialCount + 1);
      const newTodo = todos.find(t => t.text === 'New Test Todo');
      expect(newTodo).toBeDefined();
      expect(newTodo?.priority).toBe('high');
      expect(newTodo?.isCompleted).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Added new todo: New Test Todo');
    });

    it('deleteTodo should remove an existing todo and log the action', () => {
      const todoToDeleteId = 2;
      const initialCount = service.getTodos()().length;
      service.deleteTodo(todoToDeleteId);
      const todos = service.getTodos()();
      expect(todos.length).toBe(initialCount - 1);
      expect(todos.find(t => t.id === todoToDeleteId)).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Deleted todo with id: ${todoToDeleteId}`);
    });

    it('deleteTodo should not fail when deleting a non-existent todo', () => {
      const nonExistentId = 999;
      const initialCount = service.getTodos()().length;
      service.deleteTodo(nonExistentId);
      const todos = service.getTodos()();
      expect(todos.length).toBe(initialCount);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Deleted todo with id: ${nonExistentId}`);
    });

    it('toggleTodo should switch the isCompleted status and log the action', () => {
      const todoToToggleId = 3; // Initially false
      const initialTodo = service.getTodos()().find(t => t.id === todoToToggleId);
      expect(initialTodo?.isCompleted).toBeFalse();

      service.toggleTodo(todoToToggleId);
      let toggledTodo = service.getTodos()().find(t => t.id === todoToToggleId);
      expect(toggledTodo?.isCompleted).toBeTrue();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Toggled todo with id: ${todoToToggleId}`);

      service.toggleTodo(todoToToggleId);
      toggledTodo = service.getTodos()().find(t => t.id === todoToToggleId);
      expect(toggledTodo?.isCompleted).toBeFalse();
    });

    it('toggleTodo should not fail when toggling a non-existent todo', () => {
      const nonExistentId = 999;
      const initialTodosState = JSON.stringify(service.getTodos()());
      service.toggleTodo(nonExistentId);
      const finalTodosState = JSON.stringify(service.getTodos()());
      expect(initialTodosState).toEqual(finalTodosState);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Toggled todo with id: ${nonExistentId}`);
    });
  });

  describe('User Management Responsibility', () => {
    it('getUsers should return a list of user names and log the action', () => {
      const users = service.getUsers();
      expect(users).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Fetching all users...');
    });

    it('addUser should log the new user', () => {
      service.addUser('David');
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Adding user: David');
    });
  });

  describe('Product Management Responsibility', () => {
    it('getProducts should return a list of product names and log the action', () => {
      const products = service.getProducts();
      expect(products).toEqual(['Laptop', 'Mouse', 'Keyboard']);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Fetching all products...');
    });

    it('addProduct should log the new product', () => {
      service.addProduct('Monitor');
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Adding product: Monitor');
    });
  });

  describe('Logging Responsibility', () => {
    it('log should call console.log with the formatted message', () => {
      const message = 'Test log message';
      service.log(message);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: ${message}`);
    });
  });

  describe('Configuration Management Responsibility', () => {
    it('getConfig should return a config value and log the action', () => {
      const key = 'apiKey';
      const value = service.getConfig(key);
      expect(value).toBe(`Value for ${key}`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Getting config for key: ${key}`);
    });

    it('updateConfig should log the update action', () => {
      const key = 'timeout';
      const value = '5000';
      service.updateConfig(key, value);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Updating config for key: ${key} with value: ${value}`);
    });
  });
});
