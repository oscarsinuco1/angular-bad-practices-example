import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GodService } from './services/god.service';
import { MatCardModule } from '@angular/material/card'; // Keep MatCardModule for the new cards
import { MatToolbarModule } from '@angular/material/toolbar'; // New: MatToolbarModule

// New To-Do components
import { TodoFormComponent } from './components/todo-form/todo-form.component';
import { TodoListComponent } from './components/todo-list/todo-list.component';
import { ImportantTodoSummaryComponent } from './components/important-todo-summary/important-todo-summary.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    MatCardModule, // Keep MatCardModule
    MatToolbarModule, // New MatToolbarModule
    TodoFormComponent,
    TodoListComponent,
    ImportantTodoSummaryComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('bad-practices-project');
  // DIP Violation: Directly instantiating a service instead of injecting it
  // This instance will be passed down to child components
  public godService: GodService = new GodService();

  constructor() {
    this.godService.log('App component initialized.');
    this.godService.getUsers(); // Still call a method to show service is used
  }
}
