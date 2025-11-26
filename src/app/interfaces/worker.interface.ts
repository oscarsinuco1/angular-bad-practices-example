export interface IWorker {
  work(): void;
  eat(): void; // Not all workers need to eat (e.g., robots)
  sleep(): void; // Not all workers need to sleep
  commute(): void;
  takeVacation(): void; // Not all workers can take vacation
  processData(): any;
  reportStatus(): string;
  rechargeBattery?(): void; // Optional for some, but still part of the fat interface
  performMaintenance?(): void; // Optional
}
