const colorModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default'
})

export const colorDatabase = Object.values(colorModules).flat()
