import { Component } from '@angular/core';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-component-b',
  standalone: true,
  imports: [MatListModule, MatButtonModule],
  templateUrl: './component-b.component.html',
  styleUrl: './component-b.component.scss'
})
export class ComponentBComponent {

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
    console.log('Component B - Complex Value:', this.calculateComplexValue(7));
  }
}
