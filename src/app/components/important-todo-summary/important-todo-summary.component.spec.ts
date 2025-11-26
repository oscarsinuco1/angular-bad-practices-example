import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal, WritableSignal } from '@angular/core';
import { ImportantTodoSummaryComponent } from './important-todo-summary.component';
import { GodService } from '../../services/god.service';
import { Todo } from '../../interfaces/todo.interface';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { By } from '@angular/platform-browser';

class MockGodService {
  private todosSignal: WritableSignal<Todo[]> = signal([]);
  
  getTodos() {
    return this.todosSignal.asReadonly();
  }

  setTodos(todos: Todo[]) {
    this.todosSignal.set(todos);
  }
}

describe('ImportantTodoSummaryComponent', () => {
  let component: ImportantTodoSummaryComponent;
  let fixture: ComponentFixture<ImportantTodoSummaryComponent>;
  let mockGodService: MockGodService;

  const mockTodos: Todo[] = [
    { id: 1, text: 'High prio incomplete', isCompleted: false, priority: 'high' },
    { id: 2, text: 'High prio complete', isCompleted: true, priority: 'high' },
    { id: 3, text: 'Medium prio incomplete', isCompleted: false, priority: 'medium' },
    { id: 4, text: 'Low prio incomplete', isCompleted: false, priority: 'low' },
    { id: 5, text: 'Another high prio incomplete', isCompleted: false, priority: 'high' },
  ];

  beforeEach(async () => {
    mockGodService = new MockGodService();
    
    await TestBed.configureTestingModule({
      imports: [ImportantTodoSummaryComponent],
      providers: [
        provideNoopAnimations(),
      ],
      schemas: [NO_ERRORS_SCHEMA] // To ignore app-todo-item
    }).compileComponents();

    fixture = TestBed.createComponent(ImportantTodoSummaryComponent);
    component = fixture.componentInstance;
    component.godService.set(mockGodService as unknown as GodService); // Set the mock service
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('Computed Signal: importantTodos', () => {
    it('should only contain high-priority, incomplete todos', fakeAsync(() => {
      mockGodService.setTodos(mockTodos);
      fixture.detectChanges();
      tick(); // allow computed signal to update

      const important = component.importantTodos();
      expect(important.length).toBe(2);
      expect(important[0].id).toBe(1);
      expect(important[1].id).toBe(5);
      expect(important.every(t => t.priority === 'high' && !t.isCompleted)).toBeTrue();
    }));

    it('should be empty if there are no high-priority, incomplete todos', fakeAsync(() => {
        const noImportantTodos: Todo[] = [
            { id: 2, text: 'High prio complete', isCompleted: true, priority: 'high' },
            { id: 3, text: 'Medium prio incomplete', isCompleted: false, priority: 'medium' }
        ];
        mockGodService.setTodos(noImportantTodos);
        fixture.detectChanges();
        tick();

        expect(component.importantTodos().length).toBe(0);
    }));

    it('should update when the source todos signal changes', fakeAsync(() => {
        mockGodService.setTodos([]);
        fixture.detectChanges();
        tick();
        expect(component.importantTodos().length).toBe(0);

        mockGodService.setTodos(mockTodos);
        fixture.detectChanges();
        tick();
        expect(component.importantTodos().length).toBe(2);
    }));
  });

  describe('Template Rendering', () => {
    it('should display a message when there are no important todos', fakeAsync(() => {
        mockGodService.setTodos([]);
        fixture.detectChanges();
        tick();

        const pElement = fixture.debugElement.query(By.css('p'));
        expect(pElement).not.toBeNull();
        expect(pElement.nativeElement.textContent).toContain('No important outstanding to-do items!');
        const listElement = fixture.debugElement.query(By.css('mat-list'));
        expect(listElement).toBeNull();
    }));

    it('should display a list of important todos when they exist', fakeAsync(() => {
        mockGodService.setTodos(mockTodos);
        fixture.detectChanges();
        tick();

        const pElement = fixture.debugElement.query(By.css('p'));
        expect(pElement).toBeNull();
        const listItems = fixture.debugElement.queryAll(By.css('mat-list-item'));
        expect(listItems.length).toBe(2);
    }));
  });

  describe('filterAndProcessTodos method', () => {
    // This method is public, so we can test it directly
    beforeEach(fakeAsync(() => {
        mockGodService.setTodos(mockTodos);
        fixture.detectChanges();
        tick();
    }));

    it('should filter by priority only', () => {
      const mediumPriority = component.filterAndProcessTodos('medium');
      expect(mediumPriority.length).toBe(1);
      expect(mediumPriority.every(t => t.priority === 'medium')).toBeTrue();
    });

    it('should filter by completion status only', () => {
      const completed = component.filterAndProcessTodos(undefined, true);
      expect(completed.length).toBe(1);
      expect(completed[0].id).toBe(2);

      const incomplete = component.filterAndProcessTodos(undefined, false);
      expect(incomplete.length).toBe(4);
      expect(incomplete.every(t => !t.isCompleted)).toBeTrue();
    });

    it('should filter by both priority and completion', () => {
      const highAndIncomplete = component.filterAndProcessTodos('high', false);
      expect(highAndIncomplete.length).toBe(2);
      expect(highAndIncomplete[0].id).toBe(1);
      expect(highAndIncomplete[1].id).toBe(5);
    });

    it('should return all todos sorted by id if no filters are applied', () => {
      const allSorted = component.filterAndProcessTodos();
      expect(allSorted.length).toBe(mockTodos.length);
      expect(allSorted.map(t => t.id)).toEqual([1, 2, 3, 4, 5]);
    });
  });
});
