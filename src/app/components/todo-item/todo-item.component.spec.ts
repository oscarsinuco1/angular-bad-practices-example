import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TodoItemComponent } from './todo-item.component';
import { GodService } from '../../services/god.service';
import { Todo } from '../../interfaces/todo.interface';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { By } from '@angular/platform-browser';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatButtonHarness } from '@angular/material/button/testing';

describe('TodoItemComponent', () => {
  let component: TodoItemComponent;
  let fixture: ComponentFixture<TodoItemComponent>;
  let mockGodService: jasmine.SpyObj<GodService>;
  let loader: HarnessLoader;

  const mockTodo: Todo = { id: 1, text: 'Test Todo', isCompleted: false, priority: 'high' };

  beforeEach(async () => {
    mockGodService = jasmine.createSpyObj('GodService', ['toggleTodo', 'deleteTodo']);

    await TestBed.configureTestingModule({
      imports: [
        TodoItemComponent,
        MatCheckboxModule,
        MatIconModule,
        MatButtonModule
      ],
      providers: [
        provideNoopAnimations()
        // GodService is provided via @Input, so we set it manually
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TodoItemComponent);
    component = fixture.componentInstance;
    component.godService = mockGodService;
    component.todo.set(mockTodo);
    fixture.detectChanges();
    loader = TestbedHarnessEnvironment.loader(fixture);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the todo text and completion status', () => {
    const spanElement = fixture.debugElement.query(By.css('span')).nativeElement;
    expect(spanElement.textContent).toContain('Test Todo');
    expect(spanElement.classList.contains('completed')).toBeFalse();

    component.todo.set({ ...mockTodo, isCompleted: true });
    fixture.detectChanges();
    expect(spanElement.classList.contains('completed')).toBeTrue();
  });

  it('should have the checkbox reflect the todo completion status', async () => {
    const checkboxHarness = await loader.getHarness(MatCheckboxHarness);
    expect(await checkboxHarness.isChecked()).toBeFalse();

    component.todo.set({ ...mockTodo, isCompleted: true });
    fixture.detectChanges();
    expect(await checkboxHarness.isChecked()).toBeTrue();
  });

  it('should call onToggle when the checkbox is changed', async () => {
    const checkboxHarness = await loader.getHarness(MatCheckboxHarness);
    await checkboxHarness.toggle();

    expect(mockGodService.toggleTodo).toHaveBeenCalledWith(mockTodo.id);
  });

  it('should call onDelete when the delete button is clicked', async () => {
    const deleteButtonHarness = await loader.getHarness(MatButtonHarness.with({ selector: '[color="warn"]' }));
    await deleteButtonHarness.click();

    expect(mockGodService.deleteTodo).toHaveBeenCalledWith(mockTodo.id);
  });

  describe('getPriorityClass', () => {
    it('should return "priority-high" for high priority todos', () => {
      component.todo.set({ ...mockTodo, priority: 'high' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-high');
      const divElement = fixture.debugElement.query(By.css('.todo-item')).nativeElement;
      expect(divElement.classList.contains('priority-high')).toBeTrue();
    });

    it('should return "priority-medium" for medium priority todos', () => {
      component.todo.set({ ...mockTodo, priority: 'medium' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-medium');
      const divElement = fixture.debugElement.query(By.css('.todo-item')).nativeElement;
      expect(divElement.classList.contains('priority-medium')).toBeTrue();
    });

    it('should return "priority-low" for low priority todos', () => {
      component.todo.set({ ...mockTodo, priority: 'low' });
      fixture.detectChanges();
      expect(component.getPriorityClass()).toBe('priority-low');
      const divElement = fixture.debugElement.query(By.css('.todo-item')).nativeElement;
      expect(divElement.classList.contains('priority-low')).toBeTrue();
    });
  });
});
