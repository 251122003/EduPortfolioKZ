// The current time, injected so that tests can move it (5-minute expiry, 60-second resend, ...).
export type Clock = () => Date;

export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = () => new Date();
