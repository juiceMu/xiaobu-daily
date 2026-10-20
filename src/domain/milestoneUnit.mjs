// 数字和单位分别保存，保留历史数据可读，但新建/修改时拒绝将数值填作单位。
export function milestoneUnitError(unit) {
  if (typeof unit !== 'string' || !unit.trim() || unit.trim().length > 8)
    return '单位请填写 1–8 个字符，例如斤、页、元';
  if (
    /[\d０-９]/u.test(unit) &&
    /^[\s\d０-９.,，。+＋\-−%％]+$/u.test(unit.trim())
  )
    return '单位不能是纯数字，请填写斤、页、元等；数值请填在起始数值中';
  return '';
}
