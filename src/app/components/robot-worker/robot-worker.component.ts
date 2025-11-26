import { Component } from '@angular/core';
import { IWorker } from '../../interfaces/worker.interface';

@Component({
  selector: 'app-robot-worker',
  standalone: true,
  imports: [],
  templateUrl: './robot-worker.component.html',
  styleUrl: './robot-worker.component.scss'
})
export class RobotWorkerComponent implements IWorker {

  constructor() {
  }

  work(): void {
    console.log('Robot is working efficiently.');
  }

  eat(): void {
    // This method is not relevant for a robot
  }

  sleep(): void {
    // This method is not relevant for a robot
  }

  commute(): void {
    console.log('Robot is commuting to the workstation.');
  }

  takeVacation(): void {
    // This method is not relevant for a robot
  }

  processData(): any {
    console.log('Robot is processing data.');
    return { result: 'Processed by Robot' };
  }

  reportStatus(): string {
    return 'Robot: All systems nominal.';
  }

  rechargeBattery?(): void {
    console.log('Robot is recharging battery.');
  }

  performMaintenance?(): void {
    console.log('Robot is performing self-maintenance.');
  }
}
