import { TestBed } from '@angular/core/testing';
import { GodService } from './god.service';
import { Todo } from '../interfaces/todo.interface';

describe('GodService', () => {
  let service: GodService;
  let consoleLogSpy: jasmine.Spy;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GodService);
    consoleLogSpy = spyOn(console, 'log').and.callThrough();
  });

  // Reset service to initial state for each test
  afterEach(() => {
    // This is a bit of a hack to reset the signal state between tests.
    // In a real app, you'd re-provide the service or have a reset method.
    const initialTodos: Todo[] = [
      { id: 1, text: 'Create a bad practices project', isCompleted: true, priority: 'high' },
      { id: 2, text: 'Add styling with Angular Material', isCompleted: true, priority: 'medium' },
      { id: 3, text: 'Build a real-world example', isCompleted: false, priority: 'high' },
      { id: 4, text: 'Clean up the code', isCompleted: false, priority: 'low' },
    ];
    (service as any).todos.set(initialTodos);
    consoleLogSpy.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Todo Management', () => {
    const initialTodos: Todo[] = [
      { id: 1, text: 'Create a bad practices project', isCompleted: true, priority: 'high' },
      { id: 2, text: 'Add styling with Angular Material', isCompleted: true, priority: 'medium' },
      { id: 3, text: 'Build a real-world example', isCompleted: false, priority: 'high' },
      { id: 4, text: 'Clean up the code', isCompleted: false, priority: 'low' },
    ];

    it('getTodos should return the initial list of todos', () => {
      const todosSignal = service.getTodos();
      expect(todosSignal()).toEqual(initialTodos);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Fetched all todos');
    });

    it('addTodo should add a new todo to the list', () => {
      const newText = 'Write unit tests';
      const newPriority = 'high';
      service.addTodo(newText, newPriority);
      const todos = service.getTodos()();
      expect(todos.length).toBe(initialTodos.length + 1);
      const newTodo = todos[todos.length - 1];
      expect(newTodo.text).toBe(newText);
      expect(newTodo.priority).toBe(newPriority);
      expect(newTodo.isCompleted).toBeFalse();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Added new todo: ${newText}`);
    });

    it('deleteTodo should remove a todo from the list', () => {
      const idToDelete = 1;
      service.deleteTodo(idToDelete);
      const todos = service.getTodos()();
      expect(todos.length).toBe(initialTodos.length - 1);
      expect(todos.find(t => t.id === idToDelete)).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Deleted todo with id: ${idToDelete}`);
    });

    it('deleteTodo should not change the list if id does not exist', () => {
      const nonExistentId = 999;
      service.deleteTodo(nonExistentId);
      const todos = service.getTodos()();
      expect(todos.length).toBe(initialTodos.length);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Deleted todo with id: ${nonExistentId}`);
    });

    it('toggleTodo should change the completion status of a todo', () => {
      const idToToggle = 3; // Initially not completed
      const initialTodo = service.getTodos()().find(t => t.id === idToToggle);
      expect(initialTodo?.isCompleted).toBeFalse();

      service.toggleTodo(idToToggle);
      const toggledTodo = service.getTodos()().find(t => t.id === idToToggle);
      expect(toggledTodo?.isCompleted).toBeTrue();
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Toggled todo with id: ${idToToggle}`);

      service.toggleTodo(idToToggle); // Toggle back
      const toggledBackTodo = service.getTodos()().find(t => t.id === idToToggle);
      expect(toggledBackTodo?.isCompleted).toBeFalse();
    });

    it('toggleTodo should not change the list if id does not exist', () => {
      const nonExistentId = 999;
      const initialTodosState = [...service.getTodos()()];
      service.toggleTodo(nonExistentId);
      expect(service.getTodos()()).toEqual(initialTodosState);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Toggled todo with id: ${nonExistentId}`);
    });
  });

  describe('User Management', () => {
    it('getUsers should return a list of users', () => {
      expect(service.getUsers()).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Fetching all users...');
    });

    it('addUser should log the addition of a user', () => {
      const userName = 'David';
      service.addUser(userName);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Adding user: ${userName}`);
    });
  });

  describe('Product Management', () => {
    it('getProducts should return a list of products', () => {
      expect(service.getProducts()).toEqual(['Laptop', 'Mouse', 'Keyboard']);
      expect(consoleLogSpy).toHaveBeenCalledWith('[GodService Log]: Fetching all products...');
    });

    it('addProduct should log the addition of a product', () => {
      const productName = 'Monitor';
      service.addProduct(productName);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Adding product: ${productName}`);
    });
  });

  describe('Logging Responsibility', () => {
    it('log should call console.log with a formatted message', () => {
      const message = 'Test message';
      service.log(message);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: ${message}`);
    });
  });

  describe('Configuration Management', () => {
    it('getConfig should return a value for a given key', () => {
      const key = 'apiKey';
      expect(service.getConfig(key)).toBe(`Value for ${key}`);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Getting config for key: ${key}`);
    });

    it('updateConfig should log the update of a config', () => {
      const key = 'timeout';
      const value = '5000';
      service.updateConfig(key, value);
      expect(consoleLogSpy).toHaveBeenCalledWith(`[GodService Log]: Updating config for key: ${key} with value: ${value}`);
    });
  });
});
