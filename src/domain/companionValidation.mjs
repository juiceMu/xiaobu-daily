const timeValid = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const textValid = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(value);
const SESSION_FIXED_FIELDS = [
  'id',
  'groupId',
  'mainAccountId',
  'mainTicketId',
  'companionAccountId',
  'companionTicketId',
  'mainName',
  'mainTicketName',
  'companionName',
  'companionTicketName',
  'note',
  'createdAt',
  'expiresAt',
];
export function sameCompanionUse(first, second) {
  return SESSION_FIXED_FIELDS.every((key) => first[key] === second[key]);
}
export function isTicketReserved(ticket) {
  return (ticket.companionUses || []).some(
    (entry) => !['cancelled', 'completed'].includes(entry.stage),
  );
}
export function validateCompanionTicket(ticket, ownerId) {
  if (ticket.companionUses === undefined)
    return ticket.source !== 'companion' || ticket.usedAt === null;
  if (!Array.isArray(ticket.companionUses)) return false;
  let active = 0;
  let consumed = 0;
  for (const entry of ticket.companionUses) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return false;
    const allowed = [
      'id',
      'groupId',
      'mainAccountId',
      'mainTicketId',
      'companionAccountId',
      'companionTicketId',
      'mainName',
      'mainTicketName',
      'companionName',
      'companionTicketName',
      'note',
      'createdAt',
      'expiresAt',
      'stage',
      'committedAt',
      'cancelRequestedAt',
    ];
    if (Object.keys(entry).some((key) => !allowed.includes(key))) return false;
    if (
      ![
        'id',
        'groupId',
        'mainAccountId',
        'mainTicketId',
        'companionAccountId',
        'companionTicketId',
      ].every((key) => textValid(entry[key]))
    )
      return false;
    if (
      ![
        'mainName',
        'mainTicketName',
        'companionName',
        'companionTicketName',
      ].every(
        (key) =>
          typeof entry[key] === 'string' &&
          entry[key].trim().length > 0 &&
          entry[key].length <= 100,
      )
    )
      return false;
    if (
      entry.mainAccountId === entry.companionAccountId ||
      !timeValid(entry.createdAt) ||
      !timeValid(entry.expiresAt) ||
      Date.parse(entry.expiresAt) <= Date.parse(entry.createdAt) ||
      typeof entry.note !== 'string' ||
      entry.note.length > 200 ||
      entry.note !== entry.note.trim()
    )
      return false;
    const companion = ticket.source === 'companion';
    if (
      ticket.id !==
        (companion ? entry.companionTicketId : entry.mainTicketId) ||
      (ownerId &&
        ownerId !==
          (companion ? entry.companionAccountId : entry.mainAccountId))
    )
      return false;
    if (
      !(
        companion
          ? ['requested', 'accepted', 'completed', 'cancelled']
          : ['invited', 'committed', 'completed', 'cancelled']
      ).includes(entry.stage)
    )
      return false;
    if (
      entry.cancelRequestedAt !== undefined &&
      (!timeValid(entry.cancelRequestedAt) ||
        Date.parse(entry.cancelRequestedAt) < Date.parse(entry.createdAt))
    )
      return false;
    const committed = ['committed', 'completed'].includes(entry.stage);
    if (committed) {
      consumed += 1;
      if (
        !timeValid(entry.committedAt) ||
        Date.parse(entry.committedAt) < Date.parse(entry.createdAt) ||
        Date.parse(entry.committedAt) >= Date.parse(entry.expiresAt) ||
        ticket.usedAt !== entry.committedAt ||
        ticket.usageNote !== entry.note ||
        (ticket.expiresAt &&
          Date.parse(entry.committedAt) >= Date.parse(ticket.expiresAt))
      )
        return false;
    } else if (entry.committedAt !== undefined) return false;
    if (!['cancelled', 'completed'].includes(entry.stage)) active += 1;
  }
  if (
    active > 1 ||
    consumed > 1 ||
    (consumed &&
      active &&
      !ticket.companionUses.some((entry) => entry.stage === 'committed'))
  )
    return false;
  if (!consumed && active && ticket.usedAt !== null) return false;
  if (ticket.source === 'companion' && !!ticket.usedAt !== !!consumed)
    return false;
  return (
    new Set(ticket.companionUses.map((entry) => entry.id)).size ===
    ticket.companionUses.length
  );
}

// 会话不可删改绑定或倒退终态；跨设备决定的证据另在提交入口检查。
export function validateCompanionTransition(previous, next) {
  const before = previous?.companionUses || [];
  const after = next.companionUses || [];
  for (const old of before) {
    const current = after.find((entry) => entry.id === old.id);
    if (!current || !sameCompanionUse(old, current)) return false;
    const stages = {
      requested: ['requested', 'accepted', 'cancelled'],
      invited: ['invited', 'committed', 'cancelled'],
      accepted: ['accepted', 'completed', 'cancelled'],
      committed: ['committed', 'completed'],
      completed: ['completed'],
      cancelled: ['cancelled'],
    };
    if (!stages[old.stage]?.includes(current.stage)) return false;
    if (
      old.committedAt !== undefined &&
      old.committedAt !== current.committedAt
    )
      return false;
    if (
      old.cancelRequestedAt !== undefined &&
      old.cancelRequestedAt !== current.cancelRequestedAt
    )
      return false;
  }
  for (const current of after.filter(
    (entry) => !before.some((old) => old.id === entry.id),
  )) {
    if (
      !['requested', 'invited', 'accepted', 'cancelled'].includes(
        current.stage,
      ) ||
      previous?.usedAt
    )
      return false;
  }
  if (
    (before.length || after.length) &&
    previous &&
    previous.source !== next.source
  )
    return false;
  return true;
}
