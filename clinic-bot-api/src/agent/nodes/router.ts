import { BookingState } from '../state';

export function routeByStep(state: BookingState): string {
  return state.step;
}
