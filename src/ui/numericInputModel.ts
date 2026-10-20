export type NumericInputKind = 'integer' | 'decimal';

// 仅规范数字草稿；非法字符、精度与范围仍交由领域校验判断。
export function normalizeNumericInput(
  value: string,
  kind: NumericInputKind,
): string {
  if (value === '') return value;
  if (kind === 'integer') {
    return /^[0-9]+$/.test(value) ? value.replace(/^0+(?=[0-9])/, '') : value;
  }
  if (!/^[0-9.]+$/.test(value)) return value;
  const dot = value.indexOf('.');
  const integer = (dot < 0 ? value : value.slice(0, dot)).replace(
    /^0+(?=[0-9])/,
    '',
  );
  if (dot < 0) return integer;
  return (integer || '0') + '.' + value.slice(dot + 1).replaceAll('.', '');
}

export function finalizeNumericInput(
  value: string,
  kind: NumericInputKind,
): string {
  const normalized = normalizeNumericInput(value, kind);
  // 保留输入时末尾点的草稿，离开时才收尾，不修改其他非法内容。
  return kind === 'decimal' && /^[0-9]+[.]$/.test(normalized)
    ? normalized.slice(0, -1)
    : normalized;
}
