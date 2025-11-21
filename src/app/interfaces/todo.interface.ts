export interface Todo {
  id: number;
  text: string;
  isCompleted: boolean;
  priority: 'high' | 'medium' | 'low';
}
