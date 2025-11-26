import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common'; // Import CommonModule

@Component({
  selector: 'app-product-display',
  standalone: true,
  imports: [CommonModule], // Add CommonModule for ngIf, ngSwitch
  templateUrl: './product-display.component.html',
  styleUrl: './product-display.component.scss'
})
export class ProductDisplayComponent {
  productType = input<'electronics' | 'clothing' | 'book' | 'food' | undefined>();
  productDetails = input<any>(); // Generic input for details
}
