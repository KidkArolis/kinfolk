import { atom, useSelector, useSetter, useReducer } from 'kinfolk'

const cache = atom({
  entities: {
    e1: {},
    e2: {},
    e3: {},
    n1: {} // new item comes in
  },
  queries: {
    a1: ['e1'],
    a2: ['e1', 'e2'],
    a3: ['e3']
  }
})

// a selector recomputes the value eagerly if upstream dependencies (atoms/selectors) change - bam
// and they memoise
// const entities = selector(() => cache().entities)
const queries = selector(() => cache().queries)
const query = selectorFamily(queryId => () => queries()[queryId])
// since we can reach fot his item directly via cache, we recompute, but if it
// returns the same exact reference, it will not trigger a re-render if someone is
// referencing this selector, or rerender upstream shiz - e.g.!
const item = selectorFamily(itemId => () => cache().entities[itemId])
// here however, we're computing a new array, which is always new by reference
// but we're guarded against changes, because _only_ if query changes, and only
// if any of the items referenced change, will we recompute to begin with!
const queryResult = selectorFamily(queryId => () => query(queryId).map(itemId => item(itemId)))
const enhancedQueryResult = selectorFamily(queryId => () => heavyOperation(queryResult(queryId)))

export function useSomeQueries(queryConfigs) {
  const [someState, setState] = useState()
  const datas = useSelector(() => {
    return queryConfigs.map(queryId => {
      // by using the result, we bind to changes to this query
      return heavyOperation(queryResult(queryId), someState)
    })
  }, [someState])
}

// export function useSomeQueries(queries) {
//   // memoises return value! only rerenders if deps changed!
//   const results = useSelector(cache, (cache, memo) => {
//     const results = []

//     for (const qid of queries) {
//       const { queries, entities } = cache.queries
//       const itemIds = memo(() => queries[qid], queries[qid])
//       const items = memo(() => itemIds.map(itemId => entities[itemId], [itemIds]))
//       const itemsMem = memo(() => items, items)
//       const enhancedItems = memo(() => itemsMem.map(expensiveOperation))
//       results.push(itemsMem)
//     }

//     return results
//   }, [...queries])

//   return results
// }


// export function useSomeQueries(queries) {

//   // memoises return value! only rerenders if deps changed!
//   const results = useSelector((get) => {
//     const results = []
//     for (const qid of queries) {
//       // tracks cache
//       const queries = get(cache, cache => cache.queries)
//       // tracks cache
//       const entities = get(cache, cache => cache.entities)

//       // tracks queries
//       const itemIds = get(queries, queries => queries[qid])

//       // checks computed list by id
//       const queryResult = get.array(itemsIds, itemIds => itemIds.map(itemId => get(entities, entities => entities[itemId])))

//       // avoids recomputing if input same
//       const enhancedQueryResults = get(queryResult, queryResult => map(expensiveOperation))

//       results.push(queryResult)
//     }
//     return results
//   }, [...queries])

//   return results
// }


// what if...
cache full objects in queries, not entities..