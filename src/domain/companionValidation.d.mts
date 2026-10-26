import type { CompanionUse, Ticket } from './types';
export function sameCompanionUse(
  first: CompanionUse,
  second: CompanionUse,
): boolean;
export function isTicketReserved(ticket: Ticket): boolean;
export function validateCompanionTicket(
  ticket: Ticket,
  ownerId?: string,
): boolean;
export function validateCompanionTransition(
  previous: Ticket | undefined,
  next: Ticket,
): boolean;
