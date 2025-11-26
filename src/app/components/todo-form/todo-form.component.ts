import { Component, input } from '@angular/core';
import { GodService } from '../../services/god.service';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { Todo } from '../../interfaces/todo.interface';

@Component({
  selector: 'app-todo-form',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule
  ],
  templateUrl: './todo-form.component.html',
  styleUrl: './todo-form.component.scss'
})
export class TodoFormComponent {
  // DIP violation / Prop-drilling: Service is passed down from parent
  godService = input.required<GodService>();

  newTodoText = '';
  newTodoPriority: 'high' | 'medium' | 'low' = 'medium';

  addTodo() {
    if (this.newTodoText.trim()) {
      this.godService().addTodo(this.newTodoText, this.newTodoPriority);
      this.newTodoText = '';
      this.newTodoPriority = 'medium';
    }
  }
}
