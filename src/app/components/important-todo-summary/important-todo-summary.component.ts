import { Component, input, computed } from '@angular/core';
import { GodService } from '../../services/god.service';
import { Todo } from '../../interfaces/todo.interface';
import { TodoItemComponent } from '../todo-item/todo-item.component';
import { MatListModule } from '@angular/material/list';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-important-todo-summary',
  standalone: true,
  imports: [
    TodoItemComponent,
    MatListModule,
    CommonModule
  ],
  templateUrl: './important-todo-summary.component.html',
  styleUrl: './important-todo-summary.component.scss'
})
export class ImportantTodoSummaryComponent {
  godService = input.required<GodService>();
  todos = computed(() => this.godService().getTodos()()); // Get todos as a signal

  // Duplicated Code: This method is identical to the one in TodoListComponent
  filterAndProcessTodos(priorityFilter?: 'high' | 'medium' | 'low', completedFilter?: boolean): Todo[] {
    let filteredTodos = this.todos();
    if (priorityFilter) {
      filteredTodos = filteredTodos.filter(todo => todo.priority === priorityFilter);
    }
    if (completedFilter !== undefined) {
      filteredTodos = filteredTodos.filter(todo => todo.isCompleted === completedFilter);
    }
    // Imagine more complex processing here
    return filteredTodos.sort((a, b) => a.id - b.id);
  }

  // Display only high priority, incomplete todos
  importantTodos = computed(() => this.filterAndProcessTodos('high', false));
}
