import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TodoItemComponent } from './todo-item.component';
import { GodService } from '../../services/god.service';
import { Todo } from '../../interfaces/todo.interface';
import { MatCheckboxModule } from '@angular/material/checkbox';

describe('TodoItemComponent', () => {
  let component: TodoItemComponent;
  let fixture: ComponentFixture<TodoItemComponent>;
  let mockGodService: jasmine.SpyObj<GodService>;

  const mockTodo: Todo = {
    id: 1,
    text: 'Test Todo',
    isCompleted: false,
    priority: 'medium',
  };

  beforeEach(async () => {
    mockGodService = jasmine.createSpyObj('GodService', ['toggleTodo', 'deleteTodo']);

    await TestBed.configureTestingModule({
      imports: [TodoItemComponent, MatCheckboxModule],
      providers: [
        provideNoopAnimations(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TodoItemComponent);
    component = fixture.componentInstance;

    // Set model inputs
    component.todo.set(mockTodo);
    component.godService.set(mockGodService);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should call godService.toggleTodo when onToggle is invoked', () => {
    component.onToggle(mockTodo.id);
    expect(mockGodService.toggleTodo).toHaveBeenCalledWith(mockTodo.id);
  });

  it('should call godService.deleteTodo when onDelete is invoked', () => {
    component.onDelete(mockTodo.id);
    expect(mockGodService.deleteTodo).toHaveBeenCalledWith(mockTodo.id);
  });

  describe('Template Events', () => {
    it('should call onToggle when the checkbox state is changed', () => {
      spyOn(component, 'onToggle').and.callThrough();
      const checkbox = fixture.debugElement.query(By.css('mat-checkbox'));
      checkbox.triggerEventHandler('change', { checked: true });
      fixture.detectChanges();
      expect(component.onToggle).toHaveBeenCalledWith(mockTodo.id);
      expect(mockGodService.toggleTodo).toHaveBeenCalledWith(mockTodo.id);
    });

    it('should call onDelete when the delete button is clicked', () => {
      spyOn(component, 'onDelete').and.callThrough();
      const deleteButton = fixture.debugElement.query(By.css('button[mat-icon-button]'));
      deleteButton.triggerEventHandler('click', null);
      fixture.detectChanges();
      expect(component.onDelete).toHaveBeenCalledWith(mockTodo.id);
      expect(mockGodService.deleteTodo).toHaveBeenCalledWith(mockTodo.id);
    });
  });

  describe('getPriorityClass', () => {
    it("should return 'priority-high' for high priority todos", () => {
      component.todo.set({ ...mockTodo, priority: 'high' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-high');
      const divElement = fixture.debugElement.query(By.css('.todo-item')).nativeElement;
      expect(divElement.classList).toContain('priority-high');
    });

    it("should return 'priority-medium' for medium priority todos", () => {
      component.todo.set({ ...mockTodo, priority: 'medium' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-medium');
      const divElement = fixture.debugElement.query(By.css('.todo-item')).nativeElement;
      expect(divElement.classList).toContain('priority-medium');
    });

    it("should return 'priority-low' for low priority todos and as default", () => {
      component.todo.set({ ...mockTodo, priority: 'low' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-low');
      const divElement = fixture.debugElement.query(By.css('.todo-item')).nativeElement;
      expect(divElement.classList).toContain('priority-low');
    });
  });

  describe('Template Rendering', () => {
    it('should render the todo text', () => {
      const spanElement = fixture.debugElement.query(By.css('span')).nativeElement;
      expect(spanElement.textContent).toContain(mockTodo.text);
    });

    it('should apply the `completed` class when todo is completed', () => {
      component.todo.set({ ...mockTodo, isCompleted: true });
      fixture.detectChanges();
      const spanElement = fixture.debugElement.query(By.css('span'));
      expect(spanElement.classes['completed']).toBeTrue();
    });

    it('should not apply the `completed` class when todo is not completed', () => {
      component.todo.set({ ...mockTodo, isCompleted: false });
      fixture.detectChanges();
      const spanElement = fixture.debugElement.query(By.css('span'));
      expect(spanElement.classes['completed']).toBeFalsy();
    });

    it('should set the checkbox `checked` property based on isCompleted', () => {
      // Check when true
      component.todo.set({ ...mockTodo, isCompleted: true });
      fixture.detectChanges();
      let checkboxComponent = fixture.debugElement.query(By.css('mat-checkbox')).componentInstance;
      expect(checkboxComponent.checked).toBeTrue();

      // Check when false
      component.todo.set({ ...mockTodo, isCompleted: false });
      fixture.detectChanges();
      checkboxComponent = fixture.debugElement.query(By.css('mat-checkbox')).componentInstance;
      expect(checkboxComponent.checked).toBeFalse();
    });
  });
});
