// export function selectorFamily(selectorFamily, { label, equal } = {}) {
//   const selectorFamilyRef = Object.freeze(label ? { label } : {})
//   const selectorFamilyMemo = new Map()
//   const selectorFamilyMeta = { selectorFamily, equal, selectorFamilyMemo }
//   atomMetas.set(selectorFamilyRef, selectorFamilyMeta)

//   return (...args) => {
//     let sel = selectorFamilyMemo
//     for (const arg of args) {
//       if (sel) {
//         sel = sel.get(arg)
//       } else {
//         sel = undefined
//       }
//     }

//     if (sel) {
//       return sel
//     }

//     sel = selector(selectorFamily(...args), { label, equal })

//     let l = selectorFamilyMemo
//     for (let i = 0; i < args.length - 1; i++) {
//       const arg = args[i]
//       if (!l.has(arg)) {
//         l.set(arg, new Map())
//       }
//       l = l.get(arg)
//     }
//     l.set(args[args.length - 1], sel)

//     return sel
//   }
// }
