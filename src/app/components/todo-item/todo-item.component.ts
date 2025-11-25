import { Component, input, Input } from '@angular/core'; // Added Input
import { Todo } from '../../interfaces/todo.interface';
import { GodService } from '../../services/god.service';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  imports: [
    MatCheckboxModule,
    MatIconModule,
    MatButtonModule,
    CommonModule // For ngClass
  ],
  templateUrl: './todo-item.component.html',
  styleUrl: './todo-item.component.scss'
})
export class TodoItemComponent {
  todo = input.required<Todo>();
  @Input() godService!: GodService; // Changed to @Input()

  onToggle(id: number) {
    this.godService.toggleTodo(id); // Removed ()
  }

  onDelete(id: number) {
    this.godService.deleteTodo(id); // Removed ()
  }

  // OCP Violation: Logic for priority styling is embedded here.
  // Adding a new priority level would require modifying this method.
  getPriorityClass(): string {
    switch (this.todo().priority) {
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
      default: // default case to avoid error
        return 'priority-low';
    }
  }
}
