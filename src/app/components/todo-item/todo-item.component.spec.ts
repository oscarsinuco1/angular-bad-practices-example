import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TodoItemComponent } from './todo-item.component';
import { GodService } from '../../services/god.service';
import { Todo } from '../../interfaces/todo.interface';
import { signal } from '@angular/core';

describe('TodoItemComponent', () => {
  let component: TodoItemComponent;
  let fixture: ComponentFixture<TodoItemComponent>;
  let mockGodService: jasmine.SpyObj<GodService>;

  const mockTodo: Todo = {
    id: 1,
    title: 'Test Todo',
    description: 'This is a test todo',
    isCompleted: false,
    priority: 'medium'
  };

  beforeEach(async () => {
    mockGodService = jasmine.createSpyObj('GodService', ['toggleTodo', 'deleteTodo']);

    await TestBed.configureTestingModule({
      imports: [TodoItemComponent],
      providers: [
        { provide: GodService, useValue: mockGodService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TodoItemComponent);
    component = fixture.componentInstance;

    // Set the required input for the component
    component.todo = signal(mockTodo);
    component.godService = mockGodService; // Manually assign the mock service
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call godService.toggleTodo when onToggle is called', () => {
    const todoId = 1;
    component.onToggle(todoId);
    expect(mockGodService.toggleTodo).toHaveBeenCalledWith(todoId);
  });

  it('should call godService.deleteTodo when onDelete is called', () => {
    const todoId = 1;
    component.onDelete(todoId);
    expect(mockGodService.deleteTodo).toHaveBeenCalledWith(todoId);
  });

  describe('getPriorityClass', () => {
    it('should return "priority-high" for high priority', () => {
      component.todo = signal({ ...mockTodo, priority: 'high' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-high');
    });

    it('should return "priority-medium" for medium priority', () => {
      component.todo = signal({ ...mockTodo, priority: 'medium' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-medium');
    });

    it('should return "priority-low" for low priority', () => {
      component.todo = signal({ ...mockTodo, priority: 'low' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-low');
    });

    it('should return "priority-low" for undefined priority', () => {
      component.todo = signal({ ...mockTodo, priority: undefined });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-low');
    });

    it('should return "priority-low" for any other priority value', () => {
      component.todo = signal({ ...mockTodo, priority: 'unknown' as any }); // Test with an invalid priority
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-low');
    });
  });
});