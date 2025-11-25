import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImportantTodoSummaryComponent } from './important-todo-summary.component';
import { GodService } from '../../services/god.service';
import { Todo } from '../../interfaces/todo.interface';
import { signal, WritableSignal, NO_ERRORS_SCHEMA } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';

// A mock service to control the todos signal for testing purposes
class MockGodService {
  private todosSignal: WritableSignal<Todo[]> = signal([]);

  // This method allows the test to control the signal's value
  setTodos(todos: Todo[]) {
    this.todosSignal.set(todos);
  }

  // This is the method the component will call
  getTodos() {
    return this.todosSignal.asReadonly(); // Return a readonly signal as the real service does
  }
}

describe('ImportantTodoSummaryComponent', () => {
  let component: ImportantTodoSummaryComponent;
  let fixture: ComponentFixture<ImportantTodoSummaryComponent>;
  let mockGodService: MockGodService;

  const mockTodos: Todo[] = [
    { id: 1, text: 'Important task', isCompleted: false, priority: 'high' },
    { id: 2, text: 'Medium task', isCompleted: false, priority: 'medium' },
    { id: 3, text: 'Low task', isCompleted: false, priority: 'low' },
    { id: 4, text: 'Completed important task', isCompleted: true, priority: 'high' },
    { id: 5, text: 'Another important task', isCompleted: false, priority: 'high' },
    { id: 6, text: 'Unsorted task B', isCompleted: false, priority: 'medium' },
  ];

  beforeEach(async () => {
    mockGodService = new MockGodService();

    await TestBed.configureTestingModule({
      imports: [ImportantTodoSummaryComponent],
      providers: [provideNoopAnimations()],
      schemas: [NO_ERRORS_SCHEMA] // To ignore app-todo-item child component
    }).compileComponents();

    fixture = TestBed.createComponent(ImportantTodoSummaryComponent);
    component = fixture.componentInstance;

    // Set the required model input with our mock service instance
    component.godService.set(mockGodService as unknown as GodService);
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should compute `todos` from the service signal', () => {
    mockGodService.setTodos(mockTodos);
    fixture.detectChanges();
    expect(component.todos()).toEqual(mockTodos);
  });

  describe('filterAndProcessTodos', () => {
    beforeEach(() => {
      mockGodService.setTodos(mockTodos);
      fixture.detectChanges();
    });

    it('should filter by priority: high', () => {
      const result = component.filterAndProcessTodos('high');
      expect(result.length).toBe(3); 
      expect(result.every(t => t.priority === 'high')).toBeTrue();
    });
    
    it('should filter by priority: medium', () => {
      const result = component.filterAndProcessTodos('medium');
      expect(result.length).toBe(2);
      expect(result.every(t => t.priority === 'medium')).toBeTrue();
    });

    it('should filter by priority: low', () => {
      const result = component.filterAndProcessTodos('low');
      expect(result.length).toBe(1);
      expect(result.every(t => t.priority === 'low')).toBeTrue();
    });

    it('should filter by completed status (false)', () => {
      const result = component.filterAndProcessTodos(undefined, false);
      expect(result.length).toBe(5);
      expect(result.every(t => !t.isCompleted)).toBeTrue();
    });

    it('should filter by completed status (true)', () => {
      const result = component.filterAndProcessTodos(undefined, true);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(4);
    });

    it('should filter by both high priority and incomplete status', () => {
      const result = component.filterAndProcessTodos('high', false);
      expect(result.length).toBe(2);
      expect(result.every(t => t.priority === 'high' && !t.isCompleted)).toBeTrue();
    });

    it('should filter by both medium priority and complete status', () => {
      const result = component.filterAndProcessTodos('medium', true);
      expect(result.length).toBe(0);
    });

    it('should return all todos sorted by id if no filters are provided', () => {
      const result = component.filterAndProcessTodos();
      expect(result.length).toBe(mockTodos.length);
      expect(result.map(t => t.id)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('should sort todos by id regardless of original order', () => {
      const unsortedTodos: Todo[] = [
        { id: 3, text: 'Task 3', isCompleted: false, priority: 'low' },
        { id: 1, text: 'Task 1', isCompleted: false, priority: 'high' },
        { id: 2, text: 'Task 2', isCompleted: false, priority: 'medium' },
      ];
      mockGodService.setTodos(unsortedTodos);
      fixture.detectChanges();
      const result = component.filterAndProcessTodos();
      expect(result.map(t => t.id)).toEqual([1, 2, 3]);
    });

    it('should return an empty array if todos are empty', () => {
        mockGodService.setTodos([]);
        fixture.detectChanges();
        const result = component.filterAndProcessTodos();
        expect(result).toEqual([]);
    });
  });

  it('should compute `importantTodos` to only include high priority, incomplete tasks', () => {
    mockGodService.setTodos(mockTodos);
    fixture.detectChanges();

    const important = component.importantTodos();
    expect(important.length).toBe(2);
    expect(important.map(t => t.id).sort()).toEqual([1, 5]);
    expect(important.every(t => t.priority === 'high' && !t.isCompleted)).toBeTrue();
  });

  describe('Template Rendering', () => {
    it('should display a message when there are no important todos', () => {
      const noImportantTodos = mockTodos.filter(t => t.priority !== 'high' || t.isCompleted);
      mockGodService.setTodos(noImportantTodos);
      fixture.detectChanges();

      const pElement = fixture.debugElement.query(By.css('p'));
      const listElement = fixture.debugElement.query(By.css('mat-list'));

      expect(pElement).toBeTruthy();
      expect(pElement.nativeElement.textContent).toContain('No important outstanding to-do items!');
      expect(listElement).toBeFalsy();
    });

    it('should display a list when there are important todos', () => {
      mockGodService.setTodos(mockTodos);
      fixture.detectChanges();

      const pElement = fixture.debugElement.query(By.css('p'));
      const listItems = fixture.debugElement.queryAll(By.css('app-todo-item'));

      expect(pElement).toBeFalsy();
      expect(listItems.length).toBe(2); // Two important todos
    });

    it('should display the message if there are no todos at all', () => {
      mockGodService.setTodos([]);
      fixture.detectChanges();
      
      const pElement = fixture.debugElement.query(By.css('p'));
      const listElement = fixture.debugElement.query(By.css('mat-list'));

      expect(pElement).toBeTruthy();
      expect(pElement.nativeElement.textContent).toContain('No important outstanding to-do items!');
      expect(listElement).toBeFalsy();
    });
  });
});
