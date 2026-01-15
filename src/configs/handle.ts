const handleTypeColorMap: Record<string, string> = {
  number: '#2563eb',
  string: '#c54822',
  '*': '#21cd5a',
}

export function getHandleColorByTypes(types: string[]) {
  const type = types.sort((a, b) => a.localeCompare(b)).join('-')

  return handleTypeColorMap[type]
}
