import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-component-a',
  standalone: true,
  imports: [MatListModule, MatButtonModule],
  templateUrl: './component-a.component.html',
  styleUrl: './component-a.component.scss'
})
export class ComponentAComponent {

  dataValue = 10;

  calculateComplexValue(input: number): number {
    let result = input * this.dataValue;
    if (result > 50) {
      result -= 5;
    } else {
      result += 2;
    }
    return result;
  }

  constructor() {
    console.log('Component A - Complex Value:', this.calculateComplexValue(5));
  }
}
