import { Component, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Todo } from '../../interfaces/todo.interface';
import { GodService } from '../../services/god.service';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  imports: [
    CommonModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './todo-item.component.html',
  styleUrl: './todo-item.component.scss'
})
export class TodoItemComponent {
  todo = model.required<Todo>();
  godService = model.required<GodService>();

  onToggle(id: number): void {
    this.godService()?.toggleTodo(id);
  }

  onDelete(id: number): void {
    this.godService()?.deleteTodo(id);
  }

  getPriorityClass(): string {
    const priority = this.todo()?.priority;
    if (priority === 'high') {
      return 'priority-high';
    }
    if (priority === 'medium') {
      return 'priority-medium';
    }
    // This handles 'low' and serves as the default
    return 'priority-low';
  }
}
